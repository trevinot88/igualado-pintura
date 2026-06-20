-- ============================================================
-- DATA MIGRATION: Catálogo oficial de vendedores físicos
-- Inserta los 6 vendedores con IDs fijos. Idempotente: se aplica
-- automáticamente con `prisma migrate deploy` en cada deploy y
-- garantiza que el selector de "Vendedor" nunca quede vacío.
-- ============================================================

INSERT INTO "Vendedor" ("id", "nombre", "activo") VALUES
  ('vendedor-francis', 'Francis', true),
  ('vendedor-padilla', 'Padilla', true),
  ('vendedor-garcia',  'García',  true),
  ('vendedor-bodega',  'Bodega',  true),
  ('vendedor-eduardo', 'Eduardo', true),
  ('vendedor-tienda',  'Tienda',  true)
ON CONFLICT ("id") DO UPDATE
  SET "nombre" = EXCLUDED."nombre",
      "activo" = true;
