import { createHmac, timingSafeEqual } from "crypto";
import type { Task } from "@prisma/client";
import type {
  AdapterConfig,
  ExternalLink,
  InboundEvent,
  IntegrationAdapter,
} from "@/server/integrations/core/types";

function apiBase(): string {
  return "https://api.trello.com/1";
}

function getAuthParams(cfg: AdapterConfig): string {
  const apiKey = cfg.secrets["apiKey"] ?? "";
  const token = cfg.secrets["apiToken"] ?? "";
  return `key=${apiKey}&token=${token}`;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

function hashTask(task: Task): string {
  return createHmac("sha1", "ethree10")
    .update(`${task.title}|${task.status}|${task.priority}|${task.dueDate?.toISOString() ?? ""}`)
    .digest("hex");
}

export const trelloAdapter: IntegrationAdapter = {
  provider: "trello",
  displayName: "Trello",
  description: "Sync tasks with Trello boards.",
  capabilities: { webhooks: true, poll: true, comments: true, attachments: false, oauth: true },

  async testConnection(cfg) {
    try {
      const res = await fetch(`${apiBase()}/members/me?${getAuthParams(cfg)}`, {
        headers: headers(),
      });
      if (!res.ok) {
        return { ok: false, error: `Trello responded ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  async createExternalTask(task, cfg) {
    const listId = String(cfg.config["listId"] ?? "");
    if (!listId) throw new Error("Trello listId not configured");

    const res = await fetch(`${apiBase()}/cards?${getAuthParams(cfg)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: task.title,
        desc: task.description ?? "",
        idList: listId,
        due: task.dueDate ? task.dueDate.toISOString() : null,
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Trello create failed: ${res.status}`);
    }
    
    const card = (await res.json()) as { id: string, shortUrl: string };
    return {
      externalId: card.id,
      externalUrl: card.shortUrl,
      hash: hashTask(task),
    };
  },

  async updateExternalTask(link, task, cfg) {
    const res = await fetch(`${apiBase()}/cards/${link.externalId}?${getAuthParams(cfg)}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        name: task.title,
        desc: task.description ?? "",
        due: task.dueDate ? task.dueDate.toISOString() : null,
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Trello update failed: ${res.status}`);
    }
    return { externalId: link.externalId, hash: hashTask(task) };
  },

  async deleteExternalTask(link, cfg) {
    await fetch(`${apiBase()}/cards/${link.externalId}?${getAuthParams(cfg)}`, {
      method: "DELETE",
      headers: headers(),
    });
  },

  verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature) return false;
    const callbackUrl = secret; // Trello uses callback URL + rawBody to verify
    const expected = createHmac("sha1", secret).update(rawBody + callbackUrl).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  async parseWebhook(payload) {
    const body = payload as any;
    
    const action = body.action;
    if (!action || !action.data || !action.data.card) return [];
    
    const externalId = action.data.card.id;
    let kind: InboundEvent["kind"] = "task_updated";

    if (action.type === "deleteCard") {
      kind = "task_deleted";
    } else if (action.type === "updateCard" && action.data.listAfter) {
      // Assuming moved to a "Done" list triggers completion.
      const doneListId = String(action.data.board?.config?.doneListId ?? "");
      if (doneListId && action.data.listAfter.id === doneListId) {
        kind = "task_completed";
      }
    } else if (action.type === "commentCard") {
      kind = "comment_added";
    }

    const event: InboundEvent = {
      externalEventId: action.id,
      externalId,
      kind,
      payload: (action.data ?? {}) as Record<string, unknown>,
      occurredAt: new Date(action.date),
    };
    return [event];
  },
};
