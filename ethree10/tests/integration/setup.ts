// Integration tests run against REAL infrastructure (Postgres + MinIO), unlike
// unit tests which mock `@/lib/env`.
//
// They use a DEDICATED database (`TEST_DATABASE_URL`, default `ethree10_test`)
// rather than the development one. Pointing them at a dev or shared database is
// how a test suite ends up deleting someone's data — and how these tests
// previously ran against a stale schema and failed for the wrong reason.
//
// Prepare it once with:  pnpm test:integration:prepare
import { resolve } from "node:path";

const proc = process as NodeJS.Process & { loadEnvFile?: (path?: string) => void };

if (typeof proc.loadEnvFile !== "function") {
  throw new Error("Node 20.12+ is required to run integration tests (process.loadEnvFile is unavailable).");
}

// A local `.env` is a convenience, not a requirement. loadEnvFile throws when
// the file is absent, which is the normal case in CI — so a missing file must
// not be the reason the suite cannot run.
try {
  proc.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  // No .env here. Everything below has a default or comes from the environment.
}

// Defaults to the database docker-compose.yml actually publishes. The previous
// default named a specific developer's macOS account on port 5432, while compose
// publishes 5433 — so the documented way to start local infrastructure produced
// a database these tests did not look at, and nobody but that one developer
// could run them. Combined with their absence from CI, the RBAC and governance
// suites ran nowhere at all.
const testDatabaseUrl =
  process.env["TEST_DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5433/ethree10_test?schema=public";

// Applied after loadEnvFile so it always wins over whatever `.env` contained.
process.env["DATABASE_URL"] = testDatabaseUrl;
process.env["DIRECT_URL"] = testDatabaseUrl;
