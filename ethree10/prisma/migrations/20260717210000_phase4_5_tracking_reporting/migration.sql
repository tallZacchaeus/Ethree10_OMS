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
