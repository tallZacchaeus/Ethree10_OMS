import { db } from "@/server/db/client";
import { RequestService } from "@/server/services/request";
import { ProjectService } from "@/server/services/project";
import { TaskService } from "@/server/services/task";
import { ExecutionService } from "@/server/services/execution";
import { ClientTrackingService } from "@/server/services/client-tracking";
import type { NotificationKind } from "@prisma/client";

const staffEmails = {
  admin: "admin.ops@ethree10.r4c.global",
  branchHead: "techlead@ethree10.r4c.global",
  member: "member@ethree10.r4c.global",
};

const emailNoisyKinds: NotificationKind[] = [
  "request_submitted",
  "request_assigned",
  "request_state_changed",
  "task_assigned",
  "task_completed",
  "deliverable_created",
  "deliverable_version_added",
  "contributors_changed",
  "assignment_proposed",
  "assignment_approved",
  "assignment_rejected",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function userByEmail(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  assert(user, `Missing seeded user: ${email}`);
  return user;
}

async function main() {
  const [admin, branchHead, member] = await Promise.all([
    userByEmail(staffEmails.admin),
    userByEmail(staffEmails.branchHead),
    userByEmail(staffEmails.member),
  ]);

  const notificationRecipients = await db.user.findMany({
    where: {
      OR: [
        { isSuperAdmin: true },
        {
          memberships: {
            some: {
              role: { in: ["agency_admin", "branch_head", "department_lead", "team_member"] },
              acceptedAt: { not: null },
              removedAt: null,
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  await db.notificationPreference.createMany({
    data: notificationRecipients.flatMap((user) =>
      emailNoisyKinds.map((kind) => ({
        userId: user.id,
        kind,
        email: false,
        push: true,
        whatsapp: false,
      })),
    ),
    skipDuplicates: true,
  });

  const team = await db.team.findFirst({
    where: {
      memberships: {
        some: { userId: branchHead.id, role: "branch_head", acceptedAt: { not: null }, removedAt: null },
      },
    },
    select: { id: true, name: true },
  });
  assert(team, "Missing branch head team.");

  const subUnit = await db.subUnit.findFirst({
    where: { teamId: team.id, memberships: { some: { userId: member.id, acceptedAt: { not: null }, removedAt: null } } },
    select: { id: true, name: true },
  });
  assert(subUnit, "Missing seeded delivery department.");

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const request = await RequestService.createPublic({
    requesterName: "Cycle Test Client",
    requesterEmail: `cycle-test-${stamp}@example.test`,
    organizationName: `Cycle Test Org ${stamp}`,
    input: {
      title: `End-to-end cycle smoke ${stamp}`,
      description: "Verify that a public request can become reviewed work and a client-accepted delivery.",
      projectType: "workflow_test",
      urgency: "medium",
      expectedDeliverables: "A client-visible completion link and acceptance record.",
      consentToEmail: false,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  assert(request.publicToken, "Public request did not receive a tracking token.");

  const trackingAtSubmission = ClientTrackingService.project(
    await ClientTrackingService.findRequest(request.publicToken),
  );
  assert(trackingAtSubmission.stage === "submitted", "Tracking page did not show the submitted request.");

  await RequestService.route({ actorId: admin.id, requestId: request.id, teamId: team.id, note: "Smoke test routing." });
  await RequestService.approve({ actorId: branchHead.id, requestId: request.id });
  await RequestService.transition({
    actorId: branchHead.id,
    requestId: request.id,
    toStage: "in_progress",
    note: "Smoke test delivery started.",
  });

  const project = await db.project.findUnique({ where: { requestId: request.id }, select: { id: true, code: true, status: true } });
  assert(project, "Approved request did not create a project.");
  assert(project.status === "active", `Expected active project after approval, got ${project.status}.`);

  const task = await TaskService.create({
    actorId: branchHead.id,
    input: {
      projectId: project.id,
      title: "Prepare client-visible delivery",
      description: "Create the smoke-test deliverable and send it for review.",
      acceptanceCriteria: "Client-visible link exists and task is approved by the branch head.",
      subUnitId: subUnit.id,
      assigneeUserId: member.id,
      priority: "medium",
      estimatedHours: 1,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  await TaskService.transition({ actorId: member.id, taskId: task.id, toStatus: "in_progress" });
  await ExecutionService.createDeliverable({
    actorId: member.id,
    taskId: task.id,
    title: "Smoke-test delivery link",
    kind: "link",
    visibility: "client",
    url: "https://example.test/delivery",
    notes: "Created by the request-cycle smoke test.",
  });
  await TaskService.submitCompletion({
    actorId: member.id,
    taskId: task.id,
    summary: "Client-visible delivery prepared.",
    evidence: "https://example.test/delivery",
    hoursLogged: 1,
  });
  const reviewed = await TaskService.review({
    actorId: branchHead.id,
    taskId: task.id,
    decision: "accept",
    reviewType: "branch_head",
    note: "Smoke test approval.",
  });
  assert(reviewed.status === "done", `Expected task to be done after branch-head approval, got ${reviewed.status}.`);

  const delivered = await ProjectService.deliver({ actorId: branchHead.id, projectId: project.id });
  assert(delivered.status === "delivered", `Expected delivered project, got ${delivered.status}.`);

  const trackingAtDelivery = ClientTrackingService.project(
    await ClientTrackingService.findRequest(request.publicToken),
  );
  assert(trackingAtDelivery.stage === "delivered", "Tracking page did not move to delivered.");
  assert(trackingAtDelivery.canReviewDelivery, "Tracking page did not allow client delivery review.");
  assert(trackingAtDelivery.deliverables.length === 1, "Tracking page did not expose the client-visible deliverable.");

  const clientDecision = await ClientTrackingService.decide({
    token: request.publicToken,
    decision: "accepted",
    message: "Smoke test acceptance.",
  });
  assert(clientDecision.status === "closed", "Client acceptance did not close the delivery.");

  const finalRequest = await db.request.findUnique({ where: { id: request.id }, select: { stage: true } });
  const finalProject = await db.project.findUnique({ where: { id: project.id }, select: { status: true } });
  assert(finalRequest?.stage === "closed", `Expected closed request, got ${finalRequest?.stage}.`);
  assert(finalProject?.status === "closed", `Expected closed project, got ${finalProject?.status}.`);

  console.log("Request cycle smoke test passed.");
  console.log(`Request: ${request.code}`);
  console.log(`Project: ${project.code}`);
  console.log(`Team: ${team.name}`);
  console.log(`Department: ${subUnit.name}`);
  console.log("Stages: submitted -> under_review -> approved -> in_progress -> delivered -> closed");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
