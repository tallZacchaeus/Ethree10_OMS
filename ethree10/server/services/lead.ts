import { TRPCError } from "@trpc/server";
import type { LeadStatus, WorkspaceType } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "workspace";
  let slug = root;
  let n = 1;
  while (await db.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${root}-${n++}`;
  }
  return slug;
}

export class LeadService {
  static async create(input: {
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    message: string;
    source?: string;
  }) {
    return db.lead.create({ data: input });
  }

  static async list(status?: LeadStatus) {
    return db.lead.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
    });
  }

  static async get(id: string) {
    const lead = await db.lead.findUnique({
      where: { id },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
    });
    if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
    return lead;
  }

  static async updateStatus(actorId: string, id: string, status: LeadStatus) {
    const lead = await db.lead.update({ where: { id }, data: { status } });
    await AuditService.log({
      actorId,
      action: "lead.status_changed",
      entityType: "Lead",
      entityId: id,
      after: { status },
    });
    return lead;
  }

  /**
   * Convert a marketing lead into a client workspace and invite the requester
   * as that workspace's admin. Returns the new workspace + pending membership.
   */
  static async convertToWorkspace(args: {
    actorId: string;
    leadId: string;
    workspaceName: string;
    requesterEmail: string;
    requesterName: string;
    type?: Extract<WorkspaceType, "external_client" | "internal_client">;
  }) {
    const lead = await db.lead.findUnique({ where: { id: args.leadId } });
    if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
    if (lead.status === "converted") {
      throw new TRPCError({ code: "CONFLICT", message: "Lead already converted." });
    }

    const slug = await uniqueSlug(args.workspaceName);
    const workspace = await db.workspace.create({
      data: {
        name: args.workspaceName,
        slug,
        type: args.type ?? "external_client",
        description: lead.organization ?? null,
      },
    });

    const user = await db.user.upsert({
      where: { email: args.requesterEmail },
      create: { email: args.requesterEmail, name: args.requesterName },
      update: {},
    });

    const membership = await db.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "requester_admin",
        isPrimary: true,
        invitedAt: new Date(),
      },
    });

    await db.lead.update({
      where: { id: args.leadId },
      data: { status: "converted", workspaceId: workspace.id },
    });

    await AuditService.log({
      actorId: args.actorId,
      workspaceId: workspace.id,
      action: "lead.converted",
      entityType: "Lead",
      entityId: args.leadId,
      after: { workspaceId: workspace.id, requester: args.requesterEmail },
    });

    return { workspace, membership };
  }
}
