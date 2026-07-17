import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { can } from "@/server/auth/permissions";
import { getAgencyAuthContext } from "@/server/services/agency";
import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";

export const approvalRulesRouter = router({
  list: protectedProcedure.query(async () => {
    return db.approvalRule.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        triggerCondition: z.any(),
        requiredRole: z.nativeEnum(Role),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "organization.update")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only agency admins can manage approval rules." });
      }

      return db.approvalRule.create({
        data: {
          name: input.name,
          triggerCondition: input.triggerCondition,
          requiredRole: input.requiredRole,
          isActive: true,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        triggerCondition: z.any().optional(),
        requiredRole: z.nativeEnum(Role).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "organization.update")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, ...data } = input;
      return db.approvalRule.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ input, ctx }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "organization.update")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return db.approvalRule.delete({
        where: { id: input },
      });
    }),
});
