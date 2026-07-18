-- Phase 3: accountable multi-contributor execution, availability,
-- versioned deliverables, and append-only review history.

CREATE TYPE "AvailabilityType" AS ENUM ('available', 'limited', 'leave');
CREATE TYPE "DeliverableKind" AS ENUM ('file', 'link', 'document', 'deployment', 'campaign', 'other');
CREATE TYPE "DeliverableVisibility" AS ENUM ('internal', 'client');
CREATE TYPE "ReviewDecision" AS ENUM ('approved', 'revisions_required', 'rejected', 'cancelled');

ALTER TABLE "Task"
  ADD COLUMN "acceptanceCriteria" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "TaskContributor" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "positionId" TEXT,
  "contributionRole" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "TaskContributor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAvailability" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AvailabilityType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacityPercent" INTEGER NOT NULL DEFAULT 100,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffAvailability_valid_range" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "StaffAvailability_valid_capacity" CHECK ("capacityPercent" BETWEEN 0 AND 100)
);

CREATE TABLE "Deliverable" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "DeliverableKind" NOT NULL,
  "visibility" "DeliverableVisibility" NOT NULL DEFAULT 'internal',
  "currentRevision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliverableVersion" (
  "id" TEXT NOT NULL,
  "deliverableId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "url" TEXT,
  "content" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverableVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliverableVersion_has_content" CHECK ("url" IS NOT NULL OR "content" IS NOT NULL)
);

CREATE TABLE "TaskReview" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "reviewType" TEXT NOT NULL DEFAULT 'team_head',
  "decision" "ReviewDecision" NOT NULL,
  "feedback" TEXT,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskContributor_taskId_userId_contributionRole_key"
  ON "TaskContributor"("taskId", "userId", "contributionRole");
CREATE INDEX "TaskContributor_userId_removedAt_idx" ON "TaskContributor"("userId", "removedAt");
CREATE INDEX "TaskContributor_taskId_removedAt_idx" ON "TaskContributor"("taskId", "removedAt");
CREATE INDEX "StaffAvailability_userId_startsAt_endsAt_idx" ON "StaffAvailability"("userId", "startsAt", "endsAt");
CREATE INDEX "Deliverable_taskId_visibility_idx" ON "Deliverable"("taskId", "visibility");
CREATE UNIQUE INDEX "DeliverableVersion_deliverableId_revision_key" ON "DeliverableVersion"("deliverableId", "revision");
CREATE INDEX "DeliverableVersion_createdById_idx" ON "DeliverableVersion"("createdById");
CREATE INDEX "TaskReview_taskId_revision_createdAt_idx" ON "TaskReview"("taskId", "revision", "createdAt");
CREATE INDEX "TaskReview_reviewerId_idx" ON "TaskReview"("reviewerId");

ALTER TABLE "TaskContributor" ADD CONSTRAINT "TaskContributor_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskContributor" ADD CONSTRAINT "TaskContributor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskContributor" ADD CONSTRAINT "TaskContributor_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliverableVersion" ADD CONSTRAINT "DeliverableVersion_deliverableId_fkey"
  FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliverableVersion" ADD CONSTRAINT "DeliverableVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskReview" ADD CONSTRAINT "TaskReview_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskReview" ADD CONSTRAINT "TaskReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the historical primary assignee as a normalized contribution.
INSERT INTO "TaskContributor" (
  "id", "taskId", "userId", "contributionRole", "isPrimary", "assignedAt"
)
SELECT
  'phase3_' || md5("id" || ':' || "assigneeUserId"),
  "id",
  "assigneeUserId",
  'Primary contributor',
  true,
  "createdAt"
FROM "Task"
WHERE "assigneeUserId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Seed an immutable review record for legacy tasks that already carry review metadata.
INSERT INTO "TaskReview" (
  "id", "taskId", "reviewerId", "reviewType", "decision", "feedback", "revision", "createdAt"
)
SELECT
  'phase3_review_' || md5("id" || ':' || "reviewedById"),
  "id",
  "reviewedById",
  'team_head',
  CASE WHEN "status" = 'done' THEN 'approved'::"ReviewDecision" ELSE 'revisions_required'::"ReviewDecision" END,
  NULL,
  1,
  COALESCE("reviewedAt", "updatedAt")
FROM "Task"
WHERE "reviewedById" IS NOT NULL
ON CONFLICT DO NOTHING;
