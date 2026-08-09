import { PrismaClient, Role, RequestStage, Urgency, TaskStatus, TaskPriority } from "@prisma/client";
import { DEFAULT_TEAMS, DEFAULT_DEPARTMENTS, TASK_TYPES, TEAM_SLUGS } from "../lib/request-types";
import { generatePublicToken } from "../lib/utils/codes";

const prisma = new PrismaClient();

/**
 * Client-facing service descriptions. These appear on the public services page,
 * so they are written for a ministry partner or NGO, not for internal staff.
 */
const SERVICE_BLURBS: Record<string, string> = {
  graphic_design: "Flyers, social graphics, decks and print pieces that look like you.",
  video_production: "Filming and editing — events, testimonies, promos and highlight reels.",
  photography: "Event, portrait and documentary photography, edited and ready to publish.",
  content_copywriting: "Words that land: articles, scripts, newsletters and web copy.",
  social_media: "Planning, producing and running your social channels.",
  branding: "Logo, colours, typography and the guidelines to keep it consistent.",
  branded_email: "Newsletters and email campaigns designed and set up to send.",
  flyer_poster: "A single flyer, poster or banner, print- and screen-ready.",
  website: "A website built for your audience — fast, mobile-friendly and easy to update.",
  web_application: "A web app for a specific job: portals, dashboards and member areas.",
  mobile_app: "An Android or iOS app, from first sketch through to the app stores.",
  ui_ux_design: "Screens and flows designed and tested before anything gets built.",
  software_automation: "Internal tools and automations that remove repetitive manual work.",
  survey_form: "Forms and surveys that collect clean data you can actually use.",
  registration_qr: "Registration links and QR codes for events and sign-ups.",
  landing_page: "A single focused page for a campaign, event or launch.",
  budget_request: "Costed proposals and budget planning for a piece of work.",
};

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
  if (!productTech) throw new Error("Seed failed: Product Development team missing.");

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
        // Client-facing copy. Kept short and outcome-led rather than naming the
        // service back at the reader; edit these in the app once real copy exists.
        description: SERVICE_BLURBS[service.value] ?? `Tell us what you need and we'll scope it with you.`,
        requiredBriefFields: ["expectedDeliverables"],
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
      name: "Something else",
      slug: "cross-team-solution",
      description: "Not sure which fits? Describe what you need and we will route it.",
      teamId: null,
      requiredBriefFields: ["expectedDeliverables"],
      expectedDeliverables: [],
      defaultUrgency: "medium",
      defaultSlaHours: 48,
      requiredReviews: [],
    },
  });

  // ── KPI scorecards ──────────────────────────────────────────────────────
  // One per branch, so `KpiService.computeSnapshot` has something to run during
  // each reporting cycle and the dashboard's KPI widget has data to show.
  // Evidence keys must match what `computeTeamEvidence` returns.
  const BRANCH_SCORECARD = [
    { key: "delivery", label: "Milestones delivered on time", weight: 30, evidence: "milestoneDelivery", target: 0.9, scoringFn: "linearAboveTarget" },
    { key: "completion", label: "Task completion rate", weight: 30, evidence: "taskCompletionRate", target: 0.85, scoringFn: "linearAboveTarget" },
    { key: "throughput", label: "Requests delivered", weight: 25, evidence: "requestsDelivered", target: 4, scoringFn: "linearAboveTarget" },
    { key: "quality", label: "QA review adoption", weight: 15, evidence: "qaAdoption", target: 0.8, scoringFn: "linearAboveTarget" },
  ];

  for (const [slug, branch] of Object.entries(teamsBySlug)) {
    const existingScorecard = await prisma.scorecardConfig.findFirst({
      where: { level: "team", scopeId: branch.id },
    });
    if (!existingScorecard) {
      await prisma.scorecardConfig.create({
        data: {
          level: "team",
          scopeId: branch.id,
          name: `${slug === TEAM_SLUGS.productDevelopment ? "Tech & Product" : "Digital Media"} delivery scorecard`,
          items: BRANCH_SCORECARD,
          isActive: true,
        },
      });
    }
  }

  // ── Departments (SubUnits) inside each branch ───────────────────────────
  const departmentsBySlug: Record<string, { id: string }> = {};
  for (const department of DEFAULT_DEPARTMENTS) {
    const branch = teamsBySlug[department.branchSlug];
    if (!branch) throw new Error(`Seed failed: branch missing for department ${department.slug}.`);
    departmentsBySlug[department.slug] = await prisma.subUnit.upsert({
      where: { teamId_slug: { teamId: branch.id, slug: department.slug } },
      update: { name: department.name, description: department.description },
      create: {
        teamId: branch.id,
        name: department.name,
        slug: department.slug,
        description: department.description,
      },
    });
  }

  const backend = departmentsBySlug["engineering"];
  const design = departmentsBySlug["product-design"];
  if (!backend || !design) throw new Error("Seed failed: Tech & Product departments missing.");

  // ── One test account per role ───────────────────────────────────────────
  // Every role in the system gets a real, loggable account so each screen can be
  // checked as the person who will actually use it. Sign in with "Quick Login
  // (Local Dev)" using any of these addresses — no password needed.
  //
  // Chief Executive and Finance Manager are deliberately two different people:
  // the system refuses to give both roles to one user (separation of duties).
  const digitalMedia = teamsBySlug[TEAM_SLUGS.brandsCommunications];
  if (!digitalMedia) throw new Error("Seed failed: Digital Media branch missing.");

  const TEST_ACCOUNTS: Array<{
    email: string;
    name: string;
    role: Role;
    teamId?: string | null;
    subUnitId?: string | null;
    title?: string;
  }> = [
    {
      email: "executive@ethree10.r4c.global",
      name: "Chinelo Okafor",
      role: Role.chief_executive,
      title: "Chief Executive",
    },
    {
      email: "admin.ops@ethree10.r4c.global",
      name: "Tunde Bakare",
      role: Role.agency_admin,
      title: "Agency Administrator",
    },
    {
      email: "finance@ethree10.r4c.global",
      name: "Amaka Eze",
      role: Role.finance_manager,
      title: "Finance Manager",
    },
    {
      email: "techlead@ethree10.r4c.global",
      name: "Segun Adeyemi",
      role: Role.branch_head,
      teamId: productTech.id,
      title: "Head, Tech & Product",
    },
    {
      email: "medialead@ethree10.r4c.global",
      name: "Ifeoma Nwosu",
      role: Role.branch_head,
      teamId: digitalMedia.id,
      title: "Head, Digital Media",
    },
    {
      email: "engineering.lead@ethree10.r4c.global",
      name: "Kelechi Obi",
      role: Role.department_lead,
      teamId: productTech.id,
      subUnitId: backend.id,
      title: "Engineering Lead",
    },
    {
      email: "member@ethree10.r4c.global",
      name: "Blessing Ade",
      role: Role.team_member,
      teamId: productTech.id,
      subUnitId: backend.id,
      title: "Backend Engineer",
    },
  ];

  const testUsers: Record<string, { id: string; email: string }> = {};
  for (const account of TEST_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name },
      create: { email: account.email, name: account.name, timezone: "Africa/Lagos" },
    });
    testUsers[account.role + (account.teamId ?? "")] = user;

    const existing = await prisma.membership.findFirst({
      where: { userId: user.id, role: account.role, removedAt: null },
    });
    if (!existing) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          role: account.role,
          teamId: account.teamId ?? null,
          subUnitId: account.subUnitId ?? null,
          title: account.title ?? null,
          isPrimary: true,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
    }
  }

  // Branch heads lead their branch; the department lead leads their department.
  const techHead = testUsers[Role.branch_head + productTech.id];
  const mediaHead = testUsers[Role.branch_head + digitalMedia.id];
  if (techHead) {
    await prisma.team.update({ where: { id: productTech.id }, data: { leadId: techHead.id } });
  }
  if (mediaHead) {
    await prisma.team.update({ where: { id: digitalMedia.id }, data: { leadId: mediaHead.id } });
  }
  const engLead = testUsers[Role.department_lead + productTech.id];
  if (engLead) {
    await prisma.subUnit.update({ where: { id: backend.id }, data: { leadId: engLead.id } });
  }

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
      // Internally-raised requests carry a tracking link too, so staff always
      // have something to send the client.
      publicToken: generatePublicToken(),
      publicTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      organizationId: r4c.id,
      submittedById: superAdmin.id,
      requesterName: "Pastor Emeka Nwankwo",
      requesterEmail: "emeka@reach4christ.org",
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
  console.log(`  demo request: ${demoRequest.code}`);
  console.log(`  demo tracking link: /track/${demoRequest.publicToken ?? demoToken}`);
  console.log(`  demo project: ${demoProject.code}`);
  console.log("");
  console.log("  Test accounts — sign in via Quick Login (Local Dev), no password:");
  console.log(`    super_admin      ${superAdmin.email}`);
  for (const account of TEST_ACCOUNTS) {
    console.log(`    ${account.role.padEnd(16)} ${account.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
