# Instrucción para IA Programador: Admin puede tomar pedidos fuera de orden en Producción

## Objetivo

En la pantalla de **Producción** (`/dashboard/produccion`), actualmente los pedidos solo se pueden tomar en orden FIFO (el primero de la cola). Se necesita que los usuarios con rol **ADMIN** puedan tomar **cualquier** pedido pendiente, sin importar su posición en la cola. Los usuarios con rol **IGUALADOR** deben mantener la restricción actual (solo el siguiente en la cola).

---

## Contexto del código actual

### 1. Frontend — `app/dashboard/produccion/page.tsx`

En la **línea 272**, el botón "Tomar Siguiente" solo se muestra cuando el pedido es el primero de la cola:

```tsx
{order.id === nextInQueue?.id && (role === "ADMIN" || role === "IGUALADOR") && (
  <Button
    size="sm"
    className="mt-2 w-full"
    onClick={() => handleTakeOrder(order)}
  >
    <Play className="h-4 w-4 mr-1" /> Tomar Siguiente
  </Button>
)}
```

La variable `nextInQueue` se define en la línea 218:

```tsx
const nextInQueue = pendientes[0];
```

### 2. Backend — `app/api/produccion/start/route.ts`

El endpoint `POST /api/produccion/start` **ya permite** iniciar cualquier pedido con estado `PENDIENTE` o `PAUSADO` (no hay validación de posición en cola). Solo verifica permisos con `canStartProduction(role)` que retorna `true` para `ADMIN` e `IGUALADOR`.

### 3. Permisos — `lib/permissions.ts`

Existe `canStartProduction(role)` que permite a `ADMIN` e `IGUALADOR` iniciar producción. También existe `canReorderQueue(role)` que es exclusiva de `ADMIN`.

---

## Cambios requeridos

### Cambio 1: Frontend — Mostrar botón "Tomar" en todos los pedidos para ADMIN

**Archivo:** `app/dashboard/produccion/page.tsx`

Reemplazar la condición del botón "Tomar Siguiente" (línea 272) para que:

- **Si `role === "ADMIN"`:** Mostrar un botón "Tomar" en **todos** los pedidos pendientes (no solo el primero).
- **Si `role === "IGUALADOR"`:** Mantener el comportamiento actual (solo el primer pedido muestra el botón "Tomar Siguiente").

Lógica sugerida:

```tsx
{(() => {
  const isAdmin = role === "ADMIN";
  const isFirstInQueue = order.id === nextInQueue?.id;
  const canTake = (role === "ADMIN" || role === "IGUALADOR") && (isAdmin || isFirstInQueue);

  if (!canTake) return null;

  return (
    <Button
      size="sm"
      className="mt-2 w-full"
      onClick={() => handleTakeOrder(order)}
    >
      <Play className="h-4 w-4 mr-1" />
      {isFirstInQueue ? "Tomar Siguiente" : "Tomar (fuera de orden)"}
    </Button>
  );
})()}
```

> **Nota:** El texto del botón debe distinguir visualmente cuando un admin toma un pedido fuera de orden. Se sugiere "Tomar (fuera de orden)" para los que no son el primero, y "Tomar Siguiente" para el primero.

### Cambio 2 (opcional pero recomendado): Agregar helper de permiso

**Archivo:** `lib/permissions.ts`

Agregar una función para clarificar la regla de negocio:

```typescript
export function canTakeAnyOrder(role: Role): boolean {
  return role === "ADMIN";
}
```

### Cambio 3 (opcional pero recomendado): Registrar en auditoría cuando Admin toma fuera de orden

**Archivo:** `app/api/produccion/start/route.ts`

Antes de actualizar el pedido, verificar si no es el primero en la cola y, si el usuario es `ADMIN`, registrar en el log de auditoría que se tomó fuera de orden. Ejemplo:

```typescript
// Verificar si es el primero en la cola (solo para logging)
const firstInQueue = await prisma.order.findFirst({
  where: { status: "PENDIENTE" },
  orderBy: { queuePosition: "asc" },
  select: { id: true },
});

const takenOutOfOrder = firstInQueue && firstInQueue.id !== orderId;

// ... después de actualizar el order, en el logAudit:
await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
  from: order.status,
  to: "EN_PROCESO",
  folio: order.folio,
  operadorFisicoId,
  takenOutOfOrder: takenOutOfOrder || false,
});
```

---

## Casos de prueba

1. **Usuario IGUALADOR:** Solo ve el botón "Tomar Siguiente" en el primer pedido de la cola. No puede tomar otros.
2. **Usuario ADMIN:** Ve un botón "Tomar" en **todos** los pedidos pendientes. Puede tomar cualquier pedido.
3. **Al tomar un pedido fuera de orden:** El pedido cambia a `EN_PROCESO`, se asigna el `igualadorId` y `operadorFisicoId`, y se registra en auditoría con `takenOutOfOrder: true`.
4. **La cola se reordena correctamente** después de tomar un pedido del medio (los demás pedidos mantienen su posición relativa).

---

## Resumen

| Rol | ¿Puede tomar cualquier pedido? | Botón visible en |
|-----|-------------------------------|-----------------|
| ADMIN | Sí | Todos los pendientes |
| IGUALADOR | No | Solo el primero |