/**
 * Report or set the lead of each branch.
 *
 * Readiness has warned `0/2 active teams have a lead assigned` since launch,
 * and it is not cosmetic: the assignment flow routes every auto-proposal to the
 * branch head for approval, so with no lead a proposal has nobody to approve it
 * and the whole feature is inert.
 *
 * Two modes, because the hard part is not the write — it is knowing who. A dry
 * run lists each branch, its current lead, and the people who could hold it,
 * with the roles they already have. Applying takes explicit emails: this script
 * will not pick a head for you, because that is a decision about people, not a
 * gap in the data.
 *
 *   pnpm assign:branch-heads
 *     --dry-run
 *   pnpm assign:branch-heads
 *     --set digital-media=ada@ethree10.com --set tech-product=grace@ethree10.com
 *
 * Idempotent, additive, and it never removes a membership or demotes anyone.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

/** `--set <slug>=<email>` pairs, in the order given. */
function requestedAssignments(): Array<{ slug: string; email: string }> {
  const out: Array<{ slug: string; email: string }> = [];
  const args = process.argv.slice(2);
  args.forEach((arg, index) => {
    const value = arg === "--set" ? args[index + 1] : arg.startsWith("--set=") ? arg.slice(6) : null;
    if (!value) return;
    const [slug, email] = value.split("=");
    if (slug && email) out.push({ slug: slug.trim(), email: email.trim().toLowerCase() });
  });
  return out;
}

async function report() {
  const teams = await db.team.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, leadId: true },
  });

  console.log("Branches and their leads\n");

  for (const team of teams) {
    const lead = team.leadId
      ? await db.user.findUnique({ where: { id: team.leadId }, select: { name: true, email: true } })
      : null;

    console.log(`${team.name}  (${team.slug})`);
    console.log(`  lead: ${lead ? `${lead.name ?? "(no name)"} <${lead.email}>` : "NONE"}`);

    // Anyone already attached to this branch is a candidate; someone who
    // already holds branch_head here is the obvious one.
    const members = await db.membership.findMany({
      where: { teamId: team.id, removedAt: null, acceptedAt: { not: null } },
      select: { role: true, user: { select: { name: true, email: true } } },
      orderBy: { role: "asc" },
    });

    if (members.length === 0) {
      console.log("  candidates: none — nobody is a member of this branch");
    } else {
      console.log("  candidates:");
      for (const member of members) {
        const marker = member.role === "branch_head" ? " <- already branch_head here" : "";
        console.log(`    ${member.user.email}  [${member.role}]${marker}`);
      }
    }
    console.log();
  }

  const withLead = teams.filter((team) => team.leadId).length;
  console.log(`${withLead}/${teams.length} branches have a lead.`);
  if (withLead < teams.length) {
    console.log(
      "\nUntil every branch has one, auto-assignment proposals for that branch have nobody to approve them.",
    );
    console.log("Set one with:  --set <branch-slug>=<email>");
  }
}

async function apply(assignments: Array<{ slug: string; email: string }>) {
  for (const { slug, email } of assignments) {
    const team = await db.team.findUnique({ where: { slug } });
    if (!team) {
      throw new Error(`No branch with slug "${slug}". Run with --dry-run to list them.`);
    }
    if (team.archivedAt) {
      throw new Error(`Branch "${slug}" is archived; refusing to give it a lead.`);
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(`No user with email "${email}". They must exist before they can lead.`);
    }

    if (team.leadId === user.id) {
      console.log(`= ${team.name}: ${email} is already the lead`);
    } else {
      await db.team.update({ where: { id: team.id }, data: { leadId: user.id } });
      console.log(`+ ${team.name}: lead set to ${email}`);
    }

    // A lead who cannot act on the branch is a lead in name only, so make sure
    // the membership backs the title. Additive: an existing membership is
    // promoted rather than replaced, and other memberships are left alone.
    const existing = await db.membership.findFirst({
      where: { userId: user.id, teamId: team.id, removedAt: null },
    });

    if (!existing) {
      await db.membership.create({
        data: { userId: user.id, teamId: team.id, role: "branch_head", acceptedAt: new Date() },
      });
      console.log(`  + membership created: branch_head on ${team.name}`);
    } else if (existing.role !== "branch_head") {
      await db.membership.update({
        where: { id: existing.id },
        data: { role: "branch_head", acceptedAt: existing.acceptedAt ?? new Date() },
      });
      console.log(`  ~ membership promoted from ${existing.role} to branch_head`);
    } else {
      console.log(`  = membership already branch_head`);
    }
  }
}

async function main() {
  const assignments = requestedAssignments();

  if (dryRun || assignments.length === 0) {
    if (!dryRun) {
      console.log("No --set given, so reporting only. Nothing has been changed.\n");
    }
    await report();
    return;
  }

  await apply(assignments);
  console.log();
  await report();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
