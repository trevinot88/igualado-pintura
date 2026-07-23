-- CreateTable: WhatsAppSession
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "creds" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WhatsAppKey
CREATE TABLE "WhatsAppKey" (
    "type" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppKey_pkey" PRIMARY KEY ("type", "keyId")
);

-- CreateIndex
CREATE INDEX "WhatsAppKey_type_idx" ON "WhatsAppKey"("type");