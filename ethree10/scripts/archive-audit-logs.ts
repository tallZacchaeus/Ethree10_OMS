import { pathToFileURL } from "node:url";
import { AuditRetentionService } from "@/server/services/audit-retention";

export function parseAuditArchiveArgs(argv: string[]) {
  const daysArg = argv.find((arg) => arg.startsWith("--days="));
  const batchSizeArg = argv.find((arg) => arg.startsWith("--batch-size="));

  return {
    days: daysArg ? Number(daysArg.split("=")[1]) : 730,
    batchSize: batchSizeArg ? Number(batchSizeArg.split("=")[1]) : 500,
    dryRun: !argv.includes("--execute"),
  };
}

async function main() {
  const options = parseAuditArchiveArgs(process.argv.slice(2));
  const result = await AuditRetentionService.archiveStaleLogs(options);

  console.log(
    JSON.stringify(
      {
        ...result,
        cutoff: result.cutoff.toISOString(),
      },
      null,
      2,
    ),
  );

  if (result.dryRun) {
    console.log("Dry run only. Re-run with --execute to archive and delete stale active logs.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
