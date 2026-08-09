import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Skill, type SubUnit, type Team, type User } from "@prisma/client";
import type { Session } from "next-auth";
import { TRPCError } from "@trpc/server";
import { AuthorizationService } from "@/server/services/authorization";
import { scopedDb } from "@/server/db/client";
import { appRouter } from "@/server/trpc/routers/_app";
import { createCallerFactory } from "@/server/trpc/trpc";

/**
 * Covers the org-administration surface a super admin or agency admin relies on:
 * changing roles, assigning branch and department leads, archiving structure,
 * and the skill taxonomy.
 *
 * The role-change case is the important one. `organizations.changeRole` had the
 * separation-of-duties guard, but `members.updateMembership` — the mutation the
 * People screen actually calls — did not, so the control could be walked around
 * through ordinary admin use.
 */

const db = new PrismaClient();
const createCaller = createCallerFactory(appRouter);

function getCaller(userId: string | null) {
  return createCaller({
    db,
    scopedDb,
    userId,
    session: userId ? ({ user: { id: userId } } as Session) : null,
    headers: new Headers(),
    authorize: async (action: string) => {
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return AuthorizationService.require(
        userId,
        action as Parameters<typeof AuthorizationService.require>[1],
      );
    },
  });
}

const stamp = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("Org administration: roles, leads, structure, skills", () => {
  let admin: User;
  let head: User;
  let staffer: User;
  let branch: Team;
  let department: SubUnit;
  let skill: Skill;
  let headMembershipId: string;
  let stafferMembershipId: string;

  beforeAll(async () => {
    const suffix = stamp();
    branch = await db.team.create({
      data: { name: `Tech & Product ${suffix}`, slug: `tp-${suffix}` },
    });
    department = await db.subUnit.create({
      data: { teamId: branch.id, name: `Engineering ${suffix}`, slug: `eng-${suffix}` },
    });

    const makeUser = (label: string) =>
      db.user.create({ data: { email: `${label}-${suffix}@ethree10.com`, name: label } });
    admin = await makeUser("admin");
    head = await makeUser("head");
    staffer = await makeUser("staffer");

    await db.membership.create({
      data: { userId: admin.id, role: "agency_admin", acceptedAt: new Date() },
    });
    const headMembership = await db.membership.create({
      data: { userId: head.id, role: "branch_head", teamId: branch.id, acceptedAt: new Date() },
    });
    const stafferMembership = await db.membership.create({
      data: {
        userId: staffer.id,
        role: "team_member",
        teamId: branch.id,
        subUnitId: department.id,
        acceptedAt: new Date(),
      },
    });
    headMembershipId = headMembership.id;
    stafferMembershipId = stafferMembership.id;
  });

  afterAll(async () => {
    const userIds = [admin?.id, head?.id, staffer?.id].filter(Boolean) as string[];
    if (userIds.length) {
      await db.userSkill.deleteMany({ where: { userId: { in: userIds } } });
      await db.membership.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (skill?.id) await db.skill.deleteMany({ where: { id: skill.id } });
    if (department?.id) await db.subUnit.deleteMany({ where: { id: department.id } });
    if (branch?.id) await db.team.deleteMany({ where: { id: branch.id } });
    await db.$disconnect();
  });

  describe("changing a role", () => {
    it("promotes a team member through the People screen's own mutation", async () => {
      const caller = getCaller(admin.id);
      const updated = await caller.members.updateMembership({
        membershipId: stafferMembershipId,
        name: staffer.name,
        role: "department_lead",
        title: "Engineering Lead",
        teamId: branch.id,
        subUnitId: department.id,
      });
      expect(updated.role).toBe("department_lead");
    });

    it("demotes them again", async () => {
      const caller = getCaller(admin.id);
      const updated = await caller.members.updateMembership({
        membershipId: stafferMembershipId,
        name: staffer.name,
        role: "team_member",
        title: null,
        teamId: branch.id,
        subUnitId: department.id,
      });
      expect(updated.role).toBe("team_member");
    });

    it("refuses to make one person both Chief Executive and Finance Manager", async () => {
      const caller = getCaller(admin.id);
      const suffix = stamp();
      const exec = await db.user.create({
        data: { email: `exec-${suffix}@ethree10.com`, name: "Exec" },
      });
      const financeMembership = await db.membership.create({
        data: { userId: exec.id, role: "finance_manager", acceptedAt: new Date() },
      });
      const secondMembership = await db.membership.create({
        data: { userId: exec.id, role: "team_member", acceptedAt: new Date() },
      });

      try {
        // Promoting the second membership to chief_executive would leave this
        // person holding both halves of the money chain.
        await expect(
          caller.members.updateMembership({
            membershipId: secondMembership.id,
            name: "Exec",
            role: "chief_executive",
            title: null,
            teamId: null,
            subUnitId: null,
          }),
        ).rejects.toThrow(/separat|cannot|both/i);

        const unchanged = await db.membership.findUnique({
          where: { id: secondMembership.id },
          select: { role: true },
        });
        expect(unchanged?.role).toBe("team_member");
      } finally {
        await db.membership.deleteMany({
          where: { id: { in: [financeMembership.id, secondMembership.id] } },
        });
        await db.user.delete({ where: { id: exec.id } });
      }
    });

    it("still allows changing the role of someone who already holds one of the pair", async () => {
      const caller = getCaller(admin.id);
      // The guard must exclude the membership being edited, or a Finance Manager
      // could never be edited at all — it would collide with itself.
      const updated = await caller.members.updateMembership({
        membershipId: headMembershipId,
        name: head.name,
        role: "branch_head",
        title: "Branch Head",
        teamId: branch.id,
        subUnitId: null,
      });
      expect(updated.role).toBe("branch_head");
    });
  });

  describe("branch and department leads", () => {
    it("assigns, exposes and clears a branch lead", async () => {
      const caller = getCaller(admin.id);

      await caller.teams.update({ id: branch.id, leadId: head.id });
      let listed = (await caller.teams.list()).find((t) => t.id === branch.id);
      expect(listed?.lead?.name).toBe(head.name);

      await caller.teams.update({ id: branch.id, leadId: null });
      listed = (await caller.teams.list()).find((t) => t.id === branch.id);
      expect(listed?.leadId).toBeNull();
      expect(listed?.lead).toBeNull();
    });

    it("assigns a department lead and counts its people", async () => {
      const caller = getCaller(admin.id);
      await caller.subunits.update({ id: department.id, leadId: staffer.id });

      const listed = (await caller.teams.list()).find((t) => t.id === branch.id);
      const listedDepartment = listed?.subUnits.find((s) => s.id === department.id);
      expect(listedDepartment?.lead?.name).toBe(staffer.name);
      expect(listedDepartment?.memberCount).toBe(1);
    });

    it("refuses a lead who is not a member of the agency", async () => {
      const caller = getCaller(admin.id);
      const outsider = await db.user.create({
        data: { email: `outsider-${stamp()}@example.com`, name: "Outsider" },
      });
      try {
        await expect(
          caller.teams.update({ id: branch.id, leadId: outsider.id }),
        ).rejects.toThrow(/current member/i);
      } finally {
        await db.user.delete({ where: { id: outsider.id } });
      }
    });

    it("renames a branch without changing its slug", async () => {
      const caller = getCaller(admin.id);
      const renamed = await caller.teams.update({ id: branch.id, name: "Tech and Product" });
      expect(renamed.name).toBe("Tech and Product");
      expect(renamed.slug).toBe(branch.slug);
    });
  });

  describe("archiving", () => {
    it("refuses to archive a branch that still has people", async () => {
      const caller = getCaller(admin.id);
      await expect(caller.teams.archive({ id: branch.id })).rejects.toThrow(/still has/i);

      const stillActive = await db.team.findUnique({
        where: { id: branch.id },
        select: { archivedAt: true },
      });
      expect(stillActive?.archivedAt).toBeNull();
    });

    it("archives an empty department, and it stops being listed", async () => {
      const caller = getCaller(admin.id);
      const suffix = stamp();
      const empty = await db.subUnit.create({
        data: { teamId: branch.id, name: `Empty ${suffix}`, slug: `empty-${suffix}` },
      });

      await caller.subunits.archive({ id: empty.id });

      const listed = (await caller.teams.list()).find((t) => t.id === branch.id);
      expect(listed?.subUnits.some((s) => s.id === empty.id)).toBe(false);

      await db.subUnit.delete({ where: { id: empty.id } });
    });

    it("refuses to archive a department that still has people", async () => {
      const caller = getCaller(admin.id);
      await expect(caller.subunits.archive({ id: department.id })).rejects.toThrow(/still has/i);
    });
  });

  describe("skills", () => {
    it("creates a skill and rejects a duplicate name regardless of case", async () => {
      const caller = getCaller(admin.id);
      skill = await caller.skills.create({
        name: `Motion Design ${stamp()}`,
        category: "Design",
      });
      expect(skill.category).toBe("Design");

      await expect(
        caller.skills.create({ name: skill.name.toUpperCase() }),
      ).rejects.toThrow(/already exists/i);
    });

    it("records skills against a person and reads them back", async () => {
      const caller = getCaller(admin.id);
      await caller.skills.setForUser({
        userId: staffer.id,
        skills: [{ skillId: skill.id, level: "advanced" }],
      });

      const recorded = await caller.skills.forUser({ userId: staffer.id });
      expect(recorded).toHaveLength(1);
      expect(recorded[0]?.level).toBe("advanced");

      const listed = await caller.skills.list();
      expect(listed.find((s) => s.id === skill.id)?.peopleCount).toBe(1);
    });

    it("refuses to delete a skill that people hold unless forced", async () => {
      const caller = getCaller(admin.id);
      await expect(caller.skills.remove({ id: skill.id })).rejects.toThrow(/recorded against/i);

      const survived = await db.skill.findUnique({ where: { id: skill.id } });
      expect(survived).not.toBeNull();
    });

    it("lets a team member set their own skills but not someone else's", async () => {
      const selfCaller = getCaller(staffer.id);
      await expect(
        selfCaller.skills.setForUser({ userId: staffer.id, skills: [] }),
      ).resolves.toEqual({ count: 0 });

      await expect(
        selfCaller.skills.setForUser({
          userId: head.id,
          skills: [{ skillId: skill.id, level: "expert" }],
        }),
      ).rejects.toThrow();
    });

    it("refuses to record a skill that no longer exists", async () => {
      const caller = getCaller(admin.id);
      await expect(
        caller.skills.setForUser({
          userId: staffer.id,
          skills: [{ skillId: "does-not-exist", level: "expert" }],
        }),
      ).rejects.toThrow(/no longer exists/i);
    });
  });
});
