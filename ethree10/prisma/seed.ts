import { PrismaClient, Role, WorkspaceType, RequestStage, Urgency, TaskStatus, TaskPriority } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  // ── Workspaces ─────────────────────────────────────────────────────────
  const ethree10 = await prisma.workspace.upsert({
    where: { slug: "ethree10" },
    update: {},
    create: {
      type: WorkspaceType.agency,
      name: "Ethree10",
      slug: "ethree10",
      description: "Ethree10 Creative & Technology Agency",
      brandColor: "#6366F1",
    },
  });

  const r4c = await prisma.workspace.upsert({
    where: { slug: "reach4christ" },
    update: {},
    create: {
      type: WorkspaceType.master_org,
      name: "Reach4Christ Global",
      slug: "reach4christ",
      description: "The master organization.",
    },
  });

  const incubator = await prisma.workspace.upsert({
    where: { slug: "incubator" },
    update: {},
    create: {
      type: WorkspaceType.internal_client,
      name: "The Incubator",
      slug: "incubator",
    },
  });

  const micah = await prisma.workspace.upsert({
    where: { slug: "micah415" },
    update: {},
    create: {
      type: WorkspaceType.internal_client,
      name: "Micah 415",
      slug: "micah415",
    },
  });

  const mmpraise = await prisma.workspace.upsert({
    where: { slug: "mmpraise" },
    update: {},
    create: {
      type: WorkspaceType.internal_client,
      name: "MMPraise",
      slug: "mmpraise",
    },
  });

  // ── Super-admin user ────────────────────────────────────────────────────
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

  // Use findFirst + create/update to avoid the null-composite-key Prisma limitation
  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId: superAdmin.id,
      workspaceId: ethree10.id,
      role: Role.super_admin,
      departmentId: null,
      subUnitId: null,
    },
  });
  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        userId: superAdmin.id,
        workspaceId: ethree10.id,
        role: Role.super_admin,
        isPrimary: true,
        acceptedAt: new Date(),
      },
    });
  }

  // ── Product & Tech Department ──────────────────────────────────────────
  const productTech = await prisma.department.upsert({
    where: { workspaceId_slug: { workspaceId: ethree10.id, slug: "product-tech" } },
    update: {},
    create: {
      workspaceId: ethree10.id,
      name: "Product & Tech",
      slug: "product-tech",
      description: "Engineering, design, and product management.",
      color: "#6366F1",
      leadId: superAdmin.id,
    },
  });

  const backend = await prisma.subUnit.upsert({
    where: { departmentId_slug: { departmentId: productTech.id, slug: "backend" } },
    update: {},
    create: { departmentId: productTech.id, name: "Backend", slug: "backend" },
  });

  const frontend = await prisma.subUnit.upsert({
    where: { departmentId_slug: { departmentId: productTech.id, slug: "frontend" } },
    update: {},
    create: { departmentId: productTech.id, name: "Frontend", slug: "frontend" },
  });

  const design = await prisma.subUnit.upsert({
    where: { departmentId_slug: { departmentId: productTech.id, slug: "design" } },
    update: {},
    create: { departmentId: productTech.id, name: "Design", slug: "design" },
  });

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

  // ── Demo Request ──────────────────────────────────────────────────────
  const codeYear = new Date().getFullYear();
  const demoRequest = await prisma.request.upsert({
    where: { code: `REQ-${codeYear}-0001` },
    update: {},
    create: {
      code: `REQ-${codeYear}-0001`,
      workspaceId: incubator.id,
      submittedById: superAdmin.id,
      title: "Lightbearers Hub site refresh",
      description: "Redesign and rebuild the Lightbearers Hub website with a fresh brand identity and improved mobile experience.",
      projectType: "Website",
      urgency: Urgency.medium,
      stage: RequestStage.submitted,
    },
  });

  // ── Demo Project (approved request) ──────────────────────────────────
  const approvedRequest = await prisma.request.upsert({
    where: { code: `REQ-${codeYear}-0002` },
    update: {},
    create: {
      code: `REQ-${codeYear}-0002`,
      workspaceId: r4c.id,
      submittedById: superAdmin.id,
      title: "R4C global event booking platform",
      description: "Build an event management and booking platform for Reach4Christ's annual summit.",
      projectType: "Internal Tool",
      urgency: Urgency.high,
      stage: RequestStage.in_progress,
      routedDepartmentId: productTech.id,
    },
  });

  const demoProject = await prisma.project.upsert({
    where: { code: `PRJ-${codeYear}-0001` },
    update: {},
    create: {
      code: `PRJ-${codeYear}-0001`,
      requestId: approvedRequest.id,
      workspaceId: r4c.id,
      agencyDepartmentId: productTech.id,
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
  console.log(`  agency workspace: ${ethree10.slug}`);
  console.log(`  demo request: ${demoRequest.code}`);
  console.log(`  demo project: ${demoProject.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
