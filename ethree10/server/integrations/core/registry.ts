import type { IntegrationProvider } from "@prisma/client";
import type { IntegrationAdapter } from "@/server/integrations/core/types";
import { planeAdapter } from "@/server/integrations/plane";
import { trelloAdapter } from "@/server/integrations/trello";

const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  plane: planeAdapter,
  trello: trelloAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`No integration adapter registered for provider: ${provider}`);
  }
  return adapter;
}

export function tryGetAdapter(provider: IntegrationProvider): IntegrationAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export function listAdapters(): IntegrationAdapter[] {
  return Object.values(ADAPTERS).filter((a): a is IntegrationAdapter => Boolean(a));
}
