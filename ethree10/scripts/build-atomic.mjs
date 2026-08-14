#!/usr/bin/env node
/**
 * Build into a staging directory, and only replace the live one once the build
 * has actually succeeded.
 *
 * Why this exists: the VPS deploy rebuilds in place, so a build that failed
 * halfway left `.next` partially rewritten while the old server process kept
 * running. The process served HTML referencing chunks the new build had already
 * deleted, every request for them fell through to Node and returned 500 as
 * text/plain, and the browser reported ChunkLoadError. A type error took
 * production down for a day.
 *
 * With this, a failed build touches nothing: the running app keeps serving the
 * last good output, and the deploy fails loudly without an outage. Rolling
 * forward is then a fix and a redeploy rather than an emergency.
 *
 * `deploy.sh` on the VPS calls `pnpm build`, so making the build itself atomic
 * fixes the deploy without needing to change anything on the server.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const LIVE = ".next";
const STAGING = ".next-build";
const PREVIOUS = ".next-previous";

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

// Start from a clean staging directory so nothing from an earlier failed
// attempt is mistaken for part of this build.
rmSync(STAGING, { recursive: true, force: true });

// Carry the incremental build cache across. Without this every deploy is a
// cold build, which on this project is the difference between roughly 20
// seconds and well over a minute.
const liveCache = join(LIVE, "cache");
if (existsSync(liveCache)) {
  try {
    cpSync(liveCache, join(STAGING, "cache"), { recursive: true });
  } catch (error) {
    // A missing cache costs time, never correctness — carry on.
    console.warn(`[build-atomic] could not reuse build cache: ${error.message}`);
  }
}

const status = run("next", ["build"], { NEXT_DIST_DIR: STAGING });

if (status !== 0) {
  // The important line: `.next` was never touched, so whatever is running
  // stays running.
  rmSync(STAGING, { recursive: true, force: true });
  console.error(
    "\n[build-atomic] Build failed. The live build directory was left untouched, " +
      "so the running application is unaffected.",
  );
  process.exit(status);
}

// Swap. Two renames rather than delete-then-move, so the window in which
// `.next` does not exist is as small as the filesystem allows, and the previous
// build is still on disk if the swap itself fails.
try {
  rmSync(PREVIOUS, { recursive: true, force: true });
  if (existsSync(LIVE)) renameSync(LIVE, PREVIOUS);
  renameSync(STAGING, LIVE);
} catch (error) {
  // Put the previous build back rather than leaving the app with no output.
  if (!existsSync(LIVE) && existsSync(PREVIOUS)) {
    renameSync(PREVIOUS, LIVE);
  }
  console.error(`[build-atomic] Swap failed, previous build restored: ${error.message}`);
  process.exit(1);
}

rmSync(PREVIOUS, { recursive: true, force: true });
console.log("[build-atomic] Build succeeded and is now live in .next");
