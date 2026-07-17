import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { ClientTrackingService } from "@/server/services/client-tracking";
import { ReportService, reportPeriodBounds } from "@/server/services/report";

const db = new PrismaClient();
const suffix = randomBytes(5).toString("hex");
const token = randomBytes(24).toString("base64url");

describe("Phase 4 and 5 integration", () => {
  let orgAId: string;
  let orgBId: string;
  let teamId: string;
  let userAId: string;
  let userBId: string;
  let requestId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    const [orgA, orgB, team, userA, userB] = await Promise.all([
      db.organization.create({ data: { name: `Phase45 A ${suffix}`, slug: `phase45-a-${suffix}`, isExternal: true } }),
      db.organization.create({ data: { name: `Phase45 B ${suffix}`, slug: `phase45-b-${suffix}`, isExternal: true } }),
      db.team.create({ data: { name: `Phase45 Team ${suffix}`, slug: `phase45-team-${suffix}` } }),
      db.user.create({ data: { name: "Contributor A", email: `phase45-a-${suffix}@example.com` } }),
      db.user.create({ data: { name: "Contributor B", email: `phase45-b-${suffix}@example.com` } }),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;
    teamId = team.id;
    userAId = userA.id;
    userBId = userB.id;

    const request = await db.request.create({
      data: {
        code: `REQ-P45-${suffix}`,
        publicToken: token,
        publicTokenExpiresAt: new Date("2027-07-17T00:00:00.000Z"),
        organizationId: orgA.id,
        title: "Public delivery",
        description: "Internal source brief that must not be projected.",
        projectType: "website",
        budgetEstimate: 900000,
        routedTeamId: team.id,
        requesterName: "Private Client Name",
        requesterEmail: `client-${suffix}@example.com`,
        stage: "delivered",
      },
    });
    requestId = request.id;
    await db.requestStageEvent.create({ data: { requestId, toStage: "delivered", note: "Work delivered for client review." } });
    const project = await db.project.create({
      data: { code: `PRJ-P45-${suffix}`, requestId, organizationId: orgA.id, agencyTeamId: team.id, name: "Public delivery", status: "delivered", actualDeliveryDate: new Date("2026-07-16T12:00:00.000Z") },
    });
    projectId = project.id;
    const task = await db.task.create({
      data: { code: `TSK-P45-${suffix}`, projectId, title: "Build the public delivery", status: "done", completedAt: new Date("2026-07-16T12:00:00.000Z"), dueDate: new Date("2026-07-17T12:00:00.000Z") },
    });
    taskId = task.id;
    await db.taskContributor.createMany({ data: [
      { taskId, userId: userA.id, contributionRole: "Frontend", isPrimary: true, assignedAt: new Date("2026-07-13T08:00:00.000Z") },
      { taskId, userId: userB.id, contributionRole: "Backend", assignedAt: new Date("2026-07-13T08:00:00.000Z") },
    ] });
    await db.timeLog.createMany({ data: [
      { taskId, userId: userA.id, hours: 3, date: new Date("2026-07-15T09:00:00.000Z") },
      { taskId, userId: userB.id, hours: 2, date: new Date("2026-07-15T09:00:00.000Z") },
    ] });
    const [clientDeliverable, privateDeliverable] = await Promise.all([
      db.deliverable.create({ data: { taskId, createdById: userA.id, title: "Approved site", kind: "link", visibility: "client" } }),
      db.deliverable.create({ data: { taskId, createdById: userB.id, title: "Private source", kind: "document", visibility: "internal" } }),
    ]);
    await db.deliverableVersion.createMany({ data: [
      { deliverableId: clientDeliverable.id, revision: 1, createdById: userA.id, url: "https://example.com/delivery", createdAt: new Date("2026-07-16T11:00:00.000Z") },
      { deliverableId: privateDeliverable.id, revision: 1, createdById: userB.id, content: "secret source", createdAt: new Date("2026-07-16T11:00:00.000Z") },
    ] });
  });

  afterAll(async () => {
    await db.report.deleteMany({ where: { OR: [{ scopeId: { in: [orgAId, orgBId, teamId, userAId, userBId] } }, { scopeId: "agency" }] } });
    await db.clientDecision.deleteMany({ where: { projectId } });
    await db.task.deleteMany({ where: { project: { organizationId: { in: [orgAId, orgBId] } } } });
    await db.project.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await db.request.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await db.team.deleteMany({ where: { id: teamId } });
    await db.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await db.$disconnect();
  });

  it("returns only the whitelisted public projection and client-visible delivery", async () => {
    const projection = ClientTrackingService.project(await ClientTrackingService.findRequest(token));
    expect(projection.deliverables.map((item) => item.title)).toEqual(["Approved site"]);
    expect(projection).not.toHaveProperty("description");
    expect(projection).not.toHaveProperty("budgetEstimate");
    expect(projection).not.toHaveProperty("requesterEmail");
    expect(JSON.stringify(projection)).not.toContain("secret source");
  });

  it("rejects revoked capabilities without revealing the request", async () => {
    await db.request.update({ where: { id: requestId }, data: { publicTokenRevokedAt: new Date() } });
    await expect(ClientTrackingService.findRequest(token)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.request.update({ where: { id: requestId }, data: { publicTokenRevokedAt: null } });
  });

  it("a client change request reopens the correct revision", async () => {
    await ClientTrackingService.decide({ token, decision: "changes_requested", message: "Please revise the approved site." });
    const [project, request, task] = await Promise.all([
      db.project.findUniqueOrThrow({ where: { id: projectId } }),
      db.request.findUniqueOrThrow({ where: { id: requestId } }),
      db.task.findUniqueOrThrow({ where: { id: taskId } }),
    ]);
    expect(project.status).toBe("in_review");
    expect(project.clientRevision).toBe(2);
    expect(request.stage).toBe("in_review");
    expect(task.status).toBe("in_progress");
    expect(task.revision).toBe(2);
  });

  it("client acceptance closes only the token's project", async () => {
    const otherRequest = await db.request.create({ data: { code: `REQ-P45-OTHER-${suffix}`, organizationId: orgBId, title: "Other delivery", description: "Other client work", projectType: "website", stage: "delivered" } });
    const otherProject = await db.project.create({ data: { code: `PRJ-P45-OTHER-${suffix}`, requestId: otherRequest.id, organizationId: orgBId, name: "Other delivery", status: "delivered" } });
    await db.project.update({ where: { id: projectId }, data: { status: "delivered" } });
    await db.request.update({ where: { id: requestId }, data: { stage: "delivered" } });
    await ClientTrackingService.decide({ token, decision: "accepted" });
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status).toBe("closed");
    expect((await db.project.findUniqueOrThrow({ where: { id: otherProject.id } })).status).toBe("delivered");
  });

  it("builds isolated, idempotent multi-contributor reports and preserves finalization", async () => {
    await db.task.update({ where: { id: taskId }, data: { status: "done", completedAt: new Date("2026-07-16T12:00:00.000Z") } });
    const { periodStart, periodEnd } = reportPeriodBounds("weekly", new Date("2026-07-17T12:00:00.000Z"));
    const first = await ReportService.generate({ level: "organization", scopeId: orgAId }, "weekly", periodStart, periodEnd);
    const second = await ReportService.generate({ level: "organization", scopeId: orgAId }, "weekly", periodStart, periodEnd);
    expect(second.id).toBe(first.id);
    const metrics = second.metrics as unknown as { tasksCompleted: number; contributorCount: number; hoursLogged: number };
    expect(metrics).toMatchObject({ tasksCompleted: 1, contributorCount: 2, hoursLogged: 5 });
    expect(await db.reportContribution.count({ where: { reportId: first.id, type: "completion" } })).toBe(2);

    const isolated = await ReportService.generate({ level: "organization", scopeId: orgBId }, "weekly", periodStart, periodEnd);
    expect((isolated.metrics as unknown as { tasksCompleted: number }).tasksCompleted).toBe(0);

    await ReportService.finalize({ reportId: first.id, actorId: userAId });
    const regenerated = await ReportService.generate({ level: "organization", scopeId: orgAId }, "weekly", periodStart, periodEnd);
    expect(regenerated.status).toBe("finalized");
    expect(regenerated.metrics).toEqual(second.metrics);
  });
});
