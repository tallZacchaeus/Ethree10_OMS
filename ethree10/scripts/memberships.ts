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

/**
 * The second way an account stops working, and the quieter one.
 *
 * `User.deactivatedAt` is set only by the Auth.js adapter's deleteUser hook and
 * is cleared by nothing. Sign-in does not check it, so the person logs in and
 * the app looks normal — but assignment, delegation, capability and report
 * recipients all exclude them. Nothing explains why, to them or to a lead
 * wondering where they went in the assignee list.
 */
async function listDeactivated() {
  const deactivated = await db.user.findMany({
    where: { deactivatedAt: { not: null } },
    select: {
      email: true,
      name: true,
      deactivatedAt: true,
      memberships: { where: { removedAt: null }, select: { role: true } },
    },
    orderBy: { deactivatedAt: "desc" },
  });

  console.log("\n=== Deactivated accounts ===\n");
  if (deactivated.length === 0) {
    console.log("None. Nobody is locked out this way.");
    return;
  }

  console.log(`${deactivated.length} deactivated account(s):\n`);
  for (const u of deactivated) {
    const roles = u.memberships.map((m) => m.role).join(", ") || "no active membership";
    console.log(`  ${u.email} — ${roles}`);
    console.log(`      deactivated ${u.deactivatedAt?.toISOString().slice(0, 10)}`);
    // Worth stating: they can still sign in, which is why this does not look
    // like a locked-out account from their side.
    console.log(`      can sign in, cannot be assigned work`);
  }
  console.log(`\nReactivate with:  pnpm memberships --reactivate-user <email>`);
}

async function reactivateUser(email: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, deactivatedAt: true },
  });

  if (!user) {
    console.log(`No user with email "${email}".`);
    return;
  }
  if (!user.deactivatedAt) {
    console.log(`${user.email} is not deactivated — nothing to do.`);
    return;
  }

  await db.user.update({ where: { id: user.id }, data: { deactivatedAt: null } });
  console.log(`+ reactivated: ${user.email}`);

  // Reactivating the account does not grant access on its own; that is the
  // membership's job, and the two lockouts are independent.
  const active = await db.membership.count({ where: { userId: user.id, removedAt: null } });
  if (active === 0) {
    console.log("  note: they still have no active membership, so they cannot do anything yet.");
  }
}

/**
 * Give one account the same access another one has (or had).
 *
 * Written for a mistyped domain: olayeyeisrael@r4cgloabl.org holds the
 * membership, olayeyeisrael@r4cglobal.org is the address that exists. Copying
 * the shape rather than retyping the role, branch and department means the new
 * account gets exactly what the old one had and nothing more — no chance of
 * fat-fingering a role upward.
 *
 * Additive and idempotent. It never touches the source, so the mistyped record
 * stays removed and auditable.
 */
async function inviteCopyingFrom(newEmail: string, sourceEmail: string) {
  const target = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (!target) {
    console.log(`No user with email "${newEmail}". They must sign in once before access can be granted.`);
    return;
  }

  // Removed memberships included: the source is usually removed, which is the
  // whole reason this is being run.
  const sources = await db.membership.findMany({
    where: { user: { email: sourceEmail } },
    include: INCLUDE,
  });
  if (sources.length === 0) {
    console.log(`No membership found for "${sourceEmail}" to copy.`);
    return;
  }

  for (const source of sources) {
    const existing = await db.membership.findFirst({
      where: {
        userId: target.id,
        role: source.role,
        teamId: source.teamId,
        subUnitId: source.subUnitId,
      },
    });

    if (existing && !existing.removedAt) {
      console.log(`= ${newEmail} already has ${source.role}${source.team ? ` on ${source.team.name}` : ""}`);
      continue;
    }

    if (existing) {
      await db.membership.update({
        where: { id: existing.id },
        data: { removedAt: null, acceptedAt: new Date() },
      });
      console.log(`+ restored ${newEmail} — ${describe({ ...source, removedAt: null })}`);
      continue;
    }

    const created = await db.membership.create({
      data: {
        userId: target.id,
        role: source.role,
        teamId: source.teamId,
        subUnitId: source.subUnitId,
        title: source.title,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
      include: INCLUDE,
    });
    console.log(`+ granted ${newEmail} — ${describe(created)}`);
  }

  console.log(`\nThe source account "${sourceEmail}" was not modified.`);
}

/**
 * Every account whose email contains a substring, with what access it holds.
 *
 * Exists because a mistyped domain is invisible to every other report here: a
 * typo'd address that is an ACTIVE member is not removed, not membership-less
 * and not deactivated, so nothing flagged it. The person works normally and
 * every email the system sends them bounces.
 *
 * Read-only.
 */
async function searchByEmail(fragment: string) {
  const users = await db.user.findMany({
    where: { email: { contains: fragment, mode: "insensitive" } },
    select: {
      email: true,
      name: true,
      deactivatedAt: true,
      memberships: {
        select: {
          role: true,
          removedAt: true,
          team: { select: { name: true } },
          subUnit: { select: { name: true } },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  console.log(`\n=== Accounts matching "${fragment}" ===\n`);
  if (users.length === 0) {
    console.log("None.");
    return;
  }

  for (const u of users) {
    const active = u.memberships.filter((m) => !m.removedAt);
    const removed = u.memberships.filter((m) => m.removedAt);
    const state = u.deactivatedAt
      ? "DEACTIVATED"
      : active.length > 0
        ? "active"
        : removed.length > 0
          ? "removed"
          : "no membership";
    console.log(`  ${u.email}  [${state}]`);
    for (const m of active) {
      console.log(
        `      active:  ${m.role}${m.team ? ` · ${m.team.name}` : ""}${m.subUnit ? ` / ${m.subUnit.name}` : ""}`,
      );
    }
    for (const m of removed) {
      console.log(
        `      removed: ${m.role}${m.team ? ` · ${m.team.name}` : ""}${m.subUnit ? ` / ${m.subUnit.name}` : ""}`,
      );
    }
  }

  console.log(
    `\n${users.length} account(s). An "active" one with a mistyped domain still works in the app, ` +
      `but every email sent to it bounces.`,
  );
}

/**
 * Soft-remove every active membership for one account.
 *
 * The counterpart to --restore, and it exists for the case that produced it:
 * access granted to the wrong one of two records for the same person. Soft,
 * not hard — removedAt is set and the row stays, so this is undoable with
 * --restore and the mistake stays visible rather than being erased.
 *
 * Refuses to strip a branch lead, because Team.leadId would then point at
 * somebody with no membership on the branch they supposedly run.
 */
async function removeAccess(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    console.log(`No user with email "${email}".`);
    return;
  }

  const led = await db.team.findMany({
    where: { leadId: user.id, archivedAt: null },
    select: { name: true },
  });
  if (led.length > 0) {
    console.log(
      `Refusing: ${user.email} leads ${led.map((t) => t.name).join(", ")}. ` +
        "Reassign the branch lead first, or Team.leadId points at someone with no membership there.",
    );
    process.exitCode = 1;
    return;
  }

  const active = await db.membership.findMany({
    where: { userId: user.id, removedAt: null },
    include: INCLUDE,
  });
  if (active.length === 0) {
    console.log(`${user.email} has no active membership — nothing to remove.`);
    return;
  }

  for (const m of active) {
    await db.membership.update({ where: { id: m.id }, data: { removedAt: new Date() } });
    console.log(`- removed: ${describe({ ...m, removedAt: new Date() })}`);
  }
  console.log(`\nUndo with:  pnpm memberships --restore ${user.email}`);
}

async function main() {
  const email = arg("restore");
  const membershipId = arg("restore-id");

  const reactivateEmail = arg("reactivate-user");
  const inviteEmail = arg("invite");
  const emailLike = arg("email-like");
  const removeEmail = arg("remove");
  const copyFrom = arg("copy-from");

  if (email || membershipId) {
    await restore(
      membershipId ? { membershipId } : { email: email!.trim().toLowerCase() },
    );
    console.log();
  }
  if (reactivateEmail) {
    await reactivateUser(reactivateEmail.trim().toLowerCase());
    console.log();
  }
  if (inviteEmail || copyFrom) {
    if (!inviteEmail || !copyFrom) {
      throw new Error("--invite and --copy-from must be given together.");
    }
    await inviteCopyingFrom(inviteEmail.trim().toLowerCase(), copyFrom.trim().toLowerCase());
    console.log();
  }
  if (removeEmail) {
    await removeAccess(removeEmail.trim().toLowerCase());
    console.log();
  }
  if (emailLike) {
    await searchByEmail(emailLike.trim());
    return;
  }

  await listRemoved();
  await listDeactivated();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
