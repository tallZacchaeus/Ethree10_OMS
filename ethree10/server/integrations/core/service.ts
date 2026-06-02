import { TRPCError } from "@trpc/server";
import type { Integration, IntegrationProvider, Task } from "@prisma/client";
import { db } from "@/server/db/client";
import { env } from "@/lib/env";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { encryptSecret, decryptSecret } from "@/server/integrations/core/crypto";
import { getAdapter, tryGetAdapter } from "@/server/integrations/core/registry";
import type { AdapterConfig } from "@/server/integrations/core/types";
import { planeStatusFromGroup } from "@/server/integrations/plane";

function buildAdapterConfig(integration: Integration): AdapterConfig {
  const secrets = JSON.parse(
    decryptSecret(integration.encryptedSecrets, env.INTEGRATION_SECRET_KEY),
  ) as Record<string, string>;
  return {
    config: (integration.config ?? {}) as Record<string, unknown>,
    secrets,
    baseUrl: integration.baseUrl ?? undefined,
  };
}

/**
 * Orchestrates all adapter calls. Domain code (TaskService) calls the outbound
 * hooks; webhook routes call handleInboundWebhook. The platform stays the
 * source of truth — failures degrade the integration but never block local work.
 */
export class IntegrationService {
  static async list(filters: { departmentId?: string } = {}) {
    return db.integration.findMany({
      where: { departmentId: filters.departmentId },
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { id: true, name: true } },
        subUnit: { select: { id: true, name: true } },
        _count: { select: { links: true } },
      },
    });
  }

  static async get(id: string) {
    const integration = await db.integration.findUnique({ where: { id } });
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });
    return integration;
  }

  static async connect(args: {
    actorId: string;
    provider: IntegrationProvider;
    name: string;
    departmentId?: string;
    subUnitId?: string;
    baseUrl?: string;
    config: Record<string, unknown>;
    secrets: Record<string, string>;
  }) {
    const adapter = getAdapter(args.provider);
    const encryptedSecrets = encryptSecret(
      JSON.stringify(args.secrets),
      env.INTEGRATION_SECRET_KEY,
    );

    const test = await adapter.testConnection({
      config: args.config,
      secrets: args.secrets,
      baseUrl: args.baseUrl,
    });

    const integration = await db.integration.create({
      data: {
        provider: args.provider,
        name: args.name,
        departmentId: args.departmentId ?? null,
        subUnitId: args.subUnitId ?? null,
        baseUrl: args.baseUrl ?? null,
        config: args.config as object,
        encryptedSecrets,
        status: test.ok ? "active" : "error",
        lastError: test.ok ? null : test.error,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "integration.connected",
      entityType: "Integration",
      entityId: integration.id,
      after: { provider: args.provider, status: integration.status },
    });
    return integration;
  }

  static async test(id: string) {
    const integration = await IntegrationService.get(id);
    const adapter = getAdapter(integration.provider);
    const result = await adapter.testConnection(buildAdapterConfig(integration));
    await db.integration.update({
      where: { id },
      data: {
        status: result.ok ? "active" : "error",
        lastError: result.ok ? null : result.error,
        lastSyncedAt: result.ok ? new Date() : integration.lastSyncedAt,
      },
    });
    return result;
  }

  static async disconnect(args: { actorId: string; id: string }) {
    const integration = await db.integration.update({
      where: { id: args.id },
      data: { status: "disconnected" },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "integration.disconnected",
      entityType: "Integration",
      entityId: integration.id,
    });
    return integration;
  }

  /** Resolve the active integration that should mirror a given task. */
  private static async integrationForTask(task: Task): Promise<Integration | null> {
    if (task.subUnitId) {
      const bySubUnit = await db.integration.findFirst({
        where: { subUnitId: task.subUnitId, status: { in: ["active", "degraded"] } },
      });
      if (bySubUnit) return bySubUnit;
    }
    const project = await db.project.findUnique({
      where: { id: task.projectId },
      select: { agencyDepartmentId: true },
    });
    if (!project?.agencyDepartmentId) return null;
    return db.integration.findFirst({
      where: {
        departmentId: project.agencyDepartmentId,
        status: { in: ["active", "degraded"] },
      },
    });
  }

  private static async markStatus(id: string, ok: boolean, error?: string) {
    await db.integration.update({
      where: { id },
      data: {
        status: ok ? "active" : "degraded",
        lastError: ok ? null : error ?? "Sync error",
        lastSyncedAt: ok ? new Date() : undefined,
      },
    });
  }

  /** Outbound: mirror a newly created task into the external tool. */
  static async onTaskCreated(task: Task): Promise<void> {
    const integration = await IntegrationService.integrationForTask(task);
    if (!integration) return;
    const adapter = tryGetAdapter(integration.provider);
    if (!adapter) return;
    try {
      const link = await adapter.createExternalTask(task, buildAdapterConfig(integration));
      await db.integrationLink.create({
        data: {
          integrationId: integration.id,
          taskId: task.id,
          externalId: link.externalId,
          externalUrl: link.externalUrl ?? null,
          lastSyncedHash: link.hash,
          lastSyncedAt: new Date(),
        },
      });
      await IntegrationService.markStatus(integration.id, true);
    } catch (err) {
      await IntegrationService.markStatus(
        integration.id,
        false,
        err instanceof Error ? err.message : "create failed",
      );
      await db.integrationLink.upsert({
        where: { taskId: task.id },
        create: {
          integrationId: integration.id,
          taskId: task.id,
          externalId: "",
          pendingSync: true,
        },
        update: { pendingSync: true },
      });
    }
  }

  /** Outbound: push an update for a task that already has an external mirror. */
  static async onTaskUpdated(task: Task): Promise<void> {
    const link = await db.integrationLink.findUnique({ where: { taskId: task.id } });
    if (!link || !link.externalId) return;
    const integration = await db.integration.findUnique({ where: { id: link.integrationId } });
    if (!integration || integration.status === "disconnected") return;
    const adapter = tryGetAdapter(integration.provider);
    if (!adapter) return;
    try {
      const result = await adapter.updateExternalTask(
        { externalId: link.externalId },
        task,
        buildAdapterConfig(integration),
      );
      await db.integrationLink.update({
        where: { taskId: task.id },
        data: { lastSyncedHash: result.hash, lastSyncedAt: new Date(), pendingSync: false },
      });
      await IntegrationService.markStatus(integration.id, true);
    } catch (err) {
      await IntegrationService.markStatus(
        integration.id,
        false,
        err instanceof Error ? err.message : "update failed",
      );
      await db.integrationLink.update({
        where: { taskId: task.id },
        data: { pendingSync: true },
      });
    }
  }

  /** Inbound: verify and apply external webhook events to platform tasks. */
  static async handleInboundWebhook(args: {
    provider: IntegrationProvider;
    rawBody: string;
    signature: string;
  }): Promise<{ processed: number }> {
    const adapter = getAdapter(args.provider);
    const integrations = await db.integration.findMany({
      where: { provider: args.provider, status: { in: ["active", "degraded"] } },
    });

    let processed = 0;
    for (const integration of integrations) {
      const cfg = buildAdapterConfig(integration);
      const secret = cfg.secrets["webhookSecret"] ?? "";
      if (!adapter.verifyWebhookSignature(args.rawBody, args.signature, secret)) {
        continue;
      }
      const events = await adapter.parseWebhook(JSON.parse(args.rawBody), cfg);
      for (const event of events) {
        await IntegrationService.applyInboundEvent(integration.id, event);
        processed += 1;
      }
    }
    return { processed };
  }

  private static async applyInboundEvent(
    integrationId: string,
    event: { externalId: string; kind: string; payload: Record<string, unknown> },
  ) {
    const link = await db.integrationLink.findFirst({
      where: { integrationId, externalId: event.externalId },
      include: { task: true },
    });
    if (!link) return;

    if (event.kind === "task_deleted") {
      await db.integrationLink.update({
        where: { id: link.id },
        data: { pendingSync: false, externalUrl: null },
      });
      return;
    }

    const stateGroup = (event.payload["state"] as { group?: string } | undefined)?.group;
    const mapped = planeStatusFromGroup(stateGroup);
    if (mapped) {
      await db.task.update({
        where: { id: link.taskId },
        data: {
          status: mapped as Task["status"],
          completedAt: mapped === "done" ? new Date() : link.task.completedAt,
        },
      });
      await AuditService.log({
        actorId: null,
        action: "task.synced_inbound",
        entityType: "Task",
        entityId: link.taskId,
        after: { status: mapped },
      });
      if (mapped === "done" && link.task.assigneeUserId) {
        await NotificationService.create({
          userId: link.task.assigneeUserId,
          kind: "task_completed",
          title: `Task synced as done: ${link.task.title}`,
          link: `/tasks/${link.taskId}`,
          entityType: "Task",
          entityId: link.taskId,
        });
      }
    }
    await db.integrationLink.update({
      where: { id: link.id },
      data: { lastSyncedAt: new Date() },
    });
  }
}
