import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkTarget,
  selectLatestBackup,
  evaluateBackupFreshness,
  type BackupTarget,
  type BackupFile,
} from "@/scripts/check-backups";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function backupDir(files: Array<{ name: string; size: number; ageHours: number }>) {
  const dir = await mkdtemp(join(tmpdir(), "backup-check-"));
  dirs.push(dir);
  for (const file of files) {
    const path = join(dir, file.name);
    await writeFile(path, "x".repeat(file.size));
    const when = new Date(Date.now() - file.ageHours * 3600_000);
    await utimes(path, when, when);
  }
  return dir;
}

const target = (directory: string): BackupTarget => ({
  name: "database",
  directory,
  maxAgeHours: 30,
  minSizeBytes: 1024,
});

describe("backup target checks", () => {
  it("passes a fresh, large-enough backup", async () => {
    const dir = await backupDir([{ name: "db_recent.sql.gz", size: 4096, ageHours: 2 }]);
    const report = await checkTarget(target(dir));
    expect(report.ok).toBe(true);
  });

  it("reports a stale backup rather than throwing", async () => {
    // It has to return, not throw — throwing is what stopped the other target
    // from ever being reported.
    const dir = await backupDir([{ name: "db_old.sql.gz", size: 4096, ageHours: 100 }]);
    const report = await checkTarget(target(dir));
    expect(report.ok).toBe(false);
    expect(report.detail).toContain("stale");
    expect(report.detail).toContain("limit 30h");
  });

  it("catches a backup that is fresh but suspiciously small", async () => {
    // A truncated dump has a current timestamp and restores to nothing.
    const dir = await backupDir([{ name: "db_truncated.sql.gz", size: 12, ageHours: 1 }]);
    const report = await checkTarget(target(dir));
    expect(report.ok).toBe(false);
    expect(report.detail).toContain("smaller than 1024 bytes");
  });

  it("says so when a backup is both stale and truncated", async () => {
    const dir = await backupDir([{ name: "db_bad.sql.gz", size: 12, ageHours: 100 }]);
    const report = await checkTarget(target(dir));
    expect(report.detail).toContain("stale and smaller than");
  });

  it("reports an empty directory without throwing", async () => {
    const dir = await backupDir([]);
    const report = await checkTarget(target(dir));
    expect(report.ok).toBe(false);
    expect(report.detail).toContain("no files");
  });

  it("reports a missing directory without throwing", async () => {
    const report = await checkTarget(target("/nonexistent/backup/path"));
    expect(report.ok).toBe(false);
    expect(report.detail).toContain("cannot read");
  });

  it("judges the newest file, not whichever the filesystem lists first", async () => {
    const dir = await backupDir([
      { name: "db_old.sql.gz", size: 4096, ageHours: 400 },
      { name: "db_new.sql.gz", size: 4096, ageHours: 3 },
    ]);
    const report = await checkTarget(target(dir));
    expect(report.ok).toBe(true);
    expect(report.detail).toContain("db_new.sql.gz");
  });
});

describe("freshness helpers", () => {
  const file = (ageHours: number, size = 4096): BackupFile => ({
    name: "b.tar.gz",
    path: "/b.tar.gz",
    size,
    modifiedAt: new Date(Date.now() - ageHours * 3600_000),
  });

  it("selects the most recent of several backups", () => {
    const files = [file(50), file(2), file(9)];
    expect(selectLatestBackup(files)?.modifiedAt).toEqual(
      files.map((f) => f.modifiedAt).toSorted((a, b) => b.getTime() - a.getTime())[0],
    );
  });

  it("returns null when there is nothing to select", () => {
    expect(selectLatestBackup([])).toBeNull();
  });

  it("treats a backup exactly at the age limit as still fresh", () => {
    const now = new Date();
    const at = { ...file(0), modifiedAt: new Date(now.getTime() - 30 * 3600_000) };
    expect(evaluateBackupFreshness(at, target("/x"), now).fresh).toBe(true);
  });
});
