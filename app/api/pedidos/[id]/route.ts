import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, logOrderEdit } from "@/lib/audit";
import { requireRole, canEditOrder } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const updateOrderSchema = z.object({
  colorGroupId: z.string().optional(),
  igualacionLineId: z.string().optional(),
  colorName: z.string().optional(),
  liters: z.number().positive().optional(),
  source: z.enum(["MOSTRADOR", "VENTAS", "WHATSAPP", "REDES_SOCIALES"]).optional(),
  notes: z.string().optional(),
});

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

  if (order.status !== "PENDIENTE") {
    return NextResponse.json(
      { error: "Solo se pueden editar pedidos PENDIENTES" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const data = updateOrderSchema.parse(body);

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
