import { Prisma } from "@prisma/client";

/**
 * Allocating a human-readable code without colliding.
 *
 * Every code in the system — REQ, PRJ, TSK — is "work out the next number, then
 * create the row". That is a read followed by a write with no lock between
 * them, so two concurrent creates read the same number and the second hits the
 * unique constraint on `code`. The user sees a 500 from a request that was
 * perfectly valid.
 *
 * The sequences were also derived three different ways. `nextRequestSeq` read
 * the highest existing code; `nextProjectSeq` and `nextTaskSeq` counted rows,
 * which silently repeats a number as soon as anything is deleted; and the
 * template applier counted rows *within one project* while formatting them as
 * agency-wide codes, so applying a template to any project after the first one
 * in a year collided immediately.
 *
 * This centralises the retry. The sequence lookup and the create are both
 * injected, so the loop is testable without a database.
 */

/** A unique-constraint violation on the `code` column, and nothing else. */
export function isCodeCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  // P2002 carries the offending fields. A collision on some *other* unique
  // column is a real error and must not be retried — retrying would just
  // produce the same failure with a different code attached, hiding the cause.
  const target = (error.meta as { target?: string[] | string } | undefined)?.target;
  const fields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return fields.length === 0 || fields.some((field) => field.toLowerCase().includes("code"));
}

export type AllocateArgs<T> = {
  /** Highest sequence number currently in use for this type and year. */
  nextSeq: () => Promise<number>;
  /** Render a sequence number as the code. */
  format: (seq: number) => string;
  /** Create the row. Must throw P2002 if the code is taken. */
  create: (code: string) => Promise<T>;
  /** Total tries, including the first. */
  attempts?: number;
};

export async function allocateWithCode<T>(args: AllocateArgs<T>): Promise<T> {
  const attempts = args.attempts ?? 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Re-reading the sequence each time is the point: a collision means someone
    // else took the number, so the next read should see their row and move past it.
    const seq = await args.nextSeq();
    const code = args.format(seq);
    try {
      return await args.create(code);
    } catch (error) {
      if (!isCodeCollision(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}
