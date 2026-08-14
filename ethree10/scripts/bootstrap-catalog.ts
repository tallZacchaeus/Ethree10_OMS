/**
 * Create the agency's canonical structure and service catalogue.
 *
 * Branches, departments and services only — no users, no clients, no requests.
 * That distinction is the point: `pnpm db:seed` also creates demo people and
 * sample work, so it can never be run against production. This can, and is
 * meant to be: it is what fixes an environment reporting "Found 0 active
 * services", which blocks routing because a request cannot be classified
 * against a catalogue that does not exist.
 *
 * Idempotent. Every write is an upsert keyed on slug, so running it twice
 * changes nothing the second time, and running it against a populated database
 * repairs only what is missing. It never deletes, never archives, and never
 * touches a service's client-facing copy once set — an operator editing a
 * description in the app will not have it reverted by the next run.
 *
 *   pnpm bootstrap:catalog            # apply
 *   pnpm bootstrap:catalog --dry-run  # report what would change
 */
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_TEAMS,
  DEFAULT_DEPARTMENTS,
  TASK_TYPES,
  TEAM_SLUGS,
  SERVICE_BLURBS,
} from "../lib/request-types";

const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

let created = 0;
let restored = 0;
let unchanged = 0;

function report(action: "create" | "restore" | "ok", label: string) {
  if (action === "create") {
    created++;
    console.log(`  + ${label}`);
  } else if (action === "restore") {
    restored++;
    console.log(`  ~ ${label} (was archived/inactive — reactivated)`);
  } else {
    unchanged++;
  }
}

async function main() {
  console.log(
    dryRun
      ? "Catalog bootstrap — DRY RUN, nothing will be written\n"
      : "Catalog bootstrap\n",
  );

  // ── Branches ──────────────────────────────────────────────────────────────
  console.log("Branches");
  const teamIdBySlug = new Map<string, string>();
  for (const team of DEFAULT_TEAMS) {
    const existing = await db.team.findUnique({ where: { slug: team.slug } });
    if (!existing) {
      if (!dryRun) {
        const row = await db.team.create({
          data: {
            name: team.name,
            slug: team.slug,
            description: team.description,
            color: team.color,
          },
        });
        teamIdBySlug.set(team.slug, row.id);
      }
      report("create", team.name);
    } else {
      teamIdBySlug.set(team.slug, existing.id);
      if (existing.archivedAt) {
        // Archived rather than absent. Un-archive instead of creating a second
        // row: the slug is unique, and the existing one owns the history.
        if (!dryRun) {
          await db.team.update({ where: { id: existing.id }, data: { archivedAt: null } });
        }
        report("restore", team.name);
      } else {
        report("ok", team.name);
      }
    }
  }

  // ── Departments ───────────────────────────────────────────────────────────
  console.log("\nDepartments");
  for (const dept of DEFAULT_DEPARTMENTS) {
    const teamId = teamIdBySlug.get(dept.branchSlug);
    if (!teamId) {
      console.log(`  ! ${dept.name} skipped — branch ${dept.branchSlug} not present`);
      continue;
    }
    const existing = await db.subUnit.findFirst({ where: { slug: dept.slug, teamId } });
    if (!existing) {
      if (!dryRun) {
        await db.subUnit.create({
          data: { teamId, name: dept.name, slug: dept.slug, description: dept.description },
        });
      }
      report("create", `${dept.name}`);
    } else if (existing.archivedAt) {
      if (!dryRun) {
        await db.subUnit.update({ where: { id: existing.id }, data: { archivedAt: null } });
      }
      report("restore", dept.name);
    } else {
      report("ok", dept.name);
    }
  }

  // ── Services ──────────────────────────────────────────────────────────────
  console.log("\nServices");
  for (const service of TASK_TYPES) {
    const slug = service.value.replace(/_/g, "-");
    const teamId = teamIdBySlug.get(service.teamSlug);
    if (!teamId) {
      console.log(`  ! ${service.label} skipped — branch ${service.teamSlug} not present`);
      continue;
    }

    const existing = await db.service.findUnique({ where: { slug } });
    if (!existing) {
      if (!dryRun) {
        await db.service.create({
          data: {
            name: service.label,
            slug,
            teamId,
            description:
              SERVICE_BLURBS[service.value] ??
              "Tell us what you need and we'll scope it with you.",
            requiredBriefFields: ["expectedDeliverables"],
            expectedDeliverables: [],
            defaultUrgency: "medium",
            defaultSlaHours: 72,
            requiredReviews:
              service.teamSlug === TEAM_SLUGS.productDevelopment ? ["quality_assurance"] : [],
          },
        });
      }
      report("create", service.label);
    } else if (!existing.isActive) {
      // Only reactivate and re-point at its branch. Name and description are
      // left alone: those are edited in the app, and overwriting them would
      // silently discard someone's copy.
      if (!dryRun) {
        await db.service.update({ where: { id: existing.id }, data: { isActive: true, teamId } });
      }
      report("restore", service.label);
    } else {
      report("ok", service.label);
    }
  }

  // A service that spans both branches, so a request that is genuinely neither
  // has somewhere to sit rather than being forced into the wrong one.
  const crossTeam = await db.service.findUnique({ where: { slug: "cross-team-solution" } });
  if (!crossTeam) {
    if (!dryRun) {
      await db.service.create({
        data: {
          name: "Cross-team solution",
          slug: "cross-team-solution",
          teamId: null,
          description: "Work that needs both branches — routed after triage.",
          requiredBriefFields: ["expectedDeliverables"],
          expectedDeliverables: [],
          defaultUrgency: "medium",
          defaultSlaHours: 72,
          requiredReviews: [],
        },
      });
    }
    report("create", "Cross-team solution");
  } else if (!crossTeam.isActive) {
    if (!dryRun) {
      await db.service.update({ where: { id: crossTeam.id }, data: { isActive: true } });
    }
    report("restore", "Cross-team solution");
  } else {
    report("ok", "Cross-team solution");
  }

  const activeTeams = await db.team.count({ where: { archivedAt: null } });
  const activeServices = await db.service.count({ where: { isActive: true } });

  console.log(
    `\n${created} created, ${restored} reactivated, ${unchanged} already correct` +
      (dryRun ? " (dry run — nothing written)" : ""),
  );
  console.log(`Active branches: ${activeTeams}  ·  Active services: ${activeServices}`);

  if (!dryRun && (activeTeams < DEFAULT_TEAMS.length || activeServices === 0)) {
    console.error("\nReadiness would still fail. Check the skipped lines above.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
