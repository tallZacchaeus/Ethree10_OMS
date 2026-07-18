import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type PilotCheck = {
  name: string;
  pass: boolean;
};

async function contains(path: string, terms: string[]) {
  const content = await readFile(resolve(path), "utf8");
  return terms.every((term) => content.toLowerCase().includes(term.toLowerCase()));
}

export async function evaluatePilotReadiness(): Promise<PilotCheck[]> {
  return [
    {
      name: "pilot acceptance guide",
      pass: await contains("docs/pilot-acceptance.md", [
        "request intake",
        "team assignment",
        "client tracking",
        "weekly report",
      ]),
    },
    {
      name: "agency admin guide",
      pass: await contains("docs/user-guides/agency-admin.md", ["Launch checklist", "team", "organization"]),
    },
    {
      name: "team head guide",
      pass: await contains("docs/user-guides/team-head.md", ["assign", "review", "acceptance criteria"]),
    },
    {
      name: "requester guide",
      pass: await contains("docs/user-guides/requester.md", ["tracking", "acceptance", "request"]),
    },
    {
      name: "release guide references pilot readiness",
      pass: await contains("docs/release-management.md", ["check:pilot-readiness", "pilot"]),
    },
  ];
}

async function main() {
  const checks = await evaluatePilotReadiness();
  const failed = checks.filter((check) => !check.pass);

  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Pilot readiness failed: ${failed.map((check) => check.name).join(", ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
