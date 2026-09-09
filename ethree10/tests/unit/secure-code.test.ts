import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { secureCode, secureNumericCode } from "@/server/security/secure-code";
import { allocateRandomCode } from "@/server/services/code-allocator";
import { Prisma } from "@prisma/client";

/**
 * Invoice and receipt codes are bearer tokens: /invoice/<code>,
 * /api/invoices/<code>/pay and /receipt/<code> ask for nothing else. They used
 * to come from `Math.random().toString(36).substring(2, 10)`, which is both
 * predictable from a handful of observed outputs and not reliably eight
 * characters — base-36 rendering drops trailing zeros, so the slice came out at
 * seven roughly once in 118,000 draws (measured). The predictability is the
 * serious half; the length is the half that shows nobody chose it.
 */
describe("secureCode", () => {
  it("returns exactly the requested length, every time", () => {
    // The old generator did not — it came out one short about once in 118,000.
    // This is the half of the bug that had nothing to do with cryptography.
    for (let i = 0; i < 2000; i++) {
      expect(secureCode(12)).toHaveLength(12);
    }
    expect(secureCode(1)).toHaveLength(1);
    expect(secureCode(40)).toHaveLength(40);
  });

  it("defaults to 12 symbols — 60 bits", () => {
    expect(secureCode()).toHaveLength(12);
  });

  it("uses only unambiguous symbols", () => {
    // I, L, O and U are excluded so a code read off a printed invoice cannot be
    // confused with 1 or 0. If the alphabet is ever widened, this fails.
    const joined = Array.from({ length: 500 }, () => secureCode(16)).join("");
    expect(joined).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/);
    expect(joined).not.toMatch(/[ILOU]/);
  });

  it("reaches every symbol in the alphabet", () => {
    // Catches an off-by-one in the range that would quietly cost entropy by
    // never emitting the first or last symbol.
    const seen = new Set(Array.from({ length: 4000 }, () => secureCode(8)).join(""));
    expect(seen.size).toBe(32);
  });

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => secureCode()));
    expect(codes.size).toBe(5000);
  });

  it("refuses a length that is not a positive integer", () => {
    expect(() => secureCode(0)).toThrow(RangeError);
    expect(() => secureCode(-1)).toThrow(RangeError);
    expect(() => secureCode(2.5)).toThrow(RangeError);
  });
});

describe("secureNumericCode", () => {
  it("is always the full width, zero-padded", () => {
    // Without padding a draw of 42 becomes a two-digit code — a smaller search
    // space, handed out silently.
    for (let i = 0; i < 5000; i++) {
      const code = secureNumericCode(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("can produce a code in the padded range", () => {
    // Proves padding is exercised rather than merely present: over enough draws
    // some value below 100000 must appear, and it must still be six wide.
    const padded = Array.from({ length: 20000 }, () => secureNumericCode(6)).filter((c) =>
      c.startsWith("0"),
    );
    expect(padded.length).toBeGreaterThan(0);
    expect(padded.every((c) => c.length === 6)).toBe(true);
  });

  it("spans the whole digit range", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => secureNumericCode(6)).join(""));
    expect(seen.size).toBe(10);
  });

  it("refuses widths it cannot draw uniformly", () => {
    expect(() => secureNumericCode(0)).toThrow(RangeError);
    expect(() => secureNumericCode(16)).toThrow(RangeError);
  });
});

describe("allocateRandomCode", () => {
  const collision = () =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["code"] },
    });

  it("draws a fresh code after a collision instead of failing the caller", async () => {
    const tried: string[] = [];
    let calls = 0;
    const result = await allocateRandomCode({
      generate: () => `INV-${secureCode()}`,
      create: async (code) => {
        tried.push(code);
        if (++calls < 3) throw collision();
        return { code };
      },
    });
    expect(calls).toBe(3);
    expect(result.code).toBe(tried[2]);
    // Each retry must be a new draw, not the same code pushed at the database again.
    expect(new Set(tried).size).toBe(3);
  });

  it("does not retry a collision on some other unique column", async () => {
    // Retrying an organizationId conflict would just reproduce the failure with
    // a different code attached, hiding what actually went wrong.
    const other = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["invoiceId"] },
    });
    let calls = 0;
    await expect(
      allocateRandomCode({
        generate: () => secureCode(),
        create: async () => {
          calls++;
          throw other;
        },
      }),
    ).rejects.toBe(other);
    expect(calls).toBe(1);
  });

  it("gives up after the attempt budget and surfaces the last error", async () => {
    const err = collision();
    let calls = 0;
    await expect(
      allocateRandomCode({
        generate: () => secureCode(),
        create: async () => {
          calls++;
          throw err;
        },
        attempts: 3,
      }),
    ).rejects.toBe(err);
    expect(calls).toBe(3);
  });
});

describe("no security-bearing code comes from Math.random", () => {
  // A source check on purpose. The defect was not that one call site was wrong;
  // it was that reaching for Math.random looked normal in this codebase. This
  // fails the build if it comes back to any of the three places it lived.
  it.each([
    "server/trpc/routers/invoices.ts",
    "server/services/receipt.ts",
    "server/trpc/routers/whatsapp.ts",
  ])("%s", (relative) => {
    const source = readFileSync(join(process.cwd(), relative), "utf8");
    expect(source).not.toMatch(/Math\.random\s*\(/);
  });
});
