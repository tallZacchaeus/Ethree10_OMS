/**
 * Merge one branch into another, then give the survivor a canonical identity.
 *
 * Written for a specific mess, and deliberately general enough to fix it
 * safely. The catalogue bootstrap was told the agency's second branch is
 * "Tech & Product" with slug `tech-product`. The agency's actual second branch
 * is "Product/Tech Team" under `product-tech-team`. So the bootstrap created
 * the branch the check wanted rather than the one that exists, and the result
 * is two branches: one holding seven people and their history, the other
 * holding the departments and the service catalogue and nobody at all. A
 * request routed to one of those services lands where no one works.
 *
 * This moves everything off the source branch onto the target, renames the
 * target to the canonical name and slug, and archives the emptied source.
 *
 *   pnpm merge:branches --from tech-product --into product-tech-team \
 *     --rename-to "Tech & Product" --slug tech-product --dry-run
 *
 * Nothing is deleted. The source branch is archived and its slug suffixed, so
 * the row survives for audit and the canonical slug is freed for the target.
 * A dry run reports every row that would move and every collision that would
 * stop it.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]!;
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : null;
}

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const fromSlug = arg("from");
  const intoSlug = arg("into");
  const renameTo = arg("rename-to");
  const newSlug = arg("slug");

  if (!fromSlug || !intoSlug) {
    throw new Error("Both --from <slug> and --into <slug> are required.");
  }
  if (fromSlug === intoSlug) {
    throw new Error("--from and --into are the same branch.");
  }

  const source = await db.team.findUnique({ where: { slug: fromSlug } });
  const target = await db.team.findUnique({ where: { slug: intoSlug } });
  if (!source) throw new Error(`No branch with slug "${fromSlug}".`);
  if (!target) throw new Error(`No branch with slug "${intoSlug}".`);

  console.log(`${dryRun ? "DRY RUN — nothing will be written\n" : ""}Merging`);
  console.log(`  from:  ${source.name}  (${source.slug})`);
  console.log(`  into:  ${target.name}  (${target.slug})\n`);

  // What is attached to each side. Printed for both, because the decision about
  // which branch survives depends on what would be left behind.
  for (const [label, team] of [
    ["source", source],
    ["target", target],
  ] as const) {
    const [subUnits, services, memberships, requests, projects, integrations] = await Promise.all([
      db.subUnit.count({ where: { teamId: team.id } }),
      db.service.count({ where: { teamId: team.id } }),
      db.membership.count({ where: { teamId: team.id, removedAt: null } }),
      db.request.count({ where: { routedTeamId: team.id } }),
      db.project.count({ where: { agencyTeamId: team.id } }),
      db.integration.count({ where: { teamId: team.id } }),
    ]);
    console.log(
      `  ${label} holds: ${subUnits} departments, ${services} services, ${memberships} members, ` +
        `${requests} requests, ${projects} projects, ${integrations} integrations`,
    );
  }
  console.log();

  // SubUnit is unique on (teamId, slug), so a department whose slug already
  // exists on the target cannot move. Report rather than fail halfway through.
  const movingSubUnits = await db.subUnit.findMany({
    where: { teamId: source.id },
    select: { id: true, name: true, slug: true },
  });
  const targetSubUnitSlugs = new Set(
    (await db.subUnit.findMany({ where: { teamId: target.id }, select: { slug: true } })).map(
      (s) => s.slug,
    ),
  );
  const collisions = movingSubUnits.filter((s) => targetSubUnitSlugs.has(s.slug));

  if (collisions.length > 0) {
    console.log("COLLISIONS — these departments exist on both branches:");
    for (const c of collisions) console.log(`  ! ${c.name} (${c.slug})`);
    console.log(
      "\nMerging would violate the unique constraint on (teamId, slug). Rename or archive one side first.",
    );
    process.exitCode = 1;
    return;
  }

  const archivedSlug = `${source.slug}-merged-${new Date().toISOString().slice(0, 10)}`;

  console.log("Plan:");
  console.log(`  move ${movingSubUnits.length} departments to ${target.name}`);
  for (const s of movingSubUnits) console.log(`    → ${s.name}`);
  const serviceCount = await db.service.count({ where: { teamId: source.id } });
  const membershipCount = await db.membership.count({ where: { teamId: source.id } });
  const requestCount = await db.request.count({ where: { routedTeamId: source.id } });
  const projectCount = await db.project.count({ where: { agencyTeamId: source.id } });
  const integrationCount = await db.integration.count({ where: { teamId: source.id } });
  console.log(`  move ${serviceCount} services`);
  console.log(`  move ${membershipCount} memberships`);
  console.log(`  re-route ${requestCount} requests and ${projectCount} projects`);
  console.log(`  move ${integrationCount} integrations`);
  if (renameTo || newSlug) {
    console.log(
      `  rename target to "${renameTo ?? target.name}" (${newSlug ?? target.slug})`,
    );
  }
  console.log(`  archive source and free its slug as "${archivedSlug}"`);

  if (dryRun) {
    console.log("\nDry run — nothing written.");
    return;
  }

  // One transaction: a half-merged agency is worse than an un-merged one.
  await db.$transaction(async (tx) => {
    await tx.subUnit.updateMany({ where: { teamId: source.id }, data: { teamId: target.id } });
    await tx.service.updateMany({ where: { teamId: source.id }, data: { teamId: target.id } });
    await tx.membership.updateMany({ where: { teamId: source.id }, data: { teamId: target.id } });
    await tx.request.updateMany({
      where: { routedTeamId: source.id },
      data: { routedTeamId: target.id },
    });
    await tx.project.updateMany({
      where: { agencyTeamId: source.id },
      data: { agencyTeamId: target.id },
    });
    await tx.integration.updateMany({ where: { teamId: source.id }, data: { teamId: target.id } });

    // Free the canonical slug before the target claims it.
    await tx.team.update({
      where: { id: source.id },
      data: { slug: archivedSlug, archivedAt: new Date() },
    });

    if (renameTo || newSlug) {
      await tx.team.update({
        where: { id: target.id },
        data: {
          ...(renameTo ? { name: renameTo } : {}),
          ...(newSlug ? { slug: newSlug } : {}),
        },
      });
    }
  });

  console.log("\nMerged.");
  const after = await db.team.findMany({
    where: { archivedAt: null },
    select: { name: true, slug: true, leadId: true },
    orderBy: { name: "asc" },
  });
  console.log("\nActive branches now:");
  for (const team of after) {
    console.log(`  ${team.name} (${team.slug})${team.leadId ? "" : "  — no lead"}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
