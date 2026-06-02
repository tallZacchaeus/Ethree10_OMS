import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { Session } from "next-auth";
import { TRPCError } from "@trpc/server";
import { auth } from "@/server/auth";
import { db, scopedDb } from "@/server/db/client";
import { AuthorizationService } from "@/server/services/authorization";
import type { Action } from "@/server/auth/permissions";

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const session = (await auth()) as Session | null;
  const userId = session?.user?.id ?? null;
  const headers = opts.req.headers;
  const workspaceId = headers.get("x-workspace-id");

  return {
    db,
    session,
    userId,
    headers,
    workspaceId,
    scopedDb,
    authorize: createAuthorize(userId, workspaceId),
  };
}

function createAuthorize(userId: string | null, workspaceId: string | null) {
  return async function authorize(action: Action) {
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be signed in.",
      });
    }
    return AuthorizationService.require(userId, action, workspaceId);
  };
}
