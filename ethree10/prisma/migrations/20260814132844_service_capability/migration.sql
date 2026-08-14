-- CreateTable
CREATE TABLE "ServiceCapability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL DEFAULT 'intermediate',
    "revokedAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceCapability_serviceId_revokedAt_idx" ON "ServiceCapability"("serviceId", "revokedAt");

-- CreateIndex
CREATE INDEX "ServiceCapability_userId_revokedAt_idx" ON "ServiceCapability"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCapability_userId_serviceId_key" ON "ServiceCapability"("userId", "serviceId");

-- AddForeignKey
ALTER TABLE "ServiceCapability" ADD CONSTRAINT "ServiceCapability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCapability" ADD CONSTRAINT "ServiceCapability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

