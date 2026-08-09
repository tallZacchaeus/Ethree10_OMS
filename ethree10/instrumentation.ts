/**
 * Next.js instrumentation hook — runs once per server/edge runtime at boot.
 * This is where error monitoring gets initialised; without it `@sentry/nextjs`
 * was installed but never started.
 */
export async function register() {
  const { initMonitoring } = await import("@/lib/observability");
  initMonitoring(process.env["NEXT_RUNTIME"] === "edge" ? "edge" : "server");
}

/**
 * Server render and route-handler errors that would otherwise surface only as a
 * 500 in the browser.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string },
): Promise<void> {
  const { captureRequestError } = await import("@/lib/observability");
  captureRequestError(error, { path: request.path });
}
