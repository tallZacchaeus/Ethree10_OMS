-- The workspace model was removed from Prisma, but production still has legacy
-- workspaceId columns. Keep their historical values while allowing new writes
-- from the workspace-free schema.
ALTER TABLE "ApprovalRule" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Membership" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "ScorecardConfig" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Team" ALTER COLUMN "workspaceId" DROP NOT NULL;
