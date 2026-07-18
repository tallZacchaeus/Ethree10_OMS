import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { TemplateService } from "@/server/services/template";
import { can } from "@/server/auth/permissions";
import { getAgencyAuthContext } from "@/server/services/agency";
import { TRPCError } from "@trpc/server";

export const templatesRouter = router({
  list: protectedProcedure.query(async () => {
    return TemplateService.list();
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        projectType: z.string(),
        tasks: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            subUnitId: z.string().optional(),
            estimatedHours: z.number().optional(),
            dependenciesByIndex: z.array(z.number()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "organization.update")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only agency staff can create templates" });
      }
      return TemplateService.create({ actorId: ctx.userId, ...input });
    }),

  applyTemplate: protectedProcedure
    .input(z.object({ templateId: z.string(), projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "project.update")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot apply templates" });
      }
      return TemplateService.applyToProject({ actorId: ctx.userId, ...input });
    }),
});
