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
    // team.create is admin-only — keeps this an admin setup surface.
    await requireAgencyAction(ctx.userId, "team.create");

    const [teams, staffCount, clientCount, invoiceCount] = await Promise.all([
      db.team.findMany({
        where: { archivedAt: null },
        select: { id: true, leadId: true },
      }),
      // Staff = org-null memberships.
      db.membership.count({
        where: {
          role: { in: ["super_admin", "agency_admin", "team_head", "team_member", "finance_admin"] },
          acceptedAt: { not: null },
        },
      }),
      // Clients = represented by organizations now.
      db.organization.count(),
      db.invoice.count(),
    ]);

    const steps = [
      {
        key: "teams",
        label: "Teams ready",
        hint: "Creative and Product Development are set up.",
        done: teams.length >= 2,
        href: "/teams",
      },
      {
        key: "leads",
        label: "Assign team heads",
        hint: "Give each delivery team a responsible head.",
        done: teams.length > 0 && teams.every((d) => Boolean(d.leadId)),
        href: "/teams",
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
        label: "Add a client organization",
        hint: "Create a client organization so they can submit requests.",
        done: clientCount > 0,
        href: "/organizations",
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
