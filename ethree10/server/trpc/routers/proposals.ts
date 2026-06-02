import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { ProposalService } from "@/server/services/proposal";
import { can } from "@/server/auth/permissions";
import { getAgencyAuthContext } from "@/server/services/agency";
import { TRPCError } from "@trpc/server";

export const proposalsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().optional(), requestId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      if (input.projectId) {
        return ProposalService.listForProject(input.projectId);
      } else if (input.requestId) {
        return ProposalService.listForRequest(input.requestId);
      }
      return [];
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        requestId: z.string().optional(),
        title: z.string(),
        summary: z.string().optional(),
        currency: z.string().default("NGN"),
        lineItems: z.array(
          z.object({
            label: z.string(),
            qty: z.number().min(1),
            unitPrice: z.number().min(0),
          })
        ),
        terms: z.string().optional(),
        validUntil: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "project.update")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only agency staff can create proposals." });
      }
      return ProposalService.create({ actorId: ctx.userId, ...input });
    }),

  send: protectedProcedure
    .input(z.string())
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "project.update")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only agency staff can send proposals." });
      }
      return ProposalService.send({ actorId: ctx.userId, proposalId: input });
    }),

  accept: protectedProcedure
    .input(z.string())
    .mutation(async ({ input, ctx }) => {
      return ProposalService.accept({ actorId: ctx.userId, proposalId: input });
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ProposalService.reject({ actorId: ctx.userId, proposalId: input.id, reason: input.reason });
    }),
});
