-- CreateTable
CREATE TABLE "EventEnvelope" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agencyId" TEXT,
    "actorId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "redactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventEnvelope_tenantId_createdAt_id_idx" ON "EventEnvelope"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EventEnvelope_tenantId_agencyId_createdAt_id_idx" ON "EventEnvelope"("tenantId", "agencyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EventEnvelope_type_createdAt_id_idx" ON "EventEnvelope"("type", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EventEnvelope_correlationId_idx" ON "EventEnvelope"("correlationId");

