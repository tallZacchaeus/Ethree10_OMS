import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/routers/_app";
import { createCallerFactory } from "@/server/trpc/trpc";
import type { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import type { User } from "@prisma/client";

/**
 * The WhatsApp verification code was six digits from Math.random, with no
 * expiry and no cap on guesses. Switching it to the CSPRNG on its own would
 * have been cosmetic: a million possibilities and unlimited attempts is a
 * an afternoon's work regardless of how the number was drawn, and a code that
 * never expires gives an attacker every attempt that will ever be made.
 *
 * Against a real database because the attempt cap is the shared, DB-backed
 * limiter — a mock would have tested the mock.
 */
const createCaller = createCallerFactory(appRouter);

const stamp = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function getCaller(userId: string) {
  return createCaller({
    db,
    userId,
    session: { user: { id: userId } } as Session,
    headers: new Headers(),
    authorize: async () => {},
  } as never);
}

describe("phone verification", () => {
  let user: User;
  const suffix = stamp();

  beforeAll(async () => {
    user = await db.user.create({
      data: { email: `phone-${suffix}@ethree10.com`, name: "Phone" },
    });
  });

  // The limiter is keyed on the user, so one test's guesses would otherwise
  // spend the next test's budget.
  afterEach(async () => {
    await db.publicRateLimit.deleteMany({});
    vi.useRealTimers();
  });

  afterAll(async () => {
    await db.publicRateLimit.deleteMany({});
    await db.user.deleteMany({ where: { id: user.id } });
  });

  it("accepts the right code while it is live", async () => {
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: "123456",
        phoneVerificationExpiresAt: new Date(Date.now() + 60_000),
        phoneVerifiedAt: null,
      },
    });

    await getCaller(user.id).whatsapp.verifyCode({ code: "123456" });

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerifiedAt).not.toBeNull();
    // The code is spent, so a replay of the same message cannot verify again.
    expect(after.phoneVerificationCode).toBeNull();
    expect(after.phoneVerificationExpiresAt).toBeNull();
  });

  it("refuses the right code once it has expired", async () => {
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: "654321",
        phoneVerificationExpiresAt: new Date(Date.now() - 1000),
        phoneVerifiedAt: null,
      },
    });

    await expect(
      getCaller(user.id).whatsapp.verifyCode({ code: "654321" }),
    ).rejects.toThrow(/invalid or expired/i);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerifiedAt).toBeNull();
  });

  it("treats a code with no expiry recorded as expired, not as valid forever", async () => {
    // Rows written before the expiry column existed. Defaulting these to valid
    // would leave exactly the hole this change closes.
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: "111111",
        phoneVerificationExpiresAt: null,
        phoneVerifiedAt: null,
      },
    });

    await expect(
      getCaller(user.id).whatsapp.verifyCode({ code: "111111" }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("stops a brute force after ten guesses in the hour", async () => {
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: "999999",
        phoneVerificationExpiresAt: new Date(Date.now() + 600_000),
        phoneVerifiedAt: null,
      },
    });
    const caller = getCaller(user.id);

    for (let i = 0; i < 10; i++) {
      const guess = String(100000 + i);
      await expect(caller.whatsapp.verifyCode({ code: guess })).rejects.toThrow(
        /invalid or expired/i,
      );
    }

    // The eleventh is refused before the code is even compared, so a correct
    // guess arriving after the budget is spent still does not verify.
    await expect(caller.whatsapp.verifyCode({ code: "999999" })).rejects.toThrow(
      /too many requests/i,
    );

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerifiedAt).toBeNull();
  });

  it("does not let a wrong guess reveal whether a code is live", async () => {
    // Wrong, missing and expired must be indistinguishable — otherwise the
    // error message tells an attacker when it is worth guessing.
    await db.user.update({
      where: { id: user.id },
      data: { phoneVerificationCode: null, phoneVerificationExpiresAt: null },
    });
    const missing = await getCaller(user.id)
      .whatsapp.verifyCode({ code: "222222" })
      .catch((e: TRPCError) => e.message);

    await db.publicRateLimit.deleteMany({});
    await db.user.update({
      where: { id: user.id },
      data: {
        phoneVerificationCode: "333333",
        phoneVerificationExpiresAt: new Date(Date.now() + 600_000),
      },
    });
    const wrong = await getCaller(user.id)
      .whatsapp.verifyCode({ code: "222222" })
      .catch((e: TRPCError) => e.message);

    expect(missing).toBe(wrong);
  });
});
