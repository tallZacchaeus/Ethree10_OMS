import { pathToFileURL } from "node:url";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type BackupTarget = {
  name: string;
  directory: string;
  maxAgeHours: number;
  minSizeBytes: number;
};

export type BackupFile = {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
};

export type BackupStatus = BackupFile & {
  ageHours: number;
  fresh: boolean;
  largeEnough: boolean;
};

function numberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

export function defaultBackupTargets(): BackupTarget[] {
  return [
    {
      name: "database",
      directory: process.env["BACKUP_DB_DIR"] ?? "/srv/ethree10/backups/db",
      maxAgeHours: numberFromEnv("BACKUP_DB_MAX_AGE_HOURS", 30),
      minSizeBytes: numberFromEnv("BACKUP_DB_MIN_SIZE_BYTES", 1024),
    },
    {
      name: "minio",
      directory: process.env["BACKUP_MINIO_DIR"] ?? "/srv/ethree10/backups/minio",
      maxAgeHours: numberFromEnv("BACKUP_MINIO_MAX_AGE_HOURS", 192),
      minSizeBytes: numberFromEnv("BACKUP_MINIO_MIN_SIZE_BYTES", 1024),
    },
  ];
}

export function selectLatestBackup(files: BackupFile[]) {
  return files.toSorted((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())[0] ?? null;
}

export function evaluateBackupFreshness(file: BackupFile, target: BackupTarget, now = new Date()): BackupStatus {
  const ageHours = (now.getTime() - file.modifiedAt.getTime()) / (1000 * 60 * 60);

  return {
    ...file,
    ageHours,
    fresh: ageHours <= target.maxAgeHours,
    largeEnough: file.size >= target.minSizeBytes,
  };
}

async function listBackupFiles(directory: string): Promise<BackupFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const path = join(directory, entry.name);
        const info = await stat(path);
        return {
          name: entry.name,
          path,
          size: info.size,
          modifiedAt: info.mtime,
        };
      }),
  );

  return files;
}

export type TargetReport = {
  name: string;
  ok: boolean;
  detail: string;
};

/**
 * Report every target, never throw. A stale uploads archive used to reject
 * first and take the whole run down with it, so the database line — the one
 * that actually matters — was never printed. "Uploads are stale" and "we have
 * no database backup" are very different emergencies and the output has to be
 * able to tell them apart.
 */
export async function checkTarget(target: BackupTarget, now = new Date()): Promise<TargetReport> {
  let latest;
  try {
    latest = selectLatestBackup(await listBackupFiles(target.directory));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { name: target.name, ok: false, detail: `cannot read ${target.directory}: ${reason}` };
  }

  if (!latest) {
    return { name: target.name, ok: false, detail: `no files in ${target.directory}` };
  }

  const status = evaluateBackupFreshness(latest, target, now);
  const facts = `${status.path} age=${status.ageHours.toFixed(1)}h (limit ${target.maxAgeHours}h) size=${status.size} bytes`;

  if (!status.fresh || !status.largeEnough) {
    const why = [
      !status.fresh ? "stale" : null,
      !status.largeEnough ? `smaller than ${target.minSizeBytes} bytes` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    return { name: target.name, ok: false, detail: `${why}: ${facts}` };
  }

  return { name: target.name, ok: true, detail: facts };
}

async function main() {
  const reports = await Promise.all(defaultBackupTargets().map((target) => checkTarget(target)));

  for (const report of reports) {
    console.log(`${report.ok ? "OK  " : "FAIL"} ${report.name}: ${report.detail}`);
  }

  const failed = reports.filter((report) => !report.ok);
  if (failed.length > 0) {
    throw new Error(`${failed.length} of ${reports.length} backup targets failed: ${failed.map((r) => r.name).join(", ")}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
