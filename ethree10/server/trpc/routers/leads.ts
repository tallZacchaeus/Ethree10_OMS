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

  convertToOrganization: protectedProcedure
    .input(
      z.object({
        leadId: z.string(),
        organizationName: z.string().min(2),
        requesterEmail: z.string().email().optional(), // No longer provisioning users
        requesterName: z.string().min(1).optional(),
        isExternal: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "lead.convert");
      return LeadService.convertToOrganization({
        actorId: ctx.userId,
        leadId: input.leadId,
        organizationName: input.organizationName,
        requesterEmail: input.requesterEmail,
        requesterName: input.requesterName,
        isExternal: input.isExternal,
      });
    }),
});
