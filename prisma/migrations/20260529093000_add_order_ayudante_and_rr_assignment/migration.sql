-- Add ayudante support on Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ayudanteId" TEXT;

-- Index for reporting/filtering by helper
CREATE INDEX IF NOT EXISTS "Order_ayudanteId_idx" ON "Order"("ayudanteId");

-- Foreign key to User (optional helper)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_ayudanteId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_ayudanteId_fkey"
      FOREIGN KEY ("ayudanteId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
