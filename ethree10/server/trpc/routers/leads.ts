import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { LeadService } from "@/server/services/lead";
import { requireAgencyAction } from "@/server/services/agency";

export const leadsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["new", "contacted", "converted", "rejected"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "lead.read");
      return LeadService.list(input?.status);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "lead.read");
      return LeadService.get(input.id);
    }),

  newCount: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "lead.read");
    const leads = await LeadService.list("new");
    return leads.length;
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["new", "contacted", "converted", "rejected"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "lead.update");
      return LeadService.updateStatus(ctx.userId, input.id, input.status);
    }),

  convertToWorkspace: protectedProcedure
    .input(
      z.object({
        leadId: z.string(),
        workspaceName: z.string().min(2),
        requesterEmail: z.string().email(),
        requesterName: z.string().min(1),
        type: z.enum(["external_client", "internal_client"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "lead.convert");
      return LeadService.convertToWorkspace({
        actorId: ctx.userId,
        leadId: input.leadId,
        workspaceName: input.workspaceName,
        requesterEmail: input.requesterEmail,
        requesterName: input.requesterName,
        type: input.type,
      });
    }),
});
