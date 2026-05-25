-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_orderId_fkey";

-- DropForeignKey  
ALTER TABLE "PriceTier" DROP CONSTRAINT IF EXISTS "PriceTier_colorGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_colorGroupId_fkey";

-- AlterEnum - Add new Role values, remove old ones
-- Step 1: Add new values if they don't exist
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'FACTURACION') THEN
  ALTER TYPE "Role" ADD VALUE 'FACTURACION';
 END IF;
END $$;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'VENDEDOR_READONLY') THEN
  ALTER TYPE "Role" ADD VALUE 'VENDEDOR_READONLY';
 END IF;
END $$;

-- Step 2: Update existing VENDEDOR users to FACTURACION (before dropping VENDEDOR)
UPDATE "User" SET role = 'FACTURACION' WHERE role = 'VENDEDOR';

-- AlterEnum - Add PAUSADO status, remove FACTURADO/PAGADO
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'PAUSADO') THEN
  ALTER TYPE "OrderStatus" ADD VALUE 'PAUSADO';
 END IF;
END $$;

-- Update orders with old statuses to new ones
UPDATE "Order" SET status = 'LISTO' WHERE status IN ('FACTURADO', 'PAGADO');

-- CreateTable IgualacionLine
CREATE TABLE "IgualacionLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgualacionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IgualacionLine_code_key" ON "IgualacionLine"("code");

-- AlterTable Order - Remove pricing columns, add igualacionLineId
ALTER TABLE "Order" DROP COLUMN IF EXISTS "totalPrice";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "pricePerLiter";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "invoicedAt";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "paidAt";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "igualacionLineId" TEXT;

-- AlterTable AuditLog - Add oldValues and newValues
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "oldValues" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "newValues" JSONB;

-- DropTable Payment
DROP TABLE IF EXISTS "Payment" CASCADE;

-- DropTable PriceTier  
DROP TABLE IF EXISTS "PriceTier" CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_igualacionLineId_fkey" FOREIGN KEY ("igualacionLineId") REFERENCES "IgualacionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Re-add ColorGroup foreign key (was dropped earlier for safety)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_colorGroupId_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_colorGroupId_fkey" FOREIGN KEY ("colorGroupId") REFERENCES "ColorGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Note: Cannot drop enum values in PostgreSQL directly. Old enum values (VENDEDOR, FACTURADO, PAGADO) 
-- will remain in the enum type but won't be used. This is a PostgreSQL limitation.
-- To fully clean up, you would need to recreate the enum types, which requires more complex migration.
