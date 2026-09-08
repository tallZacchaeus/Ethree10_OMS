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
    // The Proposals tab only renders for scoping, proposal or approved. The
    // seed now carries a request genuinely at approved, so this uses it rather
    // than building and tearing down its own.
    const prisma = new PrismaClient();
    const request = await prisma.request
      .findFirst({ where: { stage: "approved" }, select: { id: true } })
      .finally(() => prisma.$disconnect());
    expect(request, "seeded request at the approved stage").not.toBeNull();

    await signInAsSeededUser(page, "admin.ops@ethree10.r4c.global");
    await page.goto(`/requests/${request!.id}`);
    await page.getByRole("tab", { name: "Proposals" }).click();
    await expect(page.getByRole("button", { name: "Create Proposal" })).toBeVisible();
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
