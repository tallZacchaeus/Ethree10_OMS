const STORAGE_KEY = "ethree10.activeWorkspaceId";

/**
 * The active workspace id is persisted in localStorage so it survives reloads
 * and is readable synchronously by the tRPC link, which attaches it as the
 * `x-workspace-id` header every workspace-scoped procedure requires.
 */
export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}
