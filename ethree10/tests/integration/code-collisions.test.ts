import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { TemplateService } from "@/server/services/template";
import { generateCode } from "@/lib/utils/codes";
import type { Organization, Project, Team, User } from "@prisma/client";

/**
 * The template applier used to number task codes from a count of tasks *in the
 * project being filled*, while formatting them as agency-wide codes. The first
 * project of a year worked; the second asked for TSK-<year>-00001 again and hit
 * the unique constraint, turning a valid action into a 500.
 *
 * These run against a real database because the bug is a unique constraint —
 * mocking Prisma would have proved nothing.
 */
const stamp = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("task code allocation across projects", () => {
  let org: Organization;
  let team: Team;
  let projectA: Project;
  let projectB: Project;
  let templateId: string;
  let author: User;
  const requestIds: string[] = [];
  const suffix = stamp();

  beforeAll(async () => {
    org = await db.organization.create({
      data: { name: `Org ${suffix}`, slug: `org-${suffix}` },
    });
    team = await db.team.create({ data: { name: `Team ${suffix}`, slug: `team-${suffix}` } });
    author = await db.user.create({
      data: { email: `author-${suffix}@ethree10.com`, name: "Author" },
    });

    // A project requires its own request — requestId is unique on Project.
    const makeProject = async (label: string) => {
      const request = await db.request.create({
        data: {
          code: `REQ-TEST-${label}-${suffix}`,
          organizationId: org.id,
          title: `Request ${label} ${suffix}`,
          description: "Fixture request",
          projectType: "creative",
        },
      });
      requestIds.push(request.id);
      return db.project.create({
        data: {
          code: `PRJ-TEST-${label}-${suffix}`,
          requestId: request.id,
          organizationId: org.id,
          agencyTeamId: team.id,
          name: `Project ${label} ${suffix}`,
          status: "active",
        },
      });
    };
    projectA = await makeProject("A");
    projectB = await makeProject("B");

    const template = await db.projectTemplate.create({
      data: {
        name: `Template ${suffix}`,
        projectType: "creative",
        createdById: author.id,
        tasks: [
          { title: "Kickoff", description: "Kick the project off" },
          { title: "Delivery", description: "Deliver the work" },
        ],
      },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    await db.task.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
    await db.projectTemplate.deleteMany({ where: { id: templateId } });
    await db.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
    await db.request.deleteMany({ where: { id: { in: requestIds } } });
    await db.team.deleteMany({ where: { id: team.id } });
    await db.user.deleteMany({ where: { id: author.id } });
    await db.organization.deleteMany({ where: { id: org.id } });
  });

  it("applies the same template to a second project without colliding", async () => {
    // This is the regression. Before the fix the second apply threw P2002 on
    // the unique `code` column, because both projects numbered from 1.
    await TemplateService.applyToProject({ actorId: author.id, projectId: projectA.id, templateId });
    await expect(
      TemplateService.applyToProject({ actorId: author.id, projectId: projectB.id, templateId }),
    ).resolves.toBeDefined();

    const codes = (
      await db.task.findMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
        select: { code: true },
      })
    ).map((task) => task.code);

    expect(codes).toHaveLength(4);
    expect(new Set(codes).size).toBe(4);
  });

  it("numbers tasks from the agency-wide sequence, not per project", async () => {
    const year = new Date().getUTCFullYear();
    const codes = (
      await db.task.findMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
        select: { code: true },
        orderBy: { code: "asc" },
      })
    ).map((task) => task.code);

    for (const code of codes) {
      expect(code.startsWith(`TSK-${year}-`)).toBe(true);
    }
    // Consecutive across both projects, which is what "agency-wide" means.
    const seqs = codes.map((code) => Number(code.split("-")[2]));
    expect(seqs[3]! - seqs[0]!).toBe(3);
  });

  it("does not reuse a sequence number after a task is deleted", async () => {
    // The old count-based helpers repeated a number as soon as a row was
    // removed, so the next create collided.
    const before = await db.task.findMany({
      where: { projectId: projectA.id },
      orderBy: { code: "desc" },
      take: 1,
      select: { id: true, code: true },
    });
    const highest = before[0]!;
    await db.task.delete({ where: { id: highest.id } });

    await TemplateService.applyToProject({ actorId: author.id, projectId: projectA.id, templateId });

    const codes = (
      await db.task.findMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
        select: { code: true },
      })
    ).map((task) => task.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain(highest.code);
  });

  it("formats a task code the way parseCode expects", () => {
    expect(generateCode("task", 42)).toMatch(/^TSK-\d{4}-00042$/);
  });
});
