-- Phase 2: configurable service catalogue and complete request brief.
ALTER TYPE "RequestStage" ADD VALUE IF NOT EXISTS 'needs_clarification' AFTER 'submitted';

CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "teamId" TEXT,
    "requiredBriefFields" JSONB NOT NULL DEFAULT '[]',
    "expectedDeliverables" JSONB NOT NULL DEFAULT '[]',
    "defaultUrgency" "Urgency" NOT NULL DEFAULT 'medium',
    "defaultSlaHours" INTEGER,
    "requiredReviews" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");
CREATE INDEX "Service_teamId_idx" ON "Service"("teamId");
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

ALTER TABLE "Service" ADD CONSTRAINT "Service_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request"
  ADD COLUMN "serviceId" TEXT,
  ADD COLUMN "expectedOutcome" TEXT,
  ADD COLUMN "expectedDeliverables" TEXT,
  ADD COLUMN "acceptanceCriteria" TEXT,
  ADD COLUMN "supportingLinks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "consentToEmail" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Request_serviceId_idx" ON "Request"("serviceId");
ALTER TABLE "Request" ADD CONSTRAINT "Request_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
