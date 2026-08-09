import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";
import { hasAgencyWideScope } from "@/server/auth/role-groups";

export interface SearchHit {
  id: string;
  type: "request" | "project" | "task" | "person";
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Global search.
 *
 * The header search box existed and did nothing — it looked functional and was
 * not. This backs it.
 *
 * Results are permission-scoped: a user only ever sees entities they could reach
 * by navigating. Non-agency-wide roles are limited to their own branches, which
 * is the same rule the list pages use.
 */
export const searchRouter = router({
  query: protectedProcedure
    .input(z.object({ q: z.string().trim().min(2).max(100) }))
    .query(async ({ ctx, input }): Promise<SearchHit[]> => {
      const auth = await getAgencyAuthContext(ctx.userId);
      const term = input.q;
      const contains = { contains: term, mode: "insensitive" as const };

      const agencyWide = hasAgencyWideScope(auth);
      const memberships = await db.membership.findMany({
        where: { userId: ctx.userId, removedAt: null, acceptedAt: { not: null }, teamId: { not: null } },
        select: { teamId: true },
      });
      const teamIds = memberships.flatMap((m) => (m.teamId ? [m.teamId] : []));
      const branchScope = agencyWide ? {} : { in: teamIds };

      const [requests, projects, tasks, people] = await Promise.all([
        can(auth, "request.read")
          ? db.request.findMany({
              where: {
                OR: [{ title: contains }, { code: contains }, { requesterName: contains }],
                ...(agencyWide ? {} : { routedTeamId: branchScope }),
              },
              take: 5,
              orderBy: { createdAt: "desc" },
              select: { id: true, code: true, title: true, stage: true, organization: { select: { name: true } } },
            })
          : [],
        can(auth, "project.read")
          ? db.project.findMany({
              where: {
                OR: [{ name: contains }, { code: contains }],
                ...(agencyWide ? {} : { agencyTeamId: branchScope }),
              },
              take: 5,
              orderBy: { updatedAt: "desc" },
              select: { id: true, code: true, name: true, status: true, organization: { select: { name: true } } },
            })
          : [],
        can(auth, "task.read")
          ? db.task.findMany({
              where: {
                OR: [{ title: contains }, { code: contains }],
                ...(agencyWide ? {} : { project: { agencyTeamId: branchScope } }),
              },
              take: 5,
              orderBy: { updatedAt: "desc" },
              select: { id: true, code: true, title: true, status: true, project: { select: { name: true } } },
            })
          : [],
        can(auth, "member.read")
          ? db.user.findMany({
              where: {
                deactivatedAt: null,
                OR: [{ name: contains }, { email: contains }],
                memberships: { some: { removedAt: null, acceptedAt: { not: null } } },
              },
              take: 5,
              select: { id: true, name: true, email: true },
            })
          : [],
      ]);

      return [
        ...requests.map((r): SearchHit => ({
          id: r.id,
          type: "request",
          title: r.title,
          subtitle: `${r.code} · ${r.organization?.name ?? "No client"} · ${r.stage.replace(/_/g, " ")}`,
          href: `/requests/${r.id}`,
        })),
        ...projects.map((p): SearchHit => ({
          id: p.id,
          type: "project",
          title: p.name,
          subtitle: `${p.code} · ${p.organization?.name ?? "No client"} · ${p.status}`,
          href: `/projects/${p.id}`,
        })),
        ...tasks.map((t): SearchHit => ({
          id: t.id,
          type: "task",
          title: t.title,
          subtitle: `${t.code} · ${t.project.name} · ${t.status.replace(/_/g, " ")}`,
          href: `/tasks/${t.id}`,
        })),
        ...people.map((u): SearchHit => ({
          id: u.id,
          type: "person",
          title: u.name,
          subtitle: u.email,
          href: `/members/${u.id}`,
        })),
      ];
    }),
});
