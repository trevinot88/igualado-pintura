-- Migration: Add Vendedor (physical sellers) table and vendedorId FK on orders

-- Create table Vendedor (physical sellers, not system users)
CREATE TABLE "Vendedor" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "actualizadoAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add vendedorId column to "Order" (nullable FK)
ALTER TABLE "Order" ADD COLUMN "vendedorId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendedorId_fkey"
    FOREIGN KEY ("vendedorId") REFERENCES "Vendedor"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX "Order_vendedorId_idx" ON "Order"("vendedorId");
