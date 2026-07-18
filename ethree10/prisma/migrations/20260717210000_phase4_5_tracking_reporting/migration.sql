-- Workspace-to-organization transition for existing production data.
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isExternal" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "logoUrl" TEXT,
  "brandColor" TEXT,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

INSERT INTO "Organization" (
  "id", "name", "slug", "isExternal", "createdAt", "updatedAt"
)
SELECT
  "id",
  "name",
  "slug",
  "slug" <> 'ethree10',
  "createdAt",
  "updatedAt"
FROM "Workspace"
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Request" SET "organizationId" = "workspaceId" WHERE "organizationId" IS NULL;
ALTER TABLE "Request" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Request_organizationId_idx" ON "Request"("organizationId");
ALTER TABLE "Request" ADD CONSTRAINT "Request_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Project" SET "organizationId" = "workspaceId" WHERE "organizationId" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Project_organizationId_idx" ON "Project"("organizationId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Invoice" SET "organizationId" = "workspaceId" WHERE "organizationId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Receipt" SET "organizationId" = "workspaceId" WHERE "organizationId" IS NULL;
ALTER TABLE "Receipt" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Receipt_organizationId_idx" ON "Receipt"("organizationId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Lead" SET "organizationId" = "workspaceId" WHERE "organizationId" IS NULL;
CREATE INDEX IF NOT EXISTS "Lead_organizationId_idx" ON "Lead"("organizationId");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 4: revocable capability links and client delivery decisions.
ALTER TABLE "Request"
  ADD COLUMN "publicTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "publicTokenRevokedAt" TIMESTAMP(3);

UPDATE "Request"
SET "publicTokenExpiresAt" = "createdAt" + INTERVAL '1 year'
WHERE "publicToken" IS NOT NULL AND "publicTokenExpiresAt" IS NULL;

ALTER TABLE "Project" ADD COLUMN "clientRevision" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "ClientDecisionType" AS ENUM ('accepted', 'changes_requested');

CREATE TABLE "ClientDecision" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "decision" "ClientDecisionType" NOT NULL,
  "projectRevision" INTEGER NOT NULL,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientDecision_projectId_createdAt_idx" ON "ClientDecision"("projectId", "createdAt");
ALTER TABLE "ClientDecision" ADD CONSTRAINT "ClientDecision_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 5: immutable/finalizable contribution reports.
ALTER TYPE "ReportLevel" ADD VALUE IF NOT EXISTS 'organization';
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'finalized');
CREATE TYPE "ContributionType" AS ENUM ('assignment', 'completion', 'deliverable', 'time', 'collaboration', 'review', 'revision', 'blocker');

ALTER TABLE "Report"
  ADD COLUMN "narrative" JSONB,
  ADD COLUMN "status" "ReportStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
  ADD COLUMN "cutoffAt" TIMESTAMP(3),
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "organizationId" TEXT;

UPDATE "Report" SET "cutoffAt" = "periodEnd" + INTERVAL '1 millisecond' WHERE "cutoffAt" IS NULL;
ALTER TABLE "Report" ALTER COLUMN "cutoffAt" SET NOT NULL;

ALTER TABLE "Report" ADD CONSTRAINT "Report_finalizedById_fkey"
  FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReportContribution" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "type" "ContributionType" NOT NULL,
  "userId" TEXT,
  "taskId" TEXT,
  "projectId" TEXT,
  "organizationId" TEXT,
  "teamId" TEXT,
  "summary" TEXT NOT NULL,
  "outcome" TEXT,
  "effortHours" DECIMAL(8,2),
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "ReportContribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportContribution_reportId_sourceKey_key" ON "ReportContribution"("reportId", "sourceKey");
CREATE INDEX "ReportContribution_reportId_userId_idx" ON "ReportContribution"("reportId", "userId");
CREATE INDEX "ReportContribution_organizationId_occurredAt_idx" ON "ReportContribution"("organizationId", "occurredAt");
CREATE INDEX "ReportContribution_teamId_occurredAt_idx" ON "ReportContribution"("teamId", "occurredAt");
ALTER TABLE "ReportContribution" ADD CONSTRAINT "ReportContribution_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReportAmendment" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "amendedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousMetrics" JSONB NOT NULL,
  "previousNarrative" JSONB,
  "newMetrics" JSONB NOT NULL,
  "newNarrative" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportAmendment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportAmendment_reportId_createdAt_idx" ON "ReportAmendment"("reportId", "createdAt");
ALTER TABLE "ReportAmendment" ADD CONSTRAINT "ReportAmendment_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportAmendment" ADD CONSTRAINT "ReportAmendment_amendedById_fkey"
  FOREIGN KEY ("amendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
