-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'invoice_sent';
ALTER TYPE "NotificationKind" ADD VALUE 'invoice_overdue';
ALTER TYPE "NotificationKind" ADD VALUE 'payment_received';
ALTER TYPE "NotificationKind" ADD VALUE 'receipt_issued';
ALTER TYPE "NotificationKind" ADD VALUE 'expense_requested';
ALTER TYPE "NotificationKind" ADD VALUE 'expense_paid';
ALTER TYPE "NotificationKind" ADD VALUE 'budget_decided';
ALTER TYPE "NotificationKind" ADD VALUE 'member_invited';
ALTER TYPE "NotificationKind" ADD VALUE 'member_role_changed';
ALTER TYPE "NotificationKind" ADD VALUE 'member_removed';
ALTER TYPE "NotificationKind" ADD VALUE 'branch_created';
ALTER TYPE "NotificationKind" ADD VALUE 'branch_archived';
ALTER TYPE "NotificationKind" ADD VALUE 'branch_lead_assigned';
ALTER TYPE "NotificationKind" ADD VALUE 'department_created';
ALTER TYPE "NotificationKind" ADD VALUE 'department_archived';
ALTER TYPE "NotificationKind" ADD VALUE 'department_lead_assigned';
ALTER TYPE "NotificationKind" ADD VALUE 'client_created';
ALTER TYPE "NotificationKind" ADD VALUE 'client_archived';
ALTER TYPE "NotificationKind" ADD VALUE 'deliverable_created';
ALTER TYPE "NotificationKind" ADD VALUE 'deliverable_version_added';
ALTER TYPE "NotificationKind" ADD VALUE 'contributors_changed';
ALTER TYPE "NotificationKind" ADD VALUE 'lead_received';
ALTER TYPE "NotificationKind" ADD VALUE 'lead_converted';

