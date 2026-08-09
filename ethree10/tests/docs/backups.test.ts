import { describe, expect, it } from "vitest";
import { evaluateBackupFreshness, selectLatestBackup, type BackupFile, type BackupTarget } from "@/scripts/check-backups";

describe("backup checks", () => {
  const target: BackupTarget = {
    name: "database",
    directory: "/tmp/backups",
    maxAgeHours: 30,
    minSizeBytes: 1024,
  };

  it("selects the latest backup by modified time", () => {
    const files: BackupFile[] = [
      { name: "old.dump", path: "/tmp/old.dump", size: 2048, modifiedAt: new Date("2026-07-17T00:00:00.000Z") },
      { name: "new.dump", path: "/tmp/new.dump", size: 2048, modifiedAt: new Date("2026-07-18T00:00:00.000Z") },
    ];

    expect(selectLatestBackup(files)?.name).toBe("new.dump");
  });

  it("marks recent sufficiently large backups as passing", () => {
    const status = evaluateBackupFreshness(
      { name: "db.dump", path: "/tmp/db.dump", size: 2048, modifiedAt: new Date("2026-07-17T12:00:00.000Z") },
      target,
      new Date("2026-07-18T00:00:00.000Z"),
    );

    expect(status.fresh).toBe(true);
    expect(status.largeEnough).toBe(true);
  });

  it("flags stale or undersized backups", () => {
    const status = evaluateBackupFreshness(
      { name: "db.dump", path: "/tmp/db.dump", size: 512, modifiedAt: new Date("2026-07-15T00:00:00.000Z") },
      target,
      new Date("2026-07-18T00:00:00.000Z"),
    );

    expect(status.fresh).toBe(false);
    expect(status.largeEnough).toBe(false);
  });
});
