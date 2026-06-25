// Load the real .env so integration tests exercise the actual env contract,
// Postgres and MinIO — no `@/lib/env` mock here (that is unit-test only).
// Uses Node's built-in env-file loader (Node 20.12+) to avoid a dotenv dep.
import { resolve } from "node:path";

const proc = process as NodeJS.Process & { loadEnvFile?: (path?: string) => void };

if (typeof proc.loadEnvFile !== "function") {
  throw new Error("Node 20.12+ is required to run integration tests (process.loadEnvFile is unavailable).");
}

proc.loadEnvFile(resolve(process.cwd(), ".env"));
