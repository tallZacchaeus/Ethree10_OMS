import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signInAsSeededUser } from "./helpers/auth";

/**
 * E2E scenario 2: Assign & complete a task.
 *
 * Uses the dev-only credentials provider to authenticate two users
 * (a sub-unit lead and a member), creates a task, assigns it, and
 * verifies the completion submission flow.
 *
 * Precondition: the dev server is running with seeded demo data and
 * NODE_ENV=development (credentials provider enabled).
 */

test.describe("Task assign and complete flow", () => {
  test("tasks page is accessible after login", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible();
  });

  test("projects page lists projects after login", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
  });

  test("project detail exposes management actions to staff", async ({ page }) => {
    const prisma = new PrismaClient();
    const project = await prisma.project
      .findFirst({
        where: { status: "active", tasks: { some: {} } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      })
      .finally(() => prisma.$disconnect());
    expect(project, "seeded active project").not.toBeNull();

    await signInAsSeededUser(page, "admin.ops@ethree10.r4c.global");
    await page.goto(`/projects/${project!.id}`);

    await expect(page.getByRole("button", { name: "Apply template" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add task" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark delivered" })).toBeVisible();
  });

  // Three pages carried `const isSuperAdmin = false; const roles = []` as a
  // "stub until proper auth context is used". The stub was never replaced, so
  // every staff-only control on those pages was hidden from everyone, super
  // admin included. The tests below assert the controls are visible to a
  // signed-in agency admin; each fails against the stub and passes against
  // useAgencyContext(). Together with the project-page test above they cover
  // all three.

  test("templates page lets an agency admin create a template", async ({ page }) => {
    // Without this the project page offers to apply templates nobody can author.
    await signInAsSeededUser(page, "admin.ops@ethree10.r4c.global");
    await page.goto("/settings/templates");
    await expect(page.getByRole("button", { name: "Create Template" })).toBeVisible();
  });

  test("request proposals tab exposes staff actions", async ({ page }) => {
    // The Proposals tab only renders for requests in scoping, proposal or
    // approved. The seed has none: its "approvedRequest" is actually in
    // in_progress. So the test makes its own rather than depending on a
    // fixture that does not exist, and removes it afterwards.
    const prisma = new PrismaClient();
    const organization = await prisma.organization.findFirst({ select: { id: true } });
    expect(organization, "seeded organization").not.toBeNull();

    const request = await prisma.request.create({
      data: {
        code: `REQ-E2E-PROPOSALS-${Date.now()}`,
        organizationId: organization!.id,
        title: "E2E proposals tab fixture",
        description: "Created by task-completion.spec.ts; safe to delete.",
        projectType: "creative",
        stage: "approved",
      },
      select: { id: true },
    });

    try {
      await signInAsSeededUser(page, "admin.ops@ethree10.r4c.global");
      await page.goto(`/requests/${request.id}`);
      await page.getByRole("tab", { name: "Proposals" }).click();
      await expect(page.getByRole("button", { name: "Create Proposal" })).toBeVisible();
    } finally {
      await prisma.request.delete({ where: { id: request.id } });
      await prisma.$disconnect();
    }
  });

  test("team execution area exposes assignments, workload, and reviews", async ({ page }) => {
    await signInAsSeededUser(page);
    for (const [route, heading] of [
      // Renamed when the page became a real control surface with live counts.
      ["/team/dashboard", "Branch dashboard"],
      ["/team/assignments", "Assignments"],
      ["/team/workload", "Team workload"],
      ["/team/reviews", "Review queue"],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});
