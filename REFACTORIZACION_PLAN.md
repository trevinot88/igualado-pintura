# Plan de Refactorización - Igualado Pintura

**Fecha**: 25 Mayo 2026  
**Proyecto**: /tmp/igualado-pintura

## Resumen Ejecutivo

Refactorización completa del sistema para eliminar lógica financiera y enfocar en flujo operativo y trazabilidad.

---

## 1. ELIMINACIÓN DE LÓGICA FINANCIERA

### Base de Datos (Schema Prisma)

**ELIMINAR modelos completos:**
- `Payment` - Tabla completa de pagos
- `PriceTier` - Niveles de precios por grupo de color
- Enum `PaymentMethod`

**ELIMINAR campos en Order:**
- `pricePerLiter` 
- `totalPrice`
- `invoicedAt`
- `paidAt`

**ELIMINAR estados en OrderStatus:**
- `FACTURADO` 
- `PAGADO`

**NUEVOS estados en OrderStatus:**
- Mantener: `PENDIENTE`, `EN_PROCESO`, `LISTO`, `ENTREGADO`, `CANCELADO`
- Agregar: `PAUSADO`

### Backend (Rutas API)

**ELIMINAR completamente:**
- `/app/api/precios/` - Todo el directorio
- `/lib/pricing.ts` - Lógica de cálculo de precios

**MODIFICAR:**
- `/app/api/pedidos/route.ts` - Quitar cálculo de precio en POST
- `/lib/permissions.ts` - Eliminar `canManagePrices()`

### Frontend (Componentes)

**ELIMINAR/OCULTAR:**
- `/app/dashboard/precios/` - Página completa de gestión de precios
- Campos de precio en formularios de pedidos
- Columnas de precio en tablas de pedidos
- Referencias a pagos/facturación

---

## 2. FOLIO DINÁMICO DIARIO

### Cambios en Base de Datos

**MODIFICAR modelo FolioSequence:**
```prisma
model FolioSequence {
  id        String @id // Nuevo formato: "YYMMDD"
  lastValue Int    @default(0)
}
```

### Backend

**REFACTORIZAR `/lib/folio.ts`:**
```typescript
// Nuevo formato: YYMMDD-XX (resetea cada día)
// Ejemplo: 260525-01, 260525-02, ... 260525-99
export async function generateFolio(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `${yy}${mm}${dd}`;
  
  // Lógica de upsert con tx.folioSequence
  // Formato final: YYMMDD-XX
}
```

---

## 3. CATÁLOGOS DINÁMICOS

### Base de Datos

**CREAR nuevo modelo para Líneas de Igualación:**
```prisma
model IgualacionLine {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String?
  active      Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
}
```

**MODIFICAR ColorGroup:**
- Ya existe, solo asegurar que sea editable vía CRUD admin

**AGREGAR campo en Order:**
```prisma
model Order {
  // ... campos existentes
  igualacionLineId String?
  igualacionLine   IgualacionLine? @relation(...)
}
```

### Backend

**CREAR nuevas rutas:**
- `/app/api/igualacion-lines/route.ts` - CRUD completo (solo ADMIN)
- `/app/api/color-groups/route.ts` - CRUD completo (solo ADMIN)

### Frontend

**CREAR nuevas páginas:**
- `/app/dashboard/catalogos/grupos-color/page.tsx`
- `/app/dashboard/catalogos/lineas-igualacion/page.tsx`

---

## 4. AUDITORÍA ESTRICTA

### Base de Datos

**AMPLIAR AuditLog (ya existe, mejorar):**
```prisma
model AuditLog {
  id           String      @id @default(cuid())
  userId       String?
  user         User?       @relation(...)
  action       AuditAction
  entity       String      // "Order", "ColorGroup", etc
  entityId     String?
  oldValues    Json?       // Estado anterior
  newValues    Json?       // Estado nuevo
  changes      Json?       // Diff específico
  metadata     Json?       // Info adicional
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime    @default(now())
}
```

**AGREGAR a AuditAction:**
- `ORDER_EDITED`
- `ORDER_PAUSED`
- `ORDER_QUEUE_MOVED`
- `WHATSAPP_SENT`

### Backend

**REFACTORIZAR `/lib/audit.ts`:**
```typescript
export async function logOrderEdit(
  userId: string,
  orderId: string,
  oldData: any,
  newData: any,
  metadata?: any
) {
  // Calcular diff y guardar en AuditLog
}
```

**IMPLEMENTAR auditoría automática:**
- En PATCH `/api/pedidos/[id]` - Log automático de cambios
- En POST `/api/produccion/reorder` - Log de reordenamientos
- En cambios de estado - Log con before/after

---

## 5. RBAC REFACTORIZADO (4 ROLES)

### Base de Datos

**MODIFICAR enum Role:**
```prisma
enum Role {
  ADMIN              // ID 1 - Control total
  FACTURACION        // ID 2 - Crear pedidos/clientes, cerrar entregas
  IGUALADOR          // ID 3 - Cola FIFO producción
  VENDEDOR_READONLY  // ID 4 - Solo lectura
}
```

**NOTA:** Migrar usuarios existentes con role "VENDEDOR" → "VENDEDOR_READONLY"

### Backend - Permisos Nuevos

**REFACTORIZAR `/lib/permissions.ts`:**

```typescript
// ROL 1: ADMIN - Control total
export function canManageCatalogs(role: Role): boolean {
  return role === "ADMIN";
}

export function canPauseOrder(role: Role): boolean {
  return role === "ADMIN";
}

export function canReorderQueue(role: Role): boolean {
  return role === "ADMIN";
}

// ROL 2: FACTURACION - Crear clientes y pedidos, cerrar entregas
export function canCreateOrder(role: Role): boolean {
  return role === "ADMIN" || role === "FACTURACION";
}

export function canCreateClient(role: Role): boolean {
  return role === "ADMIN" || role === "FACTURACION";
}

export function canMarkAsDelivered(role: Role): boolean {
  return role === "ADMIN" || role === "FACTURACION";
}

// ROL 3: IGUALADOR - Cola FIFO
export function canStartProduction(role: Role): boolean {
  return role === "ADMIN" || role === "IGUALADOR";
}

export function canCompleteOrder(role: Role): boolean {
  return role === "ADMIN" || role === "IGUALADOR";
}

// ROL 4: VENDEDOR_READONLY - Solo lectura
export function canViewOrders(role: Role): boolean {
  return true; // Todos pueden ver (filtrado por scope)
}

export function canEditOrder(role: Role): boolean {
  return role === "ADMIN"; // Solo admin puede editar
}
```

**ACTUALIZAR transiciones de estado:**
```typescript
const TRANSITIONS: Record<string, Record<string, Role[]>> = {
  PENDIENTE: {
    EN_PROCESO: ["ADMIN", "IGUALADOR"],
    CANCELADO: ["ADMIN"],
    PAUSADO: ["ADMIN"],
  },
  EN_PROCESO: {
    LISTO: ["ADMIN", "IGUALADOR"],
    CANCELADO: ["ADMIN"],
    PAUSADO: ["ADMIN"],
  },
  LISTO: {
    ENTREGADO: ["ADMIN", "CAJA"],
  },
  PAUSADO: {
    PENDIENTE: ["ADMIN"],
  },
  ENTREGADO: {},
  CANCELADO: {},
};
```

### Frontend

**MODIFICAR vistas por rol:**
- FACTURACION: Formulario de pedidos + selector de vendedor que atendió
- VENDEDOR_READONLY: Dashboard de solo lectura (sus pedidos)
- IGUALADOR: Cola de producción FIFO (solo siguiente pedido activo)
- ADMIN: Panel de control total + excepciones

---

## 6. COLA FIFO RÍGIDA

### Backend

**CREAR lógica de validación:**

```typescript
// En /app/api/produccion/start/route.ts
export async function POST(req: Request) {
  const { orderId } = await req.json();
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "IGUALADOR"]);
  
  // Verificar que sea el pedido en turno
  const nextInQueue = await prisma.order.findFirst({
    where: { 
      status: "PENDIENTE",
      // Excluir pausados
    },
    orderBy: { queuePosition: "asc" },
  });
  
  if (nextInQueue?.id !== orderId && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Debe completar el pedido anterior en la cola" },
      { status: 403 }
    );
  }
  
  // Permitir inicio
  await prisma.order.update({
    where: { id: orderId },
    data: { 
      status: "EN_PROCESO",
      igualadorId: user.id,
      startedAt: new Date(),
    },
  });
  
  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: "PENDIENTE",
    to: "EN_PROCESO",
  });
  
  return NextResponse.json({ success: true });
}
```

**CREAR endpoints de administración:**
- `POST /api/admin/queue/pause` - Pausar pedido
- `POST /api/admin/queue/resume` - Reanudar pedido pausado
- `POST /api/admin/queue/reorder` - Reordenar manualmente
- `POST /api/admin/queue/skip` - Saltar pedido (moverlo al final)

### Frontend

**MODIFICAR página de producción:**
- Mostrar solo el pedido actual (no toda la cola)
- Deshabilitar botón para pedidos futuros
- Indicador visual: "En espera de: Pedido #260525-03"
- Vista de admin: Botones de pausa/reorden/skip

---

## 7. TRIGGERS PARA EVENTOS

### Base de Datos

**AGREGAR a AuditAction (si no existe):**
- `WHATSAPP_SENT`
- `LABEL_PRINTED` (ya existe)

### Backend

**CREAR servicios:**

```typescript
// /lib/notifications.ts
export async function sendWhatsAppNotification(
  phone: string,
  orderFolio: string,
  clientName: string
) {
  // Integración con API de WhatsApp (ej: Twilio, Meta)
  // Mensaje: "Hola {clientName}, tu pedido {folio} está listo para recoger"
  
  // Guardar en AuditLog
  await logAudit(null, "WHATSAPP_SENT", "Order", orderId, {
    phone,
    folio: orderFolio,
  });
}

// /lib/label-printer.ts
export async function generateLabel(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { 
      client: true, 
      colorGroup: true,
      igualacionLine: true,
    },
  });
  
  const labelData = {
    folio: order.folio,
    clientName: order.client.name,
    phone: order.client.phone,
    colorGroup: order.colorGroup.name,
    colorName: order.colorName,
    liters: order.liters,
    line: order.igualacionLine?.name,
  };
  
  // Guardar en tabla Label
  await prisma.label.create({
    data: {
      orderId,
      content: labelData,
    },
  });
  
  // Guardar en AuditLog
  await logAudit(null, "LABEL_PRINTED", "Order", orderId);
  
  return labelData;
}
```

**IMPLEMENTAR en transición a LISTO:**
```typescript
// En /app/api/pedidos/[id]/route.ts o produccion/complete
if (newStatus === "LISTO") {
  // Triggers automáticos
  const labelData = await generateLabel(orderId);
  
  if (order.client.phone) {
    await sendWhatsAppNotification(
      order.client.phone,
      order.folio,
      order.client.name
    );
  }
  
  // Retornar labelData para impresión en frontend
  return NextResponse.json({ 
    success: true, 
    label: labelData 
  });
}
```

---

## ORDEN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1: Base de Datos (CRÍTICO - Hacer primero)
1. ✅ Backup de BD actual
2. Crear migración Prisma para:
   - Eliminar Payment, PriceTier, PaymentMethod
   - Eliminar campos de precio en Order
   - Modificar FolioSequence (id format)
   - Crear IgualacionLine
   - Actualizar Role enum (agregar CAJA, VENDEDOR_READONLY)
   - Actualizar OrderStatus enum (agregar PAUSADO, quitar FACTURADO/PAGADO)
   - Ampliar AuditLog (oldValues, newValues)
3. Migrar datos existentes (usuarios VENDEDOR → VENDEDOR_READONLY)
4. `npx prisma migrate dev --name refactor-business-logic`
5. `npx prisma generate`

### Fase 2: Backend Core
1. Refactorizar `/lib/folio.ts` (formato YYMMDD-XX)
2. Eliminar `/lib/pricing.ts`
3. Actualizar `/lib/permissions.ts` (nuevos roles y permisos)
4. Refactorizar `/lib/audit.ts` (oldValues/newValues)
5. Actualizar `/app/api/pedidos/route.ts` (quitar cálculo de precio)
6. Actualizar `/app/api/pedidos/[id]/route.ts` (auditoría en edición)

### Fase 3: RBAC y Validaciones
1. Crear middleware de validación de rol por ruta
2. Implementar validaciones en:
   - Crear cliente (solo FACTURACION/ADMIN)
   - Crear pedido (solo FACTURACION/ADMIN)
   - Iniciar producción (IGUALADOR/ADMIN + validación FIFO)
   - Completar pedido (IGUALADOR/ADMIN)
   - Marcar entregado (FACTURACION/ADMIN)

### Fase 4: Catálogos Dinámicos
1. Crear `/app/api/igualacion-lines/route.ts`
2. Crear `/app/api/igualacion-lines/[id]/route.ts`
3. Crear `/app/api/color-groups/route.ts` (si no existe)
4. Crear `/app/api/color-groups/[id]/route.ts`

### Fase 5: Cola FIFO y Admin
1. Crear `/app/api/produccion/start/route.ts` (con validación FIFO)
2. Crear `/app/api/produccion/complete/route.ts`
3. Crear `/app/api/admin/queue/pause/route.ts`
4. Crear `/app/api/admin/queue/resume/route.ts`
5. Crear `/app/api/admin/queue/reorder/route.ts`

### Fase 6: Triggers y Notificaciones
1. Crear `/lib/notifications.ts`
2. Crear `/lib/label-printer.ts`
3. Integrar en flujo de completado (LISTO)
4. Configurar variables de entorno para WhatsApp API

### Fase 7: Frontend
1. Eliminar `/app/dashboard/precios/`
2. Actualizar `/app/dashboard/pedidos/` (quitar columnas de precio)
3. Crear `/app/dashboard/catalogos/` con subpáginas
4. Refactorizar `/app/dashboard/produccion/` (cola FIFO)
5. Crear vistas específicas por rol
6. Actualizar formulario de pedidos (agregar selector de vendedor para FACTURACION)

### Fase 8: Testing y Deploy
1. Probar flujo completo por cada rol
2. Verificar cola FIFO (no permitir saltar)
3. Verificar triggers (etiqueta + WhatsApp)
4. Probar excepciones de admin (pausar/reordenar)
5. Deploy a Render
6. Verificar en producción

---

## ARCHIVOS A MODIFICAR/ELIMINAR

### ELIMINAR
- ❌ `/lib/pricing.ts`
- ❌ `/app/api/precios/*` (directorio completo)
- ❌ `/app/dashboard/precios/*` (directorio completo)

### MODIFICAR
- ✏️ `/prisma/schema.prisma` (cambios críticos)
- ✏️ `/lib/folio.ts` (formato diario)
- ✏️ `/lib/permissions.ts` (4 roles nuevos)
- ✏️ `/lib/audit.ts` (oldValues/newValues)
- ✏️ `/app/api/pedidos/route.ts` (quitar pricing)
- ✏️ `/app/api/pedidos/[id]/route.ts` (auditoría)
- ✏️ `/app/api/produccion/*` (cola FIFO)
- ✏️ `/app/dashboard/pedidos/*` (sin precios)
- ✏️ `/app/dashboard/produccion/*` (FIFO UI)
- ✏️ `/components/sidebar.tsx` (quitar link a precios)

### CREAR
- ➕ `/lib/notifications.ts`
- ➕ `/lib/label-printer.ts`
- ➕ `/app/api/igualacion-lines/route.ts`
- ➕ `/app/api/igualacion-lines/[id]/route.ts`
- ➕ `/app/api/color-groups/route.ts`
- ➕ `/app/api/color-groups/[id]/route.ts`
- ➕ `/app/api/admin/queue/pause/route.ts`
- ➕ `/app/api/admin/queue/resume/route.ts`
- ➕ `/app/api/admin/queue/reorder/route.ts`
- ➕ `/app/dashboard/catalogos/page.tsx`
- ➕ `/app/dashboard/catalogos/grupos-color/page.tsx`
- ➕ `/app/dashboard/catalogos/lineas-igualacion/page.tsx`

---

## NOTAS IMPORTANTES

### Migración de Datos
- Usuarios con role "VENDEDOR" → migrar a "VENDEDOR_READONLY"
- Pedidos con estados FACTURADO/PAGADO → migrar a ENTREGADO
- FolioSequence actual (YYMM) → regenerar con formato YYMMDD

### Variables de Entorno Nuevas
```env
WHATSAPP_API_KEY=xxx
WHATSAPP_API_URL=https://api.twilio.com/...
LABEL_PRINTER_URL=http://printer.local/api/print
```

### Testing Crítico
- ✅ FIFO: Igualador NO puede abrir pedido N+1 sin completar N
- ✅ RBAC: Vendedor NO puede crear pedidos
- ✅ RBAC: Solo CAJA puede marcar como entregado
- ✅ Admin puede pausar/reordenar sin restricciones
- ✅ Auditoría registra todos los cambios
- ✅ WhatsApp se envía al completar pedido
- ✅ Etiqueta se genera automáticamente

### Rollback Plan
- Mantener backup de BD antes de migración
- Mantener rama git "pre-refactor" por 30 días
- Documentar proceso de rollback si falla en producción

---

## ESTIMACIÓN DE TIEMPO

- Fase 1 (BD): 2-3 horas
- Fase 2 (Backend Core): 3-4 horas
- Fase 3 (RBAC): 2-3 horas
- Fase 4 (Catálogos): 2-3 horas
- Fase 5 (Cola FIFO): 3-4 horas
- Fase 6 (Triggers): 2-3 horas
- Fase 7 (Frontend): 4-6 horas
- Fase 8 (Testing): 3-4 horas

**TOTAL ESTIMADO: 21-30 horas de desarrollo**

---

## PRÓXIMOS PASOS

1. ✅ Revisar y aprobar este plan con stakeholders
2. ⏳ Crear backup de BD actual
3. ⏳ Crear rama git "refactor-business-logic"
4. ⏳ Empezar con Fase 1 (Migración de BD)
5. ⏳ Implementar fases 2-8 secuencialmente
6. ⏳ Testing completo en ambiente de desarrollo
7. ⏳ Deploy a producción con plan de rollback

---

**Documento creado**: 25 Mayo 2026  
**Última actualización**: 25 Mayo 2026  
**Autor**: GitHub Copilot  
**Proyecto**: igualado-pintura
