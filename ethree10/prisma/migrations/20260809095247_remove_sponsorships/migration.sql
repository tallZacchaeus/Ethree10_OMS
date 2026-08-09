/*
  Warnings:

  - You are about to drop the `Sponsorship` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sponsorship" DROP CONSTRAINT "Sponsorship_projectId_fkey";

-- DropTable
DROP TABLE "Sponsorship";

-- DropEnum
DROP TYPE "SponsorshipStatus";
