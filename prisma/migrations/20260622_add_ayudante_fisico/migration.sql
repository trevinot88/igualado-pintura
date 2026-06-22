-- ============================================================
-- MIGRATION: Add ayudanteFisicoId to Order
-- This links the physical helper (from Catálogo de Igualadores
-- Físicos) who assisted in completing an order.
-- ============================================================

-- 1. Add column ayudanteFisicoId on Order (FK to Igualador, nullable)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ayudanteFisicoId" TEXT;

-- 2. Foreign key constraint (nullable — optional helper)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_ayudanteFisicoId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_ayudanteFisicoId_fkey"
      FOREIGN KEY ("ayudanteFisicoId") REFERENCES "Igualador"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Index for analytics/reporting by physical helper
CREATE INDEX IF NOT EXISTS "Order_ayudanteFisicoId_idx" ON "Order"("ayudanteFisicoId");
