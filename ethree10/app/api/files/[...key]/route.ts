import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { presignedUrl } from "@/lib/storage";
import { getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";
import { hasAgencyWideScope } from "@/server/auth/role-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only way a stored file is ever served.
 *
 * The bucket is private. Nothing is reachable by guessing a storage URL — every
 * request lands here, is checked against a per-prefix policy, and is then
 * redirected to a short-lived presigned URL.
 *
 * `STORAGE_PUBLIC_URL` points at this route, so `publicUrl(key)` — used by the
 * invoice and receipt PDF writers — resolves through it too. Before this existed
 * `STORAGE_PUBLIC_URL` pointed at `/files`, which nothing served, so every stored
 * PDF 404'd.
 */

/** How long a redirect stays valid. Short: these URLs get pasted into chats. */
const PRESIGN_TTL_SECONDS = 300;

type Access =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; message: string };

const DENY: Access = { ok: false, status: 403, message: "Forbidden" };

/**
 * Attachments are the sensitive case: they hang off tasks, requests and
 * deliverables, so access follows whoever can see the parent.
 *
 * Two ways in:
 *  - a signed-in staff member who can read the parent, or
 *  - a client holding the request's tracking token, but only for attachments on
 *    a deliverable marked client-visible.
 */
/**
 * The branch that owns an attachment, via whichever parent it hangs off.
 *
 * Attachment access used to be "any staff member holding task.read or
 * request.read", with no reference to the parent at all — so a Digital Media
 * member could fetch a Tech & Product file. The storage key is 9 random bytes,
 * so nobody was walking the space, but that is capability-URL secrecy, not
 * access control, and it did not match how the requests router scopes the same
 * data through visibleTeamIds. This makes the two agree.
 */
function owningTeamId(attachment: {
  request: { routedTeamId: string | null } | null;
  task: { project: { agencyTeamId: string | null } | null } | null;
  deliverableVersion: {
    deliverable: { task: { project: { agencyTeamId: string | null } | null } | null };
  } | null;
}): string | null {
  return (
    attachment.request?.routedTeamId ??
    attachment.task?.project?.agencyTeamId ??
    attachment.deliverableVersion?.deliverable.task?.project?.agencyTeamId ??
    null
  );
}

async function checkAttachment(key: string, token: string | null): Promise<Access> {
  const attachment = await db.attachment.findFirst({
    where: { storageKey: key },
    select: {
      id: true,
      taskId: true,
      requestId: true,
      request: { select: { routedTeamId: true } },
      task: { select: { project: { select: { agencyTeamId: true } } } },
      deliverableVersion: {
        select: {
          deliverable: {
            select: {
              visibility: true,
              task: { select: { projectId: true, project: { select: { agencyTeamId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!attachment) return { ok: false, status: 404, message: "File not found" };

  // Client route: a tracking token, and only for client-visible deliverables.
  if (token) {
    const visibility = attachment.deliverableVersion?.deliverable.visibility;
    if (visibility !== "client") return DENY;

    const request = await db.request.findFirst({
      where: { publicToken: token, publicTokenRevokedAt: null },
      select: { id: true, publicTokenExpiresAt: true, project: { select: { id: true } } },
    });
    if (!request) return DENY;
    if (request.publicTokenExpiresAt && request.publicTokenExpiresAt < new Date()) {
      return { ok: false, status: 403, message: "This tracking link has expired." };
    }
    // The attachment must belong to that request's project.
    const projectId = attachment.deliverableVersion?.deliverable.task.projectId;
    if (!projectId || projectId !== request.project?.id) return DENY;
    return { ok: true };
  }

  // Staff route.
  const session = await auth();
  if (!session?.user?.id) return { ok: false, status: 401, message: "Sign in required" };
  const ctx = await getAgencyAuthContext(session.user.id);
  if (!can(ctx, "task.read") && !can(ctx, "request.read")) return DENY;

  // Agency-wide roles see everything, exactly as they do in the requests list.
  if (hasAgencyWideScope(ctx)) return { ok: true };

  const teamId = owningTeamId(attachment);
  // An attachment whose parent has no branch cannot be placed, so it is not
  // shown to branch-scoped staff. Failing closed is right here: the alternative
  // is showing an unplaceable file to everyone.
  if (!teamId) return DENY;

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id, removedAt: null, acceptedAt: { not: null }, teamId },
    select: { id: true },
  });
  return memberships.length > 0 ? { ok: true } : DENY;
}

/** Reports can contain individual performance data. Staff only, with report.read. */
async function checkReport(): Promise<Access> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, status: 401, message: "Sign in required" };
  const ctx = await getAgencyAuthContext(session.user.id);
  return can(ctx, "report.read") ? { ok: true } : DENY;
}

/**
 * Invoice and receipt PDFs are already reachable from the public
 * `/invoice/[code]` and `/receipt/[code]` pages, which clients open without an
 * account. Serving the PDF at the same protection level is not a regression —
 * but it does mean the document code is the only secret, so codes must stay
 * random and unguessable.
 */
function checkBillingDocument(): Access {
  return { ok: true };
}

async function authorize(key: string, token: string | null): Promise<Access> {
  if (key.startsWith("attachments/")) return checkAttachment(key, token);
  if (key.startsWith("reports/")) return checkReport();
  if (key.startsWith("invoices/") || key.startsWith("receipts/")) return checkBillingDocument();
  // Anything unrecognised is denied rather than served by default.
  return DENY;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await context.params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  // Traversal guard — keys are built server-side, but this route takes a path
  // from the URL, so never trust it.
  if (key.includes("..") || key.startsWith("/")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const token = new URL(request.url).searchParams.get("token");

  try {
    const access = await authorize(key, token);
    if (!access.ok) {
      return new NextResponse(access.message, { status: access.status });
    }
    const url = await presignedUrl(key, PRESIGN_TTL_SECONDS);
    return NextResponse.redirect(url, 307);
  } catch (error) {
    console.error("File serve failed", key, error);
    return new NextResponse("Storage unavailable", { status: 502 });
  }
}
