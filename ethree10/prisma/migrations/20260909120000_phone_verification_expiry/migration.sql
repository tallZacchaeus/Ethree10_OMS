-- A phone verification code that never expires is a six-digit secret with
-- unlimited time to guess it. Additive and nullable: rows written before this
-- migration have no expiry recorded, and the application treats a code with no
-- expiry as already expired rather than as valid forever.
ALTER TABLE "User" ADD COLUMN "phoneVerificationExpiresAt" TIMESTAMP(3);
