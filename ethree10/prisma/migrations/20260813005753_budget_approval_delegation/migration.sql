-- CreateTable
CREATE TABLE "BudgetApprovalDelegation" (
    "id" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetApprovalDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetApprovalDelegation_delegateId_expiresAt_idx" ON "BudgetApprovalDelegation"("delegateId", "expiresAt");

-- CreateIndex
CREATE INDEX "BudgetApprovalDelegation_revokedAt_idx" ON "BudgetApprovalDelegation"("revokedAt");

-- AddForeignKey
ALTER TABLE "BudgetApprovalDelegation" ADD CONSTRAINT "BudgetApprovalDelegation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetApprovalDelegation" ADD CONSTRAINT "BudgetApprovalDelegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetApprovalDelegation" ADD CONSTRAINT "BudgetApprovalDelegation_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

