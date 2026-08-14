import { TRPCError } from "@trpc/server";
import type { LeadStatus } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { NotificationAudience } from "@/server/services/notification-audience";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "client";
  let slug = root;
  let n = 1;
  while (await db.organization.findUnique({ where: { slug }, select: { id: true } })) {
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
    const lead = await db.lead.create({ data: input });

    // Enquiries arrive from the public site with nobody watching. Finance and
    // the admins own follow-up, so they are told rather than left to discover
    // it on the Enquiries screen.
    await NotificationService.createMany(
      [
        ...(await NotificationAudience.finance()),
        ...(await NotificationAudience.administrators()),
      ],
      {
        kind: "lead_received",
        title: `New enquiry from ${input.name}`,
        body: input.organization ? `${input.organization} — ${input.message.slice(0, 120)}` : input.message.slice(0, 140),
        link: "/leads",
        entityType: "Lead",
        entityId: lead.id,
        allowDuplicate: true,
      },
    );

    return lead;
  }

  static async list(status?: LeadStatus) {
    return db.lead.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: { org: { select: { id: true, name: true, slug: true } } },
    });
  }

  static async get(id: string) {
    const lead = await db.lead.findUnique({
      where: { id },
      include: { org: { select: { id: true, name: true, slug: true } } },
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

  static async convertToOrganization(args: {
    actorId: string;
    leadId: string;
    organizationName: string;
    requesterEmail?: string;
    requesterName?: string;
    isExternal?: boolean;
  }) {
    const lead = await db.lead.findUnique({ where: { id: args.leadId } });
    if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
    if (lead.status === "converted") {
      throw new TRPCError({ code: "CONFLICT", message: "Lead already converted." });
    }

    const slug = await uniqueSlug(args.organizationName);
    const organization = await db.organization.create({
      data: {
        name: args.organizationName,
        slug,
        isExternal: args.isExternal ?? true,
        description: lead.organization ?? null,
      },
    });

    await db.lead.update({
      where: { id: args.leadId },
      data: { status: "converted", organizationId: organization.id },
    });

    await AuditService.log({
      actorId: args.actorId,
      action: "lead.converted",
      entityType: "Lead",
      entityId: args.leadId,
      after: { organizationId: organization.id, requester: args.requesterEmail },
    });

    await NotificationService.createMany(await NotificationAudience.agencyWide(args.actorId), {
      kind: "lead_converted",
      title: `Enquiry converted: ${organization.name}`,
      body: "An enquiry became a client organisation.",
      link: `/organizations/${organization.id}`,
      entityType: "Organization",
      entityId: organization.id,
    });

    return { organization };
  }
}
