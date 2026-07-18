import { describe, expect, it } from "vitest";
import { resolveAuditRetentionOptions } from "@/server/services/audit-retention";
import { parseAuditArchiveArgs } from "@/scripts/archive-audit-logs";

describe("audit retention", () => {
  it("calculates the retention cutoff from the configured number of days", () => {
    const options = resolveAuditRetentionOptions({
      days: 730,
      now: new Date("2026-07-18T00:00:00.000Z"),
    });

    expect(options.cutoff.toISOString()).toBe("2024-07-18T00:00:00.000Z");
  });

  it("defaults CLI execution to dry run", () => {
    expect(parseAuditArchiveArgs(["--days=365"])).toEqual({
      days: 365,
      batchSize: 500,
      dryRun: true,
    });
  });

  it("requires an explicit execute flag for destructive archival", () => {
    expect(parseAuditArchiveArgs(["--days=365", "--batch-size=100", "--execute"])).toEqual({
      days: 365,
      batchSize: 100,
      dryRun: false,
    });
  });
});
