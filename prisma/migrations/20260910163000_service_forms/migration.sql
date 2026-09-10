-- CreateTable
CREATE TABLE "ServiceForm" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "flockId" TEXT,
    "formKind" TEXT NOT NULL,
    "formDate" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFormDraft" (
    "farmId" TEXT NOT NULL,
    "formKind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceFormDraft_pkey" PRIMARY KEY ("farmId","formKind")
);

-- CreateIndex
CREATE INDEX "ServiceForm_farmId_idx" ON "ServiceForm"("farmId");

-- CreateIndex
CREATE INDEX "ServiceForm_visitId_idx" ON "ServiceForm"("visitId");

-- CreateIndex
CREATE INDEX "ServiceForm_formDate_idx" ON "ServiceForm"("formDate");

-- AddForeignKey
ALTER TABLE "ServiceForm" ADD CONSTRAINT "ServiceForm_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceForm" ADD CONSTRAINT "ServiceForm_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceForm" ADD CONSTRAINT "ServiceForm_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "FarmVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFormDraft" ADD CONSTRAINT "ServiceFormDraft_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
