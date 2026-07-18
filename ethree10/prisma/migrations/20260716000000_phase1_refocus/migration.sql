-- Phase 1: Canonical Agency Model & Renaming Department to Team

-- 1. Rename Department to Team
ALTER TABLE "Department" RENAME TO "Team";
ALTER INDEX "Department_workspaceId_slug_key" RENAME TO "Team_workspaceId_slug_key";

-- 2. Rename columns
ALTER TABLE "Membership" RENAME COLUMN "departmentId" TO "teamId";
ALTER TABLE "SubUnit" RENAME COLUMN "departmentId" TO "teamId";
ALTER TABLE "Project" RENAME COLUMN "agencyDepartmentId" TO "agencyTeamId";
ALTER TABLE "Request" RENAME COLUMN "routedDepartmentId" TO "routedTeamId";
ALTER TABLE "Integration" RENAME COLUMN "departmentId" TO "teamId";

-- 3. Create Position table
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- 4. Add positionId to Membership
ALTER TABLE "Membership" ADD COLUMN "positionId" TEXT;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Membership is staff-only in the link-based client model. Client memberships are removed
-- below before the organization relation is dropped.

-- 5. Rebuild Role safely in one transaction. New enum values cannot be used until an
-- ALTER TYPE ADD VALUE transaction commits, so conversion is performed with CASE expressions.
DELETE FROM "Membership" WHERE "role"::text IN ('client', 'client_viewer');
DELETE FROM "ApprovalRule" WHERE "requiredRole"::text IN ('client', 'client_viewer');

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('super_admin', 'agency_admin', 'team_head', 'team_member', 'finance_admin');

ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role" USING (
  CASE "role"::text
    WHEN 'super_admin' THEN 'super_admin'
    WHEN 'executive' THEN 'agency_admin'
    WHEN 'admin' THEN 'agency_admin'
    WHEN 'department_lead' THEN 'team_head'
    WHEN 'member' THEN 'team_member'
  END
)::"Role";

ALTER TABLE "ApprovalRule" ALTER COLUMN "requiredRole" TYPE "Role" USING (
  CASE "requiredRole"::text
    WHEN 'super_admin' THEN 'super_admin'
    WHEN 'executive' THEN 'agency_admin'
    WHEN 'admin' THEN 'agency_admin'
    WHEN 'department_lead' THEN 'team_head'
    WHEN 'member' THEN 'team_member'
  END
)::"Role";

DROP TYPE "Role_old";

ALTER TABLE "Membership" DROP COLUMN IF EXISTS "organizationId";
CREATE UNIQUE INDEX "Membership_userId_role_teamId_subUnitId_key"
  ON "Membership"("userId", "role", "teamId", "subUnitId");

-- 6. Rename ReportLevel enum value
ALTER TYPE "ReportLevel" RENAME VALUE 'department' TO 'team';

-- Link-only requester identity and contact details.
ALTER TABLE "Request"
  ADD COLUMN "publicToken" TEXT,
  ADD COLUMN "requesterName" TEXT,
  ADD COLUMN "requesterEmail" TEXT,
  ADD COLUMN "requesterPhone" TEXT,
  ALTER COLUMN "submittedById" DROP NOT NULL;
CREATE UNIQUE INDEX "Request_publicToken_key" ON "Request"("publicToken");

ALTER TABLE "RequestStageEvent" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "TaskComment"
  ADD COLUMN "authorName" TEXT,
  ADD COLUMN "authorEmail" TEXT,
  ALTER COLUMN "authorId" DROP NOT NULL;
