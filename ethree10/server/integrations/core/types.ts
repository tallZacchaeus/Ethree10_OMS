import type { IntegrationProvider, Task } from "@prisma/client";

export interface ExternalLink {
  externalId: string;
  externalUrl?: string;
  hash: string;
}

export interface InboundEvent {
  externalEventId: string;
  externalId: string;
  kind:
    | "task_updated"
    | "task_completed"
    | "task_deleted"
    | "comment_added"
    | "assignment_changed";
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface AdapterConfig {
  /** Non-secret config (workspace ids, board ids, user mappings, etc.). */
  config: Record<string, unknown>;
  /** Decrypted secrets (api tokens, oauth tokens). */
  secrets: Record<string, string>;
  /** For self-hosted instances. */
  baseUrl?: string;
}

export interface AdapterCapabilities {
  webhooks: boolean;
  poll: boolean;
  comments: boolean;
  attachments: boolean;
  oauth: boolean;
}

/**
 * Every external PM-tool integration implements this interface and registers
 * with the IntegrationService, which is the only caller of adapters. Adding a
 * new SaaS means adding a new adapter — no core changes.
 */
export interface IntegrationAdapter {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  capabilities: AdapterCapabilities;

  testConnection(cfg: AdapterConfig): Promise<{ ok: true } | { ok: false; error: string }>;

  createExternalTask(task: Task, cfg: AdapterConfig): Promise<ExternalLink>;
  updateExternalTask(
    link: { externalId: string },
    task: Task,
    cfg: AdapterConfig,
  ): Promise<ExternalLink>;
  deleteExternalTask(link: { externalId: string }, cfg: AdapterConfig): Promise<void>;

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
  parseWebhook(payload: unknown, cfg: AdapterConfig): Promise<InboundEvent[]>;
  listChangedSince?(since: Date, cfg: AdapterConfig): Promise<InboundEvent[]>;
}
