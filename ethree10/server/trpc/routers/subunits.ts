import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { assertLeadIsActiveMember } from "@/server/services/org-structure";
import { NotificationService } from "@/server/services/notification";
import { NotificationAudience } from "@/server/services/notification-audience";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const subunitsRouter = router({
  list: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("subunit.read");
      return ctx.db.subUnit.findMany({
        where: { teamId: input.teamId, archivedAt: null },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        name: z.string().min(2),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.create");
      const dept = await ctx.db.team.findFirst({
        where: { id: input.teamId },
      });
      if (!dept) throw new TRPCError({ code: "NOT_FOUND" });
      const created = await ctx.db.subUnit.create({
        data: {
          teamId: input.teamId,
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
        },
      });
      await NotificationService.createMany(
        [
          ...(await NotificationAudience.agencyWide(ctx.userId)),
          ...(await NotificationAudience.branchLead(input.teamId, ctx.userId)),
        ],
        {
          kind: "department_created",
          title: `New department: ${created.name}`,
          body: `Added under ${dept.name}.`,
          link: "/teams",
          entityType: "SubUnit",
          entityId: created.id,
        },
      );
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().nullish(),
        // Nullable so a lead can be cleared, not only replaced.
        leadId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.update");
      if (input.leadId) {
        await assertLeadIsActiveMember(ctx.db, input.leadId, "department");
      }
      // Slug left alone on rename — it is unique per branch and used as a
      // stable handle, the same reasoning as on Team.
      const { id, ...data } = input;
      const before = await ctx.db.subUnit.findUnique({ where: { id }, select: { leadId: true } });
      const subUnit = await ctx.db.subUnit.update({ where: { id }, data });

      if (input.leadId !== undefined && before?.leadId !== subUnit.leadId) {
        await NotificationService.createMany(
          [
            ...NotificationAudience.subject(subUnit.leadId, ctx.userId),
            ...(await NotificationAudience.branchLead(subUnit.teamId, ctx.userId)),
          ],
          {
            kind: "department_lead_assigned",
            title: subUnit.leadId
              ? `Department lead set: ${subUnit.name}`
              : `Department lead cleared: ${subUnit.name}`,
            body: subUnit.leadId
              ? "You assign and review this department's work."
              : "The department currently has no lead.",
            link: "/teams",
            entityType: "SubUnit",
            entityId: subUnit.id,
            allowDuplicate: true,
          },
        );
      }
      return subUnit;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.archive");

      const subUnit = await ctx.db.subUnit.findUnique({
        where: { id: input.id },
        select: { name: true },
      });
      if (!subUnit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });
      }

      // Same reasoning as archiving a branch: people and open work must be
      // moved first, or they end up attached to something nothing lists.
      const [people, openTasks] = await Promise.all([
        ctx.db.membership.count({ where: { subUnitId: input.id, removedAt: null } }),
        ctx.db.task.count({
          where: { subUnitId: input.id, status: { in: ["todo", "in_progress", "in_review"] } },
        }),
      ]);

      const blockers: string[] = [];
      if (people > 0) blockers.push(`${people} ${people === 1 ? "person" : "people"}`);
      if (openTasks > 0) blockers.push(`${openTasks} open ${openTasks === 1 ? "task" : "tasks"}`);
      if (blockers.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${subUnit.name} still has ${blockers.join(" and ")}. Move them first.`,
        });
      }

      const archived = await ctx.db.subUnit.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
      await NotificationService.createMany(
        [
          ...(await NotificationAudience.agencyWide(ctx.userId)),
          ...(await NotificationAudience.branchLead(archived.teamId, ctx.userId)),
        ],
        {
          kind: "department_archived",
          title: `Department archived: ${archived.name}`,
          body: "The department is no longer part of the active structure.",
          link: "/teams",
          entityType: "SubUnit",
          entityId: archived.id,
        },
      );
      return archived;
    }),
});
