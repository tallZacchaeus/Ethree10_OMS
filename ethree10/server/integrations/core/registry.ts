import type { IntegrationProvider } from "@prisma/client";
import type { IntegrationAdapter } from "@/server/integrations/core/types";
import { planeAdapter } from "@/server/integrations/plane";

// Plane is the agency's system of execution. Trello was removed once the
// adapter pattern had been proven — carrying a second provider doubled the
// webhook and sync surface for no current benefit.
const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  plane: planeAdapter,
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
