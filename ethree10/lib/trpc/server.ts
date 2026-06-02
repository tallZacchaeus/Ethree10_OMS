import { createCallerFactory } from "@/server/trpc/trpc";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/context";

/**
 * Server-side tRPC caller for use in React Server Components and
 * route handlers.  Avoids an HTTP round-trip by calling procedures
 * directly in-process.
 */
export async function createServerCaller() {
  const context = await createTRPCContext({
    req: new Request("http://internal"),
    resHeaders: new Headers(),
    info: {
      calls: [],
      isBatchCall: false,
      connectionParams: null,
      accept: null,
      type: "unknown",
      signal: new AbortController().signal,
      url: null,
    },
  });
  const caller = createCallerFactory(appRouter)(context);
  return { caller };
}
