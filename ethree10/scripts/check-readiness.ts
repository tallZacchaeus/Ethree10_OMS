import {
  evaluateDatabaseReadiness,
  evaluateEnvironmentReadiness,
  formatReadinessReport,
  summarizeReadiness,
  type DatabaseReadinessCounts,
  type ReadinessCheck,
} from "@/lib/readiness";

type LoadEnvProcess = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

function loadLocalEnv() {
  const proc = process as LoadEnvProcess;
  for (const file of [".env", ".env.local"]) {
    try {
      proc.loadEnvFile?.(file);
    } catch {
      // Missing env files are acceptable; CI and production normally provide env directly.
    }
  }
}

async function getDatabaseCounts(): Promise<DatabaseReadinessCounts> {
  const [{ db }, { DEFAULT_TEAMS }] = await Promise.all([
    import("@/server/db/client"),
    import("@/lib/request-types"),
  ]);

  const canonicalSlugs = DEFAULT_TEAMS.map((team) => team.slug);
  const [teams, services, acceptedStaff, superAdmins, organizations] = await Promise.all([
    db.team.findMany({
      where: { slug: { in: canonicalSlugs }, archivedAt: null },
      select: { leadId: true },
    }),
    db.service.count({ where: { isActive: true } }),
    db.membership.count({ where: { acceptedAt: { not: null }, removedAt: null } }),
    db.user.count({ where: { isSuperAdmin: true, deactivatedAt: null } }),
    db.organization.count(),
  ]);

  await db.$disconnect();

  return {
    teams: teams.length,
    teamsWithHeads: teams.filter((team) => Boolean(team.leadId)).length,
    services,
    acceptedStaff,
    superAdmins,
    organizations,
  };
}

async function main() {
  loadLocalEnv();

  const args = new Set(process.argv.slice(2));
  const production = args.has("--production") || process.env["NODE_ENV"] === "production";
  const withDb = args.has("--with-db");

  const checks: ReadinessCheck[] = [
    ...evaluateEnvironmentReadiness(process.env, { production, nodeVersion: process.version }),
  ];

  if (withDb) {
    checks.push(...evaluateDatabaseReadiness(await getDatabaseCounts()));
  }

  console.log(formatReadinessReport(checks));

  const summary = summarizeReadiness(checks);
  if (summary.failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
