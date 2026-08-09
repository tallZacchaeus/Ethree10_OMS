import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { assertLeadIsActiveMember, resolveLeads } from "@/server/services/org-structure";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const teamsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ctx.authorize("team.read");
    const teams = await ctx.db.team.findMany({
      where: { archivedAt: null },
      include: {
        subUnits: { where: { archivedAt: null }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    // Head count per branch and per department. Counted here rather than with a
    // relation `_count` because that cannot exclude removed memberships without
    // Prisma's filteredRelationCount preview flag.
    const memberships = await ctx.db.membership.findMany({
      where: { removedAt: null },
      select: { teamId: true, subUnitId: true },
    });
    const countBy = (rows: (string | null)[]) => {
      const counts = new Map<string, number>();
      for (const id of rows) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      return counts;
    };
    const teamCounts = countBy(memberships.map((m) => m.teamId));
    const subUnitCounts = countBy(memberships.map((m) => m.subUnitId));

    // `leadId` is a plain column, not a relation, so the lead's name has to be
    // resolved separately — without it the UI can only show an opaque id.
    const leads = await resolveLeads(
      ctx.db,
      teams.flatMap((team) => [team.leadId, ...team.subUnits.map((s) => s.leadId)]),
    );

    return teams.map((team) => ({
      ...team,
      lead: team.leadId ? leads.get(team.leadId) ?? null : null,
      memberCount: teamCounts.get(team.id) ?? 0,
      subUnits: team.subUnits.map((subUnit) => ({
        ...subUnit,
        lead: subUnit.leadId ? leads.get(subUnit.leadId) ?? null : null,
        memberCount: subUnitCounts.get(subUnit.id) ?? 0,
      })),
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("team.read");
      const team = await ctx.db.team.findFirst({
        where: { id: input.id },
        include: { subUnits: true },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("team.create");
      return ctx.db.team.create({
        data: {
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
          color: input.color,
          icon: input.icon,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().nullish(),
        color: z.string().optional(),
        icon: z.string().optional(),
        // Nullable so a lead can actually be removed. `.optional()` alone meant
        // the field could only ever be set, never cleared.
        leadId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authCtx = await ctx.authorize("team.update");
      if (!authCtx.isSuperAdmin && !authCtx.roles.includes("agency_admin")) {
        if (authCtx.teamId !== input.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot update a team you do not head." });
        }
      }
      if (input.leadId) {
        await assertLeadIsActiveMember(ctx.db, input.leadId, "branch");
      }
      // The slug is deliberately left alone on rename: it is @unique, and
      // `publicCategoryLabel` on the marketing site keys off it.
      const { id, ...data } = input;
      return ctx.db.team.update({ where: { id }, data });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("team.archive");

      const team = await ctx.db.team.findUnique({
        where: { id: input.id },
        select: { name: true },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });

      // Archiving a branch out from under its people would leave memberships,
      // departments and live projects pointing at something the UI no longer
      // lists. Refuse, and say exactly what has to move first.
      const [people, departments, projects] = await Promise.all([
        ctx.db.membership.count({ where: { teamId: input.id, removedAt: null } }),
        ctx.db.subUnit.count({ where: { teamId: input.id, archivedAt: null } }),
        ctx.db.project.count({
          where: { agencyTeamId: input.id, status: { notIn: ["delivered", "closed", "cancelled"] } },
        }),
      ]);

      const blockers: string[] = [];
      if (people > 0) blockers.push(`${people} ${people === 1 ? "person" : "people"}`);
      if (departments > 0) blockers.push(`${departments} ${departments === 1 ? "department" : "departments"}`);
      if (projects > 0) blockers.push(`${projects} open ${projects === 1 ? "project" : "projects"}`);
      if (blockers.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${team.name} still has ${blockers.join(", ")}. Move or close them first.`,
        });
      }

      return ctx.db.team.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
    }),
});
