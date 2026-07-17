type EventMap = Record<string, unknown>;

type Handler<T> = (payload: T) => void | Promise<void>;

class EventBus<TEvents extends EventMap = EventMap> {
  private readonly handlers = new Map<keyof TEvents, Set<Handler<unknown>>>();

  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler<unknown>);
    return () => {
      this.handlers.get(event)?.delete(handler as Handler<unknown>);
    };
  }

  async emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    const promises: Promise<void>[] = [];
    for (const handler of Array.from(set)) {
      const result = handler(payload);
      if (result instanceof Promise) promises.push(result);
    }
    await Promise.allSettled(promises);
  }
}

export type OmsEvents = {
  "request.created": { requestId: string; organizationId: string; createdById: string };
  "request.status_changed": { requestId: string; fromStatus: string; toStatus: string; changedById: string };
  "project.created": { projectId: string; organizationId: string; createdById: string };
  "task.assigned": { taskId: string; assigneeId: string; assignedById: string };
  "task.completed": { taskId: string; completedById: string };
  "member.invited": { email: string; organizationId: string; invitedById: string };
};

export const bus = new EventBus<OmsEvents>();
