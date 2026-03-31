import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canEditOrder } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateOrderSchema = z.object({
  colorGroupId: z.string().optional(),
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
  requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      seller: { select: { id: true, name: true, email: true } },
      igualador: { select: { id: true, name: true, email: true } },
      colorGroup: { include: { priceTiers: { orderBy: { minLiters: "asc" } } } },
      payments: { orderBy: { createdAt: "desc" } },
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

export async function PUT(
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
      { error: "Solo se pueden editar pedidos PENDIENTE" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const data = updateOrderSchema.parse(body);

  // Recalculate price if liters or group changed
  let priceData = {};
  if (data.liters || data.colorGroupId) {
    const { calculatePrice } = await import("@/lib/pricing");
    const result = await calculatePrice(
      data.colorGroupId || order.colorGroupId,
      data.liters || order.liters
    );
    priceData = {
      pricePerLiter: result.pricePerLiter,
      totalPrice: result.totalPrice,
    };
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { ...data, ...priceData },
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "Order",
    entityId: id,
    changes: { ...data, ...priceData },
  });

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

  await prisma.order.update({
    where: { id },
    data: { status: "CANCELADO", cancelledAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    action: "STATUS_CHANGED",
    entity: "Order",
    entityId: id,
    changes: { status: { from: order.status, to: "CANCELADO" } },
  });

  return NextResponse.json({ ok: true });
}
