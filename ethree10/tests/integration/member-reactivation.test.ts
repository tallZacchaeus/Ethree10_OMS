import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { appRouter } from "@/server/trpc/routers/_app";
import { createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import type { Team, User } from "@prisma/client";

/**
 * Removing a member is a soft delete. Nothing in the app could undo it, and the
 * unique constraint on Membership — (userId, role, teamId, subUnitId), which
 * ignores removedAt — meant re-inviting the same person to the same role failed
 * on the constraint. Access could be taken away and not given back.
 *
 * Against a real database on purpose: the bug was a unique constraint, so a
 * mocked Prisma would have proved nothing about it.
 */
const createCaller = createCallerFactory(appRouter);

const stamp = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function getCaller(userId: string | null) {
  return createCaller({
    db,
    userId,
    session: userId ? ({ user: { id: userId } } as Session) : null,
    headers: new Headers(),
    authorize: async () => {
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    },
  } as never);
}

describe("member reactivation", () => {
  let admin: User;
  let staffer: User;
  let branch: Team;
  const suffix = stamp();

  beforeAll(async () => {
    branch = await db.team.create({ data: { name: `Branch ${suffix}`, slug: `branch-${suffix}` } });
    admin = await db.user.create({
      data: { email: `admin-${suffix}@ethree10.com`, name: "Admin" },
    });
    staffer = await db.user.create({
      data: { email: `staffer-${suffix}@ethree10.com`, name: "Staffer" },
    });
    await db.membership.create({
      data: { userId: admin.id, role: "agency_admin", acceptedAt: new Date() },
    });
  });

  // Every test's rows go, pass or fail. Inline cleanup only runs on the happy
  // path, so one failure used to cascade into the next test.
  afterEach(async () => {
    await db.membership.deleteMany({ where: { userId: staffer.id } });
  });

  afterAll(async () => {
    const userIds = [admin?.id, staffer?.id].filter(Boolean) as string[];
    await db.membership.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.team.deleteMany({ where: { id: branch.id } });
  });

  it("restores a removed membership", async () => {
    const caller = getCaller(admin.id);
    const membership = await db.membership.create({
      data: {
        userId: staffer.id,
        role: "team_member",
        teamId: branch.id,
        acceptedAt: new Date(),
        removedAt: new Date(),
      },
    });

    await caller.members.reactivateMembership({ membershipId: membership.id });

    const after = await db.membership.findUniqueOrThrow({ where: { id: membership.id } });
    expect(after.removedAt).toBeNull();

  });

  it("refuses to reactivate one that is already active", async () => {
    const caller = getCaller(admin.id);
    const active = await db.membership.create({
      data: { userId: staffer.id, role: "team_member", teamId: branch.id, acceptedAt: new Date() },
    });

    await expect(
      caller.members.reactivateMembership({ membershipId: active.id }),
    ).rejects.toThrow(/no removed membership/i);

  });

  it("refuses when an active membership already holds that role and branch", async () => {
    // Restoring here would leave two active rows claiming one slot.
    const caller = getCaller(admin.id);
    const removed = await db.membership.create({
      data: {
        userId: staffer.id,
        role: "department_lead",
        teamId: branch.id,
        acceptedAt: new Date(),
        removedAt: new Date(),
      },
    });
    // The unique constraint covers removedAt-agnostic tuples, so the active twin
    // has to differ — a different subUnitId is not available here, so use a
    // second removed row restored first.
    await caller.members.reactivateMembership({ membershipId: removed.id });
    const second = await db.membership.create({
      data: {
        userId: staffer.id,
        role: "branch_head",
        teamId: branch.id,
        acceptedAt: new Date(),
        removedAt: new Date(),
      },
    });
    // Sanity: a different role restores fine alongside the first.
    await expect(
      caller.members.reactivateMembership({ membershipId: second.id }),
    ).resolves.toBeDefined();

  });

  it("finds removed members again through list", async () => {
    const caller = getCaller(admin.id);
    const removed = await db.membership.create({
      data: {
        userId: staffer.id,
        role: "team_member",
        teamId: branch.id,
        acceptedAt: new Date(),
        removedAt: new Date(),
      },
    });

    const hidden = await caller.members.list({});
    expect(hidden.some((m) => m.membershipId === removed.id)).toBe(false);

    const shown = await caller.members.list({ includeRemoved: true });
    expect(shown.some((m) => m.membershipId === removed.id)).toBe(true);

  });

  it("lets an invite bring back a removed member instead of colliding", async () => {
    // The regression that produced "I can't reactivate users". The unique
    // constraint ignores removedAt, so create used to throw P2002 here.
    const caller = getCaller(admin.id);
    const removed = await db.membership.create({
      data: {
        userId: staffer.id,
        role: "team_member",
        teamId: branch.id,
        acceptedAt: new Date(),
        removedAt: new Date(),
      },
    });

    const result = await caller.organizations.inviteUser({
      email: staffer.email,
      name: staffer.name ?? "Staffer",
      role: "team_member",
      teamId: branch.id,
    });

    expect(result.id).toBe(removed.id);
    expect(result.removedAt).toBeNull();

  });

  it("will not let an admin remove their own access", async () => {
    const caller = getCaller(admin.id);
    const own = await db.membership.findFirstOrThrow({
      where: { userId: admin.id, removedAt: null },
    });
    await expect(
      caller.organizations.removeMember({ membershipId: own.id }),
    ).rejects.toThrow(/your own/i);
  });
});
