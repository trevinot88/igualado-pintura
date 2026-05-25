# Migración: Refactorización Completa - Eliminación de Precios

**Fecha:** 2026-05-25  
**Nombre:** `refactor_remove_pricing_complete`  
**Tipo:** BREAKING CHANGES - Pérdida de datos

## ⚠️ ADVERTENCIAS CRÍTICAS

Esta migración es **DESTRUCTIVA** y causará **PÉRDIDA PERMANENTE DE DATOS**:

- ✅ Se eliminarán las tablas `Payment` y `PriceTier` completamente
- ✅ Se eliminarán las columnas `totalPrice`, `pricePerLiter`, `invoicedAt`, `paidAt` de la tabla `Order`
- ✅ Los pedidos con estado `FACTURADO` o `PAGADO` se convertirán a `LISTO`
- ✅ Los usuarios con rol `VENDEDOR` se convertirán a `FACTURACION`

**NO HAY FORMA DE REVERTIR ESTOS CAMBIOS** una vez aplicados.

## 📋 Cambios Incluidos

### Tablas Eliminadas
- `Payment` - Todos los registros de pagos se perderán
- `PriceTier` - Todos los niveles de precios se perderán

### Nueva Tabla
- `IgualacionLine` - Catálogo de líneas de igualación (Comex, Berel, etc.)

### Modificaciones a Tabla `Order`
- **Columnas eliminadas:** `totalPrice`, `pricePerLiter`, `invoicedAt`, `paidAt`
- **Columnas agregadas:** `igualacionLineId` (opcional)

### Modificaciones a Tabla `AuditLog`
- **Columnas agregadas:** `oldValues` (JSONB), `newValues` (JSONB)

### Cambios a Enums
- **Role:** Agregado `FACTURACION`, `VENDEDOR_READONLY`; deprecado `VENDEDOR`
- **OrderStatus:** Agregado `PAUSADO`; deprecado `FACTURADO`, `PAGADO`

## 🔧 Cómo Aplicar la Migración

### Opción 1: Desarrollo Local (con base de datos local)

```bash
# Asegúrate de tener DATABASE_URL configurado en .env
npx prisma migrate deploy
```

### Opción 2: Producción en Render

1. **Hacer backup de la base de datos:**
   ```bash
   # Desde Render Dashboard > Database > Manual Backups
   # O usando pg_dump si tienes acceso directo
   ```

2. **Aplicar migración en Render Shell:**
   ```bash
   # Abrir Shell en Render Dashboard
   npx prisma migrate deploy
   ```

3. **Verificar aplicación:**
   ```bash
   npx prisma db execute --stdin <<SQL
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('Payment', 'PriceTier', 'IgualacionLine');
   SQL
   ```

   Deberías ver solo `IgualacionLine` (Payment y PriceTier no deberían aparecer).

### Opción 3: Sin Base de Datos (Solo para desarrollo)

Si solo quieres generar el cliente Prisma sin aplicar la migración:

```bash
npx prisma generate
```

## 📊 Verificación Post-Migración

Ejecuta estos queries en PostgreSQL para verificar:

```sql
-- Verificar que Payment y PriceTier ya no existen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Payment', 'PriceTier');
-- Resultado esperado: 0 rows

-- Verificar que IgualacionLine existe
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'IgualacionLine';
-- Resultado esperado: 1 row

-- Verificar columnas nuevas en Order
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'Order' 
AND column_name = 'igualacionLineId';
-- Resultado esperado: 1 row

-- Verificar que no existen pedidos con estados antiguos
SELECT DISTINCT status FROM "Order";
-- No debería aparecer FACTURADO ni PAGADO

-- Verificar que no existen usuarios con rol VENDEDOR
SELECT DISTINCT role FROM "User";
-- No debería aparecer VENDEDOR (todos convertidos a FACTURACION)
```

## 🔄 Siguientes Pasos Después de la Migración

1. **Ejecutar seed (opcional):**
   ```bash
   npx prisma db seed
   ```

2. **Verificar que la aplicación funciona:**
   - Crear un nuevo pedido
   - Verificar que no aparecen campos de precio
   - Probar transiciones de estado (incluido PAUSADO)
   - Verificar catálogos de ColorGroup e IgualacionLine

3. **Monitorear logs** por errores relacionados con campos faltantes

## 🚨 Rollback (Solo Posible ANTES de Aplicar)

Si decides NO aplicar esta migración:

1. Revertir código a commit anterior:
   ```bash
   git revert 1796b4b  # Phase 3 commit
   git revert 22a5c0a  # Phase 2 commit
   ```

2. Eliminar archivo de migración:
   ```bash
   rm -rf prisma/migrations/20260525130529_refactor_remove_pricing_complete/
   ```

3. Regenerar cliente Prisma:
   ```bash
   npx prisma generate
   ```

## 📝 Notas Técnicas

- Los valores antiguos de enums (`VENDEDOR`, `FACTURADO`, `PAGADO`) permanecerán en el tipo enum de PostgreSQL debido a limitaciones del motor. No causan problemas pero no se pueden eliminar sin recrear los enums completamente.
- La migración usa transacciones implícitas para garantizar atomicidad.
- Todos los constraints de foreign key se manejan con `CASCADE` o `SET NULL` según corresponda.

## ✅ Completado Por

- **Backend:** ✅ Phase 2 (commit 22a5c0a)
- **Frontend:** ✅ Phase 3 (commit 1796b4b)  
- **Migración:** ⏳ Pendiente de aplicar
- **Seed:** ✅ Actualizado

---

**Archivo generado:** 2026-05-25  
**Última actualización:** 2026-05-25
