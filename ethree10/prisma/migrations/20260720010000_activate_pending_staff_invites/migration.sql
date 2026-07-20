-- Staff invites in the current app do not have a separate acceptance screen.
-- Treat non-removed invited staff memberships as active so magic-link login
-- does not land them on the staff-access-required page.
UPDATE "Membership"
SET "acceptedAt" = COALESCE("invitedAt", CURRENT_TIMESTAMP)
WHERE "removedAt" IS NULL
  AND "acceptedAt" IS NULL;
