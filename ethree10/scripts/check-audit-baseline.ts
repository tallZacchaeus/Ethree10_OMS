import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * A ratchet over `pnpm audit`.
 *
 * The dependency backlog is 61 advisories, 3 of them critical. A check that
 * simply fails on those is red from the day it lands and stays red until Phase 6
 * clears them — and a check that is always red is one people learn to scroll
 * past, which is worse than not having it. Marking the job `continue-on-error`
 * instead produces the same thing in a different colour: a permanently failing
 * check nobody acts on.
 *
 * So this compares against a committed baseline. The known backlog passes; a
 * NEW critical or high advisory fails. The check is green today, it goes red
 * for a real regression, and Phase 6 lowers the baseline as it clears things —
 * the numbers only ratchet down, because `--update` refuses to raise them.
 */
const BASELINE_PATH = resolve(process.cwd(), "security-baseline.json");

type Severity = "critical" | "high" | "moderate" | "low" | "info";
type Baseline = { critical: number; high: number; note?: string };

type Advisory = { severity: Severity; module_name: string; title: string };

async function audit(): Promise<Advisory[]> {
  let stdout = "";
  try {
    // Exits non-zero whenever anything is found, so a throw is the normal path.
    const result = await run("pnpm", ["audit", "--json"], { maxBuffer: 32 * 1024 * 1024 });
    stdout = result.stdout;
  } catch (error) {
    const withOutput = error as { stdout?: string };
    if (!withOutput.stdout) throw error;
    stdout = withOutput.stdout;
  }

  const parsed = JSON.parse(stdout) as { advisories?: Record<string, Advisory> };
  return Object.values(parsed.advisories ?? {});
}

async function readBaseline(): Promise<Baseline> {
  try {
    return JSON.parse(await readFile(BASELINE_PATH, "utf8")) as Baseline;
  } catch {
    // No baseline yet means nothing is yet accepted — the strictest reading.
    return { critical: 0, high: 0 };
  }
}

async function main() {
  const advisories = await audit();
  const counts = {
    critical: advisories.filter((a) => a.severity === "critical").length,
    high: advisories.filter((a) => a.severity === "high").length,
  };
  const baseline = await readBaseline();

  if (process.argv.includes("--update")) {
    // Only ever downward. Raising a baseline to make a red check green is how a
    // ratchet quietly becomes a rubber stamp, so that has to be a deliberate
    // edit to the file, visible in review.
    const next: Baseline = {
      critical: Math.min(counts.critical, baseline.critical),
      high: Math.min(counts.high, baseline.high),
      note: "Ceiling for known advisories. Lower it as Phase 6 clears them; never raise it here.",
    };
    await writeFile(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`baseline updated: critical ${next.critical}, high ${next.high}`);
    return;
  }

  console.log(`critical: ${counts.critical} (allowed ${baseline.critical})`);
  console.log(`high:     ${counts.high} (allowed ${baseline.high})`);

  const regressions: string[] = [];
  if (counts.critical > baseline.critical) {
    regressions.push(`critical rose from ${baseline.critical} to ${counts.critical}`);
  }
  if (counts.high > baseline.high) {
    regressions.push(`high rose from ${baseline.high} to ${counts.high}`);
  }

  if (regressions.length > 0) {
    console.error(`\nFAIL: ${regressions.join("; ")}`);
    console.error("A new critical or high advisory has appeared. Current ones:\n");
    for (const a of advisories.filter((x) => x.severity === "critical" || x.severity === "high")) {
      console.error(`  [${a.severity}] ${a.module_name}: ${a.title.slice(0, 90)}`);
    }
    console.error("\nUpgrade the dependency, or lower the backlog elsewhere to stay under the ceiling.");
    process.exit(1);
  }

  if (counts.critical < baseline.critical || counts.high < baseline.high) {
    console.log(
      `\nBacklog has shrunk. Run 'pnpm audit:baseline --update' to lock the improvement in.`,
    );
  }

  console.log("\nPASS: no new critical or high advisories.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
