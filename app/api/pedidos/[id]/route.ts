import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, logOrderEdit } from "@/lib/audit";
import { requireRole, canEditOrder } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const updateOrderSchema = z.object({
  clientId: z.string().min(1).optional(),
  colorGroupId: z.string().min(1).optional(),
  igualacionLineId: z.string().nullable().optional(),
  colorName: z.string().min(1).optional(),
  liters: z.number().positive().optional(),
  source: z.enum(["MOSTRADOR", "VENTAS", "WHATSAPP", "REDES_SOCIALES"]).optional(),
  sellerId: z.string().min(1).optional(),
  igualadorId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

// Estados terminales en los que ya no se puede editar un pedido
// CANCELADO es el único estado bloqueado. ENTREGADO se permite editar
// para poder corregir errores de captura (ej: litros mal capturados).
const NON_EDITABLE_STATUSES = ["CANCELADO"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]);

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      seller: { select: { id: true, name: true, email: true } },
      vendedor: { select: { id: true, nombre: true } },
      igualador: { select: { id: true, name: true, email: true } },
      colorGroup: { select: { id: true, name: true } },
      igualacionLine: { select: { id: true, code: true, name: true } },
      labels: { orderBy: { printedAt: "desc" } },
      location: { select: { name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Get audit trail for this order
  const auditTrail = await prisma.auditLog.findMany({
    where: { entity: "Order", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ...order, auditTrail });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canEditOrder(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();

  // Check what fields are being edited
  const keys = Object.keys(body);
  const isNotesOnly = keys.length === 1 && keys[0] === "notes";
  const isLitersOnly = keys.length === 1 && keys[0] === "liters";

  // Notes-only edits are allowed in any status except cancelled
  if (isNotesOnly) {
    // Allow notes edit in any non-terminal status, or even ENTREGADO
    // Only block if order is CANCELADO
    if (order.status === "CANCELADO") {
      return NextResponse.json(
        { error: "No se puede editar un pedido CANCELADO" },
        { status: 400 }
      );
    }
  } else if (isLitersOnly && user.role === "ADMIN") {
    // Allow ADMIN to correct liters in any status except CANCELADO
    // (useful for fixing data entry errors in delivered orders)
    if (order.status === "CANCELADO") {
      return NextResponse.json(
        { error: "No se puede editar un pedido CANCELADO" },
        { status: 400 }
      );
    }
  } else {
    // Only block on truly terminal status (CANCELADO)
    if (NON_EDITABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: `No se puede editar un pedido en estado: ${order.status}` },
        { status: 400 }
      );
    }
  }

  const data = updateOrderSchema.parse(body);

  // Validar clientId si se intenta cambiar
  if (data.clientId && data.clientId !== order.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, active: true },
    });
    if (!client || !client.active) {
      return NextResponse.json(
        { error: "El cliente seleccionado no es válido o está inactivo" },
        { status: 400 }
      );
    }
  }

  // Validar colorGroupId si se intenta cambiar
  if (data.colorGroupId && data.colorGroupId !== order.colorGroupId) {
    const group = await prisma.colorGroup.findUnique({
      where: { id: data.colorGroupId },
      select: { id: true, active: true },
    });
    if (!group || !group.active) {
      return NextResponse.json(
        { error: "El grupo de color seleccionado no es válido o está inactivo" },
        { status: 400 }
      );
    }
  }

  // Validar igualacionLineId si se intenta cambiar (puede ser null para desasignar)
  if (data.igualacionLineId !== undefined && data.igualacionLineId !== null) {
    const line = await prisma.igualacionLine.findUnique({
      where: { id: data.igualacionLineId },
      select: { id: true, active: true },
    });
    if (!line || !line.active) {
      return NextResponse.json(
        { error: "La línea de igualación seleccionada no es válida o está inactiva" },
        { status: 400 }
      );
    }
  }

  // Validar sellerId si se intenta cambiar
  if (data.sellerId && data.sellerId !== order.sellerId) {
    const seller = await prisma.user.findFirst({
      where: {
        id: data.sellerId,
        active: true,
        role: { in: ["ADMIN", "VENDEDOR_READONLY"] },
      },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json(
        { error: "El vendedor seleccionado no es válido" },
        { status: 400 }
      );
    }
  }

  // Validar igualadorId si se intenta cambiar (puede ser null)
  if (data.igualadorId !== undefined && data.igualadorId !== null) {
    const igualador = await prisma.user.findFirst({
      where: {
        id: data.igualadorId,
        active: true,
        role: "IGUALADOR",
      },
      select: { id: true },
    });
    if (!igualador) {
      return NextResponse.json(
        { error: "El igualador seleccionado no es válido" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.order.update({
    where: { id },
    data,
    include: {
      client: { select: { name: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
    },
  });

  await logOrderEdit(
    user.id,
    id,
    order as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // PENDIENTE: eliminar realmente de la DB (liberar queuePosition)
  // EN_PROCESO, LISTO, etc: solo cancelar
  if (order.status === "PENDIENTE") {
    // Delete related records first
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { entity: "Order", entityId: id } }),
      prisma.label.deleteMany({ where: { orderId: id } }),
      prisma.order.delete({ where: { id } }),
    ]);
  } else {
    await prisma.order.update({
      where: { id },
      data: { status: "CANCELADO", cancelledAt: new Date() },
    });
  }

  await logAudit(user.id, "DELETE", "Order", id, {
    folio: order.folio,
    status: order.status,
    action: order.status === "PENDIENTE" ? "deleted" : "cancelled",
  });

  return NextResponse.json({ ok: true });
}
