import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { requireAgencyAction } from "@/server/services/agency";

/**
 * First-run "ready to use" checklist for agency admins. Derives each step's completion from
 * real data so the card disappears once the agency is set up.
 */
export const setupRouter = router({
  checklist: protectedProcedure.query(async ({ ctx }) => {
    // department.create is admin-only — keeps this an admin setup surface.
    await requireAgencyAction(ctx.userId, "department.create");

    const [departments, staffCount, clientCount, invoiceCount] = await Promise.all([
      db.department.findMany({
        where: { archivedAt: null },
        select: { id: true, leadId: true },
      }),
      // Staff = org-null memberships.
      db.membership.count({
        where: {
          organizationId: null,
          removedAt: null,
          role: { in: ["admin", "department_lead", "member"] },
        },
      }),
      // Clients = memberships attached to an organization.
      db.membership.count({
        where: { organizationId: { not: null }, removedAt: null, role: { in: ["client", "client_viewer"] } },
      }),
      db.invoice.count(),
    ]);

    const steps = [
      {
        key: "departments",
        label: "Departments ready",
        hint: "Creative and Product Development are set up.",
        done: departments.length >= 2,
        href: "/departments",
      },
      {
        key: "leads",
        label: "Assign department leads",
        hint: "Give each department a lead.",
        done: departments.length > 0 && departments.every((d) => Boolean(d.leadId)),
        href: "/departments",
      },
      {
        key: "team",
        label: "Invite a teammate",
        hint: "Add at least one staff member.",
        done: staffCount > 1,
        href: "/members",
      },
      {
        key: "client",
        label: "Add a client",
        hint: "Invite a client so they can submit requests.",
        done: clientCount > 0,
        href: "/members",
      },
      {
        key: "invoice",
        label: "Send your first invoice",
        hint: "Bill a client to complete setup.",
        done: invoiceCount > 0,
        href: "/invoices/new",
      },
    ];

    return { steps, complete: steps.every((s) => s.done) };
  }),
});
