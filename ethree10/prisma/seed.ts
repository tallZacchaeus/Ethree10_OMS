import { PrismaClient, Role, RequestStage, Urgency, TaskStatus, TaskPriority } from "@prisma/client";
import { DEFAULT_TEAMS, TASK_TYPES, TEAM_SLUGS } from "../lib/request-types";
import { generatePublicToken } from "../lib/utils/codes";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  // ── Client organizations (the agency itself is implicit — staff have org-null memberships)
  const r4c = await prisma.organization.upsert({
    where: { slug: "reach4christ" },
    update: {},
    create: {
      name: "Reach4Christ Global",
      slug: "reach4christ",
      isExternal: false,
      description: "The master organization.",
    },
  });

  const incubator = await prisma.organization.upsert({
    where: { slug: "incubator" },
    update: {},
    create: { name: "The Incubator", slug: "incubator", isExternal: false },
  });

  await prisma.organization.upsert({
    where: { slug: "micah415" },
    update: {},
    create: { name: "Micah 415", slug: "micah415", isExternal: false },
  });

  await prisma.organization.upsert({
    where: { slug: "mmpraise" },
    update: {},
    create: { name: "MMPraise", slug: "mmpraise", isExternal: false },
  });

  // ── Super-admin user (agency staff = org-null membership) ────────────────
  const adminEmail = process.env["SEED_SUPER_ADMIN_EMAIL"] ?? "admin@ethree10.r4c.global";
  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isSuperAdmin: true },
    create: {
      email: adminEmail,
      name: "Zacchaeus James",
      isSuperAdmin: true,
      timezone: "Africa/Lagos",
    },
  });

  // findFirst + create to avoid the null-composite-key Prisma limitation
  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId: superAdmin.id,
      role: Role.super_admin,
      teamId: null,
      subUnitId: null,
    },
  });
  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        userId: superAdmin.id,
        role: Role.super_admin,
        isPrimary: true,
        acceptedAt: new Date(),
      },
    });
  }

  // ── Departments (agency-global) ─────────────────────────────────────────
  const teamsBySlug: Record<string, { id: string }> = {};
  for (const team of DEFAULT_TEAMS) {
    teamsBySlug[team.slug] = await prisma.team.upsert({
      where: { slug: team.slug },
      update: { name: team.name, description: team.description, color: team.color },
      create: {
        name: team.name,
        slug: team.slug,
        description: team.description,
        color: team.color,
        leadId: superAdmin.id,
      },
    });
  }
  const productTech = teamsBySlug[TEAM_SLUGS.productDevelopment];
  if (!productTech) throw new Error("Seed failed: Product Development department missing.");

  // ── Configurable service catalogue ─────────────────────────────────────
  for (const service of TASK_TYPES) {
    const team = teamsBySlug[service.teamSlug];
    if (!team) throw new Error(`Seed failed: team missing for service ${service.value}.`);
    await prisma.service.upsert({
      where: { slug: service.value.replace(/_/g, "-") },
      update: { name: service.label, teamId: team.id, isActive: true },
      create: {
        name: service.label,
        slug: service.value.replace(/_/g, "-"),
        teamId: team.id,
        description: `Ethree10 ${service.label.toLowerCase()} service.`,
        requiredBriefFields: ["expectedOutcome", "expectedDeliverables", "acceptanceCriteria"],
        expectedDeliverables: [],
        defaultUrgency: "medium",
        defaultSlaHours: 72,
        requiredReviews: service.teamSlug === TEAM_SLUGS.productDevelopment ? ["quality_assurance"] : [],
      },
    });
  }
  await prisma.service.upsert({
    where: { slug: "cross-team-solution" },
    update: { teamId: null, isActive: true },
    create: {
      name: "Cross-team / Unclassified Solution",
      slug: "cross-team-solution",
      description: "Requests requiring agency-level review before a team is selected.",
      teamId: null,
      requiredBriefFields: ["expectedOutcome", "expectedDeliverables", "acceptanceCriteria"],
      expectedDeliverables: [],
      defaultUrgency: "medium",
      defaultSlaHours: 48,
      requiredReviews: [],
    },
  });

  // Sub-units are kept in the model but hidden in the UI; seed a couple under Product Dev.
  const backend = await prisma.subUnit.upsert({
    where: { teamId_slug: { teamId: productTech.id, slug: "backend" } },
    update: {},
    create: { teamId: productTech.id, name: "Backend", slug: "backend" },
  });

  await prisma.subUnit.upsert({
    where: { teamId_slug: { teamId: productTech.id, slug: "frontend" } },
    update: {},
    create: { teamId: productTech.id, name: "Frontend", slug: "frontend" },
  });

  const design = await prisma.subUnit.upsert({
    where: { teamId_slug: { teamId: productTech.id, slug: "design" } },
    update: {},
    create: { teamId: productTech.id, name: "Design", slug: "design" },
  });

  // ── Positions ───────────────────────────────────────────────────────────
  const positionNames = [
    "Product Manager",
    "Backend Engineer",
    "Frontend Engineer",
    "UX/UI Designer",
    "Content Writer",
    "Brand Strategist",
  ];
  for (const name of positionNames) {
    await prisma.position.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ── Skills ──────────────────────────────────────────────────────────────
  const skillNames = [
    "React",
    "Next.js",
    "TypeScript",
    "PostgreSQL",
    "Figma",
    "Copywriting",
    "Brand Design",
    "Node.js",
    "Tailwind CSS",
    "Docker",
    "GraphQL",
    "Product Management",
  ];

  for (const name of skillNames) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ── Demo Request (public, link-tracked — mirrors the no-login client flow)
  const codeYear = new Date().getFullYear();
  const demoToken = generatePublicToken();
  const demoRequest = await prisma.request.upsert({
    where: { code: `REQ-${codeYear}-0001` },
    update: {},
    create: {
      code: `REQ-${codeYear}-0001`,
      publicToken: demoToken,
      organizationId: incubator.id,
      submittedById: null,
      requesterName: "Ada Lightbearer",
      requesterEmail: "ada@lightbearers.org",
      title: "Lightbearers Hub site refresh",
      description:
        "Redesign and rebuild the Lightbearers Hub website with a fresh brand identity and improved mobile experience.",
      projectType: "website",
      urgency: Urgency.medium,
      stage: RequestStage.submitted,
    },
  });
  const demoStageEvent = await prisma.requestStageEvent.findFirst({
    where: { requestId: demoRequest.id, toStage: RequestStage.submitted },
  });
  if (!demoStageEvent) {
    await prisma.requestStageEvent.create({
      data: { requestId: demoRequest.id, toStage: RequestStage.submitted, actorId: null },
    });
  }

  // ── Demo Project (approved request) ──────────────────────────────────
  const approvedRequest = await prisma.request.upsert({
    where: { code: `REQ-${codeYear}-0002` },
    update: {},
    create: {
      code: `REQ-${codeYear}-0002`,
      organizationId: r4c.id,
      submittedById: superAdmin.id,
      title: "R4C global event booking platform",
      description: "Build an event management and booking platform for Reach4Christ's annual summit.",
      projectType: "software_automation",
      urgency: Urgency.high,
      stage: RequestStage.in_progress,
      routedTeamId: productTech.id,
    },
  });

  const demoProject = await prisma.project.upsert({
    where: { code: `PRJ-${codeYear}-0001` },
    update: {},
    create: {
      code: `PRJ-${codeYear}-0001`,
      requestId: approvedRequest.id,
      organizationId: r4c.id,
      agencyTeamId: productTech.id,
      name: "R4C Event Booking Platform",
      description: "End-to-end event booking system.",
      pmUserId: superAdmin.id,
    },
  });

  await prisma.task.upsert({
    where: { code: `TSK-${codeYear}-00001` },
    update: {},
    create: {
      code: `TSK-${codeYear}-00001`,
      projectId: demoProject.id,
      subUnitId: backend.id,
      assigneeUserId: superAdmin.id,
      title: "Design database schema and API contracts",
      status: TaskStatus.in_progress,
      priority: TaskPriority.high,
    },
  });

  await prisma.task.upsert({
    where: { code: `TSK-${codeYear}-00002` },
    update: {},
    create: {
      code: `TSK-${codeYear}-00002`,
      projectId: demoProject.id,
      subUnitId: design.id,
      title: "Create wireframes and design system",
      status: TaskStatus.todo,
      priority: TaskPriority.medium,
    },
  });

  console.log("Seed complete.");
  console.log(`  super_admin: ${superAdmin.email}`);
  console.log(`  demo request: ${demoRequest.code}`);
  console.log(`  demo tracking link: /track/${demoRequest.publicToken ?? demoToken}`);
  console.log(`  demo project: ${demoProject.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
