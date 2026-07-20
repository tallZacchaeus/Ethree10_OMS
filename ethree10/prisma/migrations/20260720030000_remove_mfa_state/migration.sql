-- MFA has been removed from the application. Clear existing MFA state so no
-- user remains blocked by legacy two-factor requirements.
UPDATE "User"
SET
  "mfaEnabled" = false,
  "mfaSecret" = NULL,
  "mfaRecoveryCodes" = ARRAY[]::TEXT[];
