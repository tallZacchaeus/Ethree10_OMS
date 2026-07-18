import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "@/server/trpc/trpc";
import { appRouter } from "@/server/trpc/routers/_app";
import { AuthorizationService } from "@/server/services/authorization";
import { scopedDb } from "@/server/db/client";

const db = new PrismaClient();
const createCaller = createCallerFactory(appRouter);
const stamp = Date.now();

function caller(userId: string) {
  return createCaller({
    db,
    scopedDb,
    userId,
    session: { user: { id: userId } } as never,
    headers: new Headers(),
    authorize: async (action) => AuthorizationService.require(userId, action),
  });
}

describe("Phase 3 execution controls", () => {
  let organizationId: string;
  let teamId: string;
  let otherTeamId: string;
  let headId: string;
  let memberId: string;
  let secondMemberId: string;
  let outsiderId: string;
  let taskId: string;

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Phase 3 Client", slug: `phase-3-client-${stamp}` } });
    organizationId = organization.id;
    const team = await db.team.create({ data: { name: "Phase 3 Product", slug: `phase-3-product-${stamp}` } });
    const otherTeam = await db.team.create({ data: { name: "Phase 3 Other", slug: `phase-3-other-${stamp}` } });
    teamId = team.id;
    otherTeamId = otherTeam.id;
    const [head, member, secondMember, outsider] = await Promise.all([
      db.user.create({ data: { email: `phase3-head-${stamp}@example.com`, name: "Phase 3 Head" } }),
      db.user.create({ data: { email: `phase3-member-${stamp}@example.com`, name: "Phase 3 Member" } }),
      db.user.create({ data: { email: `phase3-second-${stamp}@example.com`, name: "Phase 3 Second" } }),
      db.user.create({ data: { email: `phase3-outsider-${stamp}@example.com`, name: "Phase 3 Outsider" } }),
    ]);
    headId = head.id;
    memberId = member.id;
    secondMemberId = secondMember.id;
    outsiderId = outsider.id;
    await db.membership.createMany({ data: [
      { userId: headId, role: "team_head", teamId, acceptedAt: new Date() },
      { userId: memberId, role: "team_member", teamId, acceptedAt: new Date() },
      { userId: secondMemberId, role: "team_member", teamId, acceptedAt: new Date() },
      { userId: outsiderId, role: "team_member", teamId: otherTeamId, acceptedAt: new Date() },
    ] });
    const service = await db.service.create({
      data: { name: "Phase 3 QA Service", slug: `phase-3-qa-${stamp}`, teamId, requiredReviews: ["quality_assurance"] },
    });
    const request = await db.request.create({
      data: {
        code: `REQ-P3-${stamp}`,
        organizationId,
        title: "Phase 3 request",
        description: "Build and review accountable work",
        projectType: service.slug,
        serviceId: service.id,
        routedTeamId: teamId,
        stage: "in_progress",
      },
    });
    const project = await db.project.create({
      data: {
        code: `PRJ-P3-${stamp}`,
        requestId: request.id,
        organizationId,
        agencyTeamId: teamId,
        pmUserId: headId,
        name: request.title,
      },
    });
    const task = await db.task.create({
      data: {
        code: `TSK-P3-${stamp}`,
        projectId: project.id,
        title: "Versioned delivery",
        estimatedHours: 12,
        acceptanceCriteria: "QA and team-head reviews pass",
      },
    });
    taskId = task.id;
  });

  afterAll(async () => {
    await db.project.deleteMany({ where: { organizationId } });
    await db.request.deleteMany({ where: { organizationId } });
    await db.service.deleteMany({ where: { teamId } });
    await db.membership.deleteMany({ where: { userId: { in: [headId, memberId, secondMemberId, outsiderId] } } });
    await db.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await db.user.deleteMany({ where: { id: { in: [headId, memberId, secondMemberId, outsiderId] } } });
    await db.organization.delete({ where: { id: organizationId } });
    await db.$disconnect();
  });

  it("allows only a head to assign multiple eligible contributors with distinct roles", async () => {
    const result = await caller(headId).execution.setContributors({
      taskId,
      contributors: [
        { userId: memberId, contributionRole: "Backend engineer", isPrimary: true },
        { userId: secondMemberId, contributionRole: "Software tester" },
      ],
    });
    expect(result.map((item) => item.contributionRole)).toEqual(["Backend engineer", "Software tester"]);
    await expect(caller(memberId).execution.setContributors({
      taskId,
      contributors: [{ userId: memberId, contributionRole: "Self assigned" }],
    })).rejects.toThrow();
    await expect(caller(headId).execution.setContributors({
      taskId,
      contributors: [{ userId: outsiderId, contributionRole: "Wrong team" }],
    })).rejects.toThrow(/active member of the project team/);
  });

  it("uses real assignments and availability in workload calculations", async () => {
    const now = new Date();
    await caller(memberId).execution.recordAvailability({
      userId: memberId,
      type: "limited",
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 86_400_000),
      capacityPercent: 50,
      reason: "Training",
    });
    const workload = await caller(headId).execution.workload({ teamId });
    const member = workload.find((row) => row.userId === memberId);
    expect(member).toMatchObject({ availability: "limited", capacityPercent: 50, openTaskCount: 1 });
    expect(member?.remainingHours).toBe(12);
  });

  it("keeps deliverable versions and blocks final completion until required reviews pass", async () => {
    const deliverable = await caller(memberId).execution.createDeliverable({
      taskId,
      title: "API deployment",
      kind: "deployment",
      visibility: "client",
      url: "https://example.com/releases/1",
    });
    await caller(memberId).execution.addDeliverableVersion({
      deliverableId: deliverable.id,
      url: "https://example.com/releases/2",
      notes: "QA candidate",
    });
    await caller(memberId).tasks.submitCompletion({ taskId, summary: "Ready for review" });
    await expect(caller(memberId).tasks.review({ taskId, decision: "accept", reviewType: "team_head" })).rejects.toThrow();
    const revisionsRequired = await caller(headId).tasks.review({
      taskId,
      decision: "request_changes",
      reviewType: "team_head",
      note: "Address QA feedback",
    });
    expect(revisionsRequired).toMatchObject({ status: "in_progress", revision: 2 });
    await caller(memberId).tasks.submitCompletion({ taskId, summary: "Revision two is ready" });
    const afterHead = await caller(headId).tasks.review({ taskId, decision: "accept", reviewType: "team_head" });
    expect(afterHead.status).toBe("in_review");
    await expect(caller(headId).projects.deliver({ id: afterHead.projectId })).rejects.toThrow(/Every active task must pass review/);
    const afterQa = await caller(headId).tasks.review({ taskId, decision: "accept", reviewType: "quality_assurance" });
    expect(afterQa.status).toBe("done");
    const stored = await db.task.findUnique({ where: { id: taskId }, include: { deliverables: { include: { versions: true } }, reviews: true } });
    expect(stored?.deliverables[0]?.versions).toHaveLength(2);
    expect(stored?.reviews.map((review) => review.reviewType)).toEqual(["team_head", "team_head", "quality_assurance"]);
    const delivered = await caller(headId).projects.deliver({ id: stored!.projectId });
    expect(delivered.status).toBe("delivered");
  });
});
