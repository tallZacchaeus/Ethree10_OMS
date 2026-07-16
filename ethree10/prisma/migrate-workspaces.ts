/**
 * Data migration: Workspaces → implicit agency + client Organizations.
 *
 * Run this on an environment with existing Workspace data BEFORE the destructive
 * `prisma db push` that drops the Workspace table. It uses raw SQL (so it does not depend on
 * the Prisma client knowing about the old `Workspace` model) and is idempotent.
 *
 *   npx tsx prisma/migrate-workspaces.ts && npx prisma db push
 *
 * Steps (all guarded so re-runs are safe):
 *   1. Create the `Organization` table + nullable `organizationId` columns on the client-data
 *      tables, alongside the existing `workspaceId` columns.
 *   2. Insert one Organization per NON-agency Workspace (agency becomes implicit).
 *   3. Copy `workspaceId` → `organizationId` on Request/Project/Invoice/Receipt/Lead, mapping
 *      via the workspace→organization correspondence. Agency-owned rows (if any) are left null.
 *   4. Membership: client memberships get `organizationId`; agency-workspace memberships become
 *      staff (`organizationId` stays null).
 *
 * After this, `prisma db push` drops Workspace + the `workspaceId` columns and enforces the
 * NOT NULL on the org columns that should be required.
 *
 * NOTE: this is the production path. Local dev just reseeds (see prisma/seed.ts).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Organization table + organizationId columns (idempotent).
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Organization" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "isExternal" BOOLEAN NOT NULL DEFAULT false,
      "description" TEXT,
      "logoUrl" TEXT,
      "brandColor" TEXT,
      "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
    )`);
  for (const table of ["Request", "Project", "Invoice", "Receipt", "Lead", "Membership"]) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`,
    );
  }

  // 2. One Organization per non-agency Workspace. external_client → isExternal.
  await db.$executeRawUnsafe(`
    INSERT INTO "Organization" ("id", "name", "slug", "isExternal", "description", "logoUrl", "brandColor", "defaultCurrency", "archivedAt", "createdAt", "updatedAt")
    SELECT w."id", w."name", w."slug", (w."type" = 'external_client'),
           w."description", w."logoUrl", w."brandColor", w."defaultCurrency", w."archivedAt", w."createdAt", w."updatedAt"
      FROM "Workspace" w
     WHERE w."type" <> 'agency'
    ON CONFLICT ("id") DO NOTHING`);

  // 3 + 4. Copy workspaceId → organizationId where the workspace became an Organization.
  for (const table of ["Request", "Project", "Invoice", "Receipt", "Lead", "Membership"]) {
    await db.$executeRawUnsafe(`
      UPDATE "${table}" t
         SET "organizationId" = t."workspaceId"
        FROM "Organization" o
       WHERE t."workspaceId" = o."id"
         AND t."organizationId" IS NULL`);
  }

  const orgCount = await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*)::int AS n FROM "Organization"`);
  console.log(`Organizations created/present: ${orgCount[0]?.n ?? 0}`);
  console.log("Workspace→Organization remap complete. Next: run `npx prisma db push`.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
