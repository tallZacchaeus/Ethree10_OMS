-- CreateEnum
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('proposed', 'approved', 'rejected', 'superseded');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'assignment_proposed';
ALTER TYPE "NotificationKind" ADD VALUE 'assignment_approved';
ALTER TYPE "NotificationKind" ADD VALUE 'assignment_rejected';

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'proposed',
    "proposedById" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "rationale" JSONB,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_status_idx" ON "TaskAssignment"("taskId", "status");

-- CreateIndex
CREATE INDEX "TaskAssignment_assigneeId_status_idx" ON "TaskAssignment"("assigneeId", "status");

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

