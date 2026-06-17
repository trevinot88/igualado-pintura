-- ============================================================
-- MIGRATION: Add Igualador (physical operators) table
-- This table stores the real people who process orders on the
-- production floor, independent of the shared system session.
-- ============================================================

-- 1. Create Igualador table (physical operators, not system users)
CREATE TABLE IF NOT EXISTS "Igualador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Igualador_pkey" PRIMARY KEY ("id")
);

-- 2. Add column operadorFisicoId on Order (FK to Igualador, nullable)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "operadorFisicoId" TEXT;

-- 3. Foreign key constraint (nullable — waiting room orders have no operator)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_operadorFisicoId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_operadorFisicoId_fkey"
      FOREIGN KEY ("operadorFisicoId") REFERENCES "Igualador"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Index for analytics/reporting by physical operator
CREATE INDEX IF NOT EXISTS "Order_operadorFisicoId_idx" ON "Order"("operadorFisicoId");
