import { z } from "zod";
import { IntegrationProvider } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { IntegrationService } from "@/server/integrations/core/service";
import { requireAgencyAction } from "@/server/services/agency";

export const integrationsRouter = router({
  list: protectedProcedure
    .input(z.object({ departmentId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "integration.read");
      const integrations = await IntegrationService.list({ departmentId: input?.departmentId });
      // Never expose encrypted secrets to the client.
      return integrations.map(({ encryptedSecrets: _omit, config: _config, ...rest }) => rest);
    }),

  connect: protectedProcedure
    .input(
      z.object({
        provider: z.nativeEnum(IntegrationProvider),
        name: z.string().min(2),
        departmentId: z.string().optional(),
        subUnitId: z.string().optional(),
        baseUrl: z.string().url().optional(),
        config: z.record(z.unknown()),
        secrets: z.record(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "integration.manage");
      const integration = await IntegrationService.connect({
        actorId: ctx.userId,
        provider: input.provider,
        name: input.name,
        departmentId: input.departmentId,
        subUnitId: input.subUnitId,
        baseUrl: input.baseUrl,
        config: input.config,
        secrets: input.secrets,
      });
      return { id: integration.id, status: integration.status, lastError: integration.lastError };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "integration.manage");
      return IntegrationService.test(input.id);
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "integration.manage");
      const integration = await IntegrationService.disconnect({
        actorId: ctx.userId,
        id: input.id,
      });
      return { id: integration.id, status: integration.status };
    }),
});
