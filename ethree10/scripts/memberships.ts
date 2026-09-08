/**
 * Find and restore removed agency memberships.
 *
 * Removing a member is a soft delete: the row stays and `removedAt` is set.
 * But every query filters `removedAt: null`, so the person disappears from the
 * members list, and there is no reactivate anywhere in the app. Worse, the
 * unique constraint on Membership is (userId, role, teamId, subUnitId) and does
 * NOT include removedAt — so re-inviting them to the same role and branch hits
 * the constraint and fails. The natural recovery is the one that cannot work.
 *
 * The data is all still there. This finds it and puts it back.
 *
 *   pnpm memberships                          # list removed memberships
 *   pnpm memberships --restore ada@x.com      # restore every removed membership for one person
 *   pnpm memberships --restore-id <id>        # restore one specific membership
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]!;
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : null;
}

const describe = (m: {
  id: string;
  role: string;
  removedAt: Date | null;
  user: { email: string; name: string | null };
  team: { name: string } | null;
  subUnit: { name: string } | null;
}) =>
  `${m.user.email} — ${m.role}` +
  `${m.team ? ` · ${m.team.name}` : ""}${m.subUnit ? ` / ${m.subUnit.name}` : ""}` +
  `${m.removedAt ? ` · removed ${m.removedAt.toISOString().slice(0, 10)}` : ""}`;

const INCLUDE = {
  user: { select: { email: true, name: true } },
  team: { select: { name: true } },
  subUnit: { select: { name: true } },
} as const;

async function listRemoved() {
  const removed = await db.membership.findMany({
    where: { removedAt: { not: null } },
    include: INCLUDE,
    orderBy: { removedAt: "desc" },
  });

  if (removed.length === 0) {
    console.log("No removed memberships. Nobody is locked out this way.");
  } else {
    console.log(`${removed.length} removed membership(s):\n`);
    for (const m of removed) {
      console.log(`  ${describe(m)}`);
      console.log(`      id: ${m.id}`);
    }
    console.log(`\nRestore with:  pnpm memberships --restore <email>`);
  }

  // Someone with a User row but no active membership is locked out too, and for
  // a different reason — they were never given access, rather than having had it
  // taken away. Both land on /unauthorized, so both are worth showing.
  const orphans = await db.user.findMany({
    where: { memberships: { none: { removedAt: null } } },
    select: { email: true, name: true, memberships: { select: { id: true } } },
  });
  const neverHad = orphans.filter((u) => u.memberships.length === 0);
  if (neverHad.length > 0) {
    console.log(`\n${neverHad.length} user(s) with no membership at all — never granted access:`);
    for (const u of neverHad) console.log(`  ${u.email}`);
    console.log("These need an invite, not a restore.");
  }
}

async function restore(target: { email?: string; membershipId?: string }) {
  const where = target.membershipId
    ? { id: target.membershipId, removedAt: { not: null } }
    : { user: { email: target.email! }, removedAt: { not: null } };

  const candidates = await db.membership.findMany({ where, include: INCLUDE });

  if (candidates.length === 0) {
    const who = target.membershipId ?? target.email;
    console.log(`Nothing removed to restore for "${who}".`);
    const active = await db.membership.findMany({
      where: target.membershipId
        ? { id: target.membershipId }
        : { user: { email: target.email! }, removedAt: null },
      include: INCLUDE,
    });
    if (active.length > 0) {
      console.log("They already have active access:");
      for (const m of active) console.log(`  ${describe(m)}`);
    } else {
      console.log("They have no membership at all — they need an invite, not a restore.");
    }
    return;
  }

  for (const m of candidates) {
    // The unique constraint is (userId, role, teamId, subUnitId). If an active
    // membership already occupies that tuple, clearing removedAt would produce
    // two rows claiming the same slot, so leave the removed one alone.
    const conflict = await db.membership.findFirst({
      where: {
        userId: m.userId,
        role: m.role,
        teamId: m.teamId,
        subUnitId: m.subUnitId,
        removedAt: null,
        id: { not: m.id },
      },
    });

    if (conflict) {
      console.log(`= ${describe(m)}`);
      console.log("      skipped — an active membership already covers this exact role and branch");
      continue;
    }

    await db.membership.update({ where: { id: m.id }, data: { removedAt: null } });
    console.log(`+ restored: ${describe({ ...m, removedAt: null })}`);
  }
}

async function main() {
  const email = arg("restore");
  const membershipId = arg("restore-id");

  if (email || membershipId) {
    await restore(
      membershipId ? { membershipId } : { email: email!.trim().toLowerCase() },
    );
    console.log();
  }
  await listRemoved();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
