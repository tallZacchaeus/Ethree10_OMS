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

proc.loadEnvFile(resolve(process.cwd(), ".env"));

const testDatabaseUrl =
  process.env["TEST_DATABASE_URL"] ??
  "postgresql://zacchaeusjames@localhost:5432/ethree10_test?schema=public";

// Applied after loadEnvFile so it always wins over whatever `.env` contained.
process.env["DATABASE_URL"] = testDatabaseUrl;
process.env["DIRECT_URL"] = testDatabaseUrl;
