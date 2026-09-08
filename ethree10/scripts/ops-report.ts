/**
 * Where the agency's work actually is.
 *
 * Every request, the branch it is routed to, the stage it sits at, whether it
 * became a project, and whether that project has tasks anyone can be assigned.
 * Read-only.
 *
 * Written because "which branch is this on and how do I give it to someone"
 * could not be answered without opening the app as several different people.
 * The delivery chain is request -> project -> task -> assignee, and a break
 * anywhere in it looks the same from the outside: nothing to do.
 *
 *   pnpm ops:report
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ageDays = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

async function main() {
  const branches = await db.team.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, slug: true, leadId: true },
    orderBy: { name: "asc" },
  });
  const leadNames = new Map<string, string>();
  for (const b of branches) {
    if (!b.leadId) continue;
    const u = await db.user.findUnique({ where: { id: b.leadId }, select: { email: true } });
    if (u) leadNames.set(b.id, u.email);
  }

  console.log("BRANCHES\n");
  for (const b of branches) {
    const members = await db.membership.count({
      where: { teamId: b.id, removedAt: null, acceptedAt: { not: null } },
    });
    console.log(
      `  ${b.name} (${b.slug}) — lead ${leadNames.get(b.id) ?? "NONE"}, ${members} members`,
    );
  }

  const requests = await db.request.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      title: true,
      stage: true,
      urgency: true,
      createdAt: true,
      routedTeam: { select: { name: true } },
      service: { select: { name: true } },
      organization: { select: { name: true } },
      project: {
        select: {
          code: true,
          name: true,
          status: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  console.log(`\n\nREQUESTS (${requests.length})\n`);
  if (requests.length === 0) console.log("  none");

  for (const r of requests) {
    console.log(`  ${r.code} — ${r.title}`);
    console.log(`      client:  ${r.organization?.name ?? "(none)"}`);
    console.log(`      branch:  ${r.routedTeam?.name ?? "UNROUTED — nobody owns this yet"}`);
    console.log(`      service: ${r.service?.name ?? "(unclassified)"}`);
    console.log(`      stage:   ${r.stage} · ${r.urgency} · ${ageDays(r.createdAt)}d old`);

    if (!r.project) {
      console.log(`      project: none yet — nothing can be assigned until one exists`);
      console.log();
      continue;
    }

    const tasks = await db.task.findMany({
      where: { project: { code: r.project.code } },
      select: {
        code: true,
        title: true,
        status: true,
        // Task carries assigneeUserId but no assignee relation, so the email
        // is resolved separately below.
        assigneeUserId: true,
        subUnit: { select: { name: true } },
      },
      orderBy: { code: "asc" },
    });

    const assigneeEmails = new Map<string, string>();
    const ids = tasks.map((t) => t.assigneeUserId).filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      for (const u of await db.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true },
      })) {
        assigneeEmails.set(u.id, u.email);
      }
    }

    console.log(`      project: ${r.project.code} — ${r.project.name} (${r.project.status})`);
    if (tasks.length === 0) {
      console.log(`      tasks:   NONE — this is why there is nothing to assign`);
    } else {
      console.log(`      tasks:   ${tasks.length}`);
      for (const t of tasks) {
        console.log(
          `        ${t.code} ${t.title} · ${t.status} · ` +
            `${t.assigneeUserId ? assigneeEmails.get(t.assigneeUserId) ?? t.assigneeUserId : "UNASSIGNED"}` +
            `${t.subUnit ? ` · ${t.subUnit.name}` : ""}`,
        );
      }
    }
    console.log();
  }

  // A proposal that nobody approved leaves the task unassigned while looking,
  // to the person who made it, as though they assigned it.
  const pending = await db.taskAssignment.findMany({
    where: { status: "proposed" },
    select: {
      task: { select: { code: true, title: true } },
      assignee: { select: { email: true } },
      proposedAt: true,
    },
  });
  console.log(`\nASSIGNMENTS AWAITING APPROVAL (${pending.length})\n`);
  if (pending.length === 0) {
    console.log("  none");
  } else {
    for (const p of pending) {
      console.log(
        `  ${p.task.code} → ${p.assignee.email} · proposed ${ageDays(p.proposedAt)}d ago`,
      );
    }
    console.log("\n  These tasks are NOT assigned yet. A branch head approves them at /team/assignments.");
  }

  const unassigned = await db.task.count({ where: { assigneeUserId: null } });
  const totalTasks = await db.task.count();
  console.log(`\n\nSUMMARY`);
  console.log(`  branches: ${branches.length}`);
  console.log(`  requests: ${requests.length}`);
  console.log(`  projects: ${await db.project.count()}`);
  console.log(`  tasks:    ${totalTasks} (${unassigned} unassigned)`);
  if (totalTasks === 0) {
    console.log(
      `\n  No tasks exist anywhere, so nobody can be assigned work yet. The chain is` +
        `\n  request -> project -> task -> assignee, and it currently stops at project.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
