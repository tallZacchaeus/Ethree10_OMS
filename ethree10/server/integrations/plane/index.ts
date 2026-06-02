import { createHmac, timingSafeEqual } from "crypto";
import type { Task } from "@prisma/client";
import type {
  AdapterConfig,
  ExternalLink,
  InboundEvent,
  IntegrationAdapter,
} from "@/server/integrations/core/types";

const STATUS_TO_PLANE: Record<string, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_TO_PLANE: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

function apiBase(cfg: AdapterConfig): string {
  const root = (cfg.baseUrl ?? "https://api.plane.so").replace(/\/$/, "");
  const workspaceSlug = String(cfg.config["workspaceSlug"] ?? "");
  const projectId = String(cfg.config["projectId"] ?? "");
  return `${root}/api/v1/workspaces/${workspaceSlug}/projects/${projectId}`;
}

function headers(cfg: AdapterConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": cfg.secrets["apiToken"] ?? "",
  };
}

function hashTask(task: Task): string {
  return createHmac("sha1", "ethree10")
    .update(`${task.title}|${task.status}|${task.priority}|${task.dueDate?.toISOString() ?? ""}`)
    .digest("hex");
}

export const planeAdapter: IntegrationAdapter = {
  provider: "plane",
  displayName: "Plane",
  description: "Sync tasks with Plane projects (cloud or self-hosted).",
  capabilities: { webhooks: true, poll: true, comments: true, attachments: false, oauth: false },

  async testConnection(cfg) {
    try {
      const res = await fetch(`${apiBase(cfg)}/issues/?per_page=1`, {
        headers: headers(cfg),
      });
      if (!res.ok) {
        return { ok: false, error: `Plane responded ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  async createExternalTask(task, cfg) {
    const res = await fetch(`${apiBase(cfg)}/issues/`, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify({
        name: task.title,
        description_html: task.description ?? "",
        priority: PRIORITY_TO_PLANE[task.priority] ?? "none",
        target_date: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
      }),
    });
    if (!res.ok) {
      throw new Error(`Plane create failed: ${res.status}`);
    }
    const issue = (await res.json()) as { id: string };
    const workspaceSlug = String(cfg.config["workspaceSlug"] ?? "");
    const projectId = String(cfg.config["projectId"] ?? "");
    return {
      externalId: issue.id,
      externalUrl: `https://app.plane.so/${workspaceSlug}/projects/${projectId}/issues/${issue.id}`,
      hash: hashTask(task),
    };
  },

  async updateExternalTask(link, task, cfg) {
    const res = await fetch(`${apiBase(cfg)}/issues/${link.externalId}/`, {
      method: "PATCH",
      headers: headers(cfg),
      body: JSON.stringify({
        name: task.title,
        priority: PRIORITY_TO_PLANE[task.priority] ?? "none",
        target_date: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
      }),
    });
    if (!res.ok) {
      throw new Error(`Plane update failed: ${res.status}`);
    }
    return { externalId: link.externalId, hash: hashTask(task) };
  },

  async deleteExternalTask(link, cfg) {
    await fetch(`${apiBase(cfg)}/issues/${link.externalId}/`, {
      method: "DELETE",
      headers: headers(cfg),
    });
  },

  verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  async parseWebhook(payload) {
    const body = payload as {
      event?: string;
      action?: string;
      data?: { id?: string; state?: { group?: string } };
    };
    const externalId = body.data?.id;
    if (!externalId) return [];

    const stateGroup = body.data?.state?.group;
    const kind: InboundEvent["kind"] =
      stateGroup === "completed" ? "task_completed" : "task_updated";

    const event: InboundEvent = {
      externalEventId: `${body.event ?? "issue"}-${externalId}-${Date.now()}`,
      externalId,
      kind: body.event === "issue.deleted" ? "task_deleted" : kind,
      payload: (body.data ?? {}) as Record<string, unknown>,
      occurredAt: new Date(),
    };
    return [event];
  },
};

export function planeStatusFromGroup(group: string | undefined): string | null {
  switch (group) {
    case "backlog":
    case "unstarted":
      return "todo";
    case "started":
      return "in_progress";
    case "completed":
      return "done";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export const PLANE_STATUS_TO_PLATFORM = STATUS_TO_PLANE;
