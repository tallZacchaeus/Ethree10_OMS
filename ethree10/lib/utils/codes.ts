import { randomBytes } from "crypto";

const PREFIXES = {
  request: "REQ",
  project: "PRJ",
  task: "TSK",
  proposal: "PRP",
} as const;

type CodeType = keyof typeof PREFIXES;

const counters = new Map<string, number>();

function getCounter(key: string): number {
  const current = counters.get(key) ?? 0;
  counters.set(key, current + 1);
  return current + 1;
}

export function generateCode(type: CodeType, sequenceNumber?: number): string {
  const year = new Date().getUTCFullYear();
  const prefix = PREFIXES[type];
  const seq = sequenceNumber ?? getCounter(`${prefix}-${year}`);
  const padded = String(seq).padStart(type === "task" ? 5 : 4, "0");
  return `${prefix}-${year}-${padded}`;
}

/**
 * Unguessable capability token for public request-tracking links.
 * 24 random bytes → ~192 bits, URL-safe (no padding/special chars).
 */
export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export function parseCode(code: string): { type: CodeType; year: number; seq: number } | null {
  const match = code.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!match) return null;
  const [, prefix, yearStr, seqStr] = match;
  const type = (Object.entries(PREFIXES).find(([, p]) => p === prefix)?.[0] ?? null) as CodeType | null;
  if (!type) return null;
  return { type, year: Number(yearStr), seq: Number(seqStr) };
}
