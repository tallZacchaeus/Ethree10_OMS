/**
 * One-shot data migration: consolidate the legacy 10-role model down to the new 6 roles.
 *
 * Run this BEFORE `prisma db push` in any environment that already holds membership data
 * under the old role names (e.g. production). It is idempotent and safe to re-run.
 *
 *   npx tsx prisma/migrate-roles.ts && npx prisma db push
 *
 * Sequence:
 *   1. Add the new enum values to the Postgres `Role` type (no-op if already present).
 *   2. Remap each legacy role to its new value, deleting rows that would collide with the
 *      membership unique key (userId, workspaceId, role, departmentId, subUnitId) — e.g. a
 *      user holding both agency_admin and agency_lead collapses to a single `admin` row.
 *   3. `prisma db push` then drops the now-unused legacy enum values.
 *
 * `executive` is intentionally NOT produced here — it is a brand-new role assigned by hand to
 * the agency head.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// New enum values that may not yet exist in the database's Role type.
const NEW_VALUES = ["executive", "admin", "client", "client_viewer"] as const;

// Legacy role -> new role. Order matters: roles mapping to the same target are processed
// sequentially so the collision-delete sees rows converted earlier in the loop.
const REMAP: Array<[string, string]> = [
  ["agency_admin", "admin"],
  ["agency_lead", "admin"],
  ["subunit_lead", "department_lead"],
  ["project_manager", "member"],
  ["requester_admin", "client"],
  ["requester_member", "client"],
  ["requester_observer", "client_viewer"],
];

async function enumValues(): Promise<Set<string>> {
  const rows = await db.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role'`,
  );
  return new Set(rows.map((r) => r.enumlabel));
}

async function main() {
  const existing = await enumValues();

  // 1. Add new enum values (each ALTER TYPE auto-commits on its own).
  for (const v of NEW_VALUES) {
    if (!existing.has(v)) {
      await db.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '${v}'`);
      console.log(`+ added enum value Role.${v}`);
    }
  }

  // 2. Remap legacy roles, removing rows that would violate the unique key.
  for (const [oldRole, newRole] of REMAP) {
    if (!existing.has(oldRole)) continue; // already dropped — nothing to do

    const deleted = await db.$executeRawUnsafe(
      `DELETE FROM "Membership" m
         USING "Membership" t
        WHERE m.role = '${oldRole}'::"Role"
          AND t.role = '${newRole}'::"Role"
          AND t."userId" = m."userId"
          AND t."workspaceId" = m."workspaceId"
          AND t."departmentId" IS NOT DISTINCT FROM m."departmentId"
          AND t."subUnitId" IS NOT DISTINCT FROM m."subUnitId"`,
    );
    const updated = await db.$executeRawUnsafe(
      `UPDATE "Membership" SET role = '${newRole}'::"Role" WHERE role = '${oldRole}'::"Role"`,
    );
    if (deleted || updated) {
      console.log(`~ ${oldRole} -> ${newRole}: ${updated} updated, ${deleted} duplicate(s) removed`);
    }
  }

  console.log("Role remap complete. Next: run `npx prisma db push` to drop legacy enum values.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
