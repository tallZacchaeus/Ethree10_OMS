import { pathToFileURL } from "node:url";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import packageJson from "../package.json";

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
};

async function fileExists(path: string) {
  try {
    await stat(resolve(path));
    return true;
  } catch {
    return false;
  }
}

async function fileContains(path: string, terms: string[]) {
  const content = await readFile(resolve(path), "utf8");
  return terms.every((term) => content.includes(term));
}

export async function evaluateReleaseControls(): Promise<Check[]> {
  const scripts = packageJson.scripts as Record<string, string>;

  return [
    {
      name: "readiness script",
      pass: Boolean(scripts["check:readiness:db"]),
    },
    {
      name: "smoke script",
      pass: Boolean(scripts["check:smoke"]),
    },
    {
      name: "security header script",
      pass: Boolean(scripts["check:security-headers"]),
    },
    {
      name: "backup script",
      pass: Boolean(scripts["check:backups"]),
    },
    {
      name: "monitoring script",
      pass: Boolean(scripts["check:monitoring"]),
    },
    {
      name: "pilot readiness script",
      pass: Boolean(scripts["check:pilot-readiness"]),
    },
    {
      name: "audit retention script",
      pass: Boolean(scripts["audit:archive"]),
    },
    {
      name: "deployment workflow gates",
      pass: await fileContains("../.github/workflows/deploy.yml", [
        "check:readiness:db",
        "check:smoke",
        "check:security-headers",
        "check:backups",
      ]),
    },
    {
      name: "operations runbook",
      pass: await fileContains("docs/operations-runbook.md", ["Rollback", "Backup verification", "check:backups"]),
    },
    {
      name: "release management guide",
      pass: await fileContains("docs/release-management.md", ["check:monitoring", "check:pilot-readiness"]),
    },
    {
      name: "data governance guide",
      pass: await fileExists("docs/data-governance.md"),
    },
    {
      name: "monitoring guide",
      pass: await fileExists("docs/monitoring.md"),
    },
    {
      name: "pilot acceptance guide",
      pass: await fileExists("docs/pilot-acceptance.md"),
    },
  ];
}

async function main() {
  const checks = await evaluateReleaseControls();
  const failed = checks.filter((check) => !check.pass);

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
  }

  if (failed.length > 0) {
    throw new Error(`Release controls failed: ${failed.map((check) => check.name).join(", ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
