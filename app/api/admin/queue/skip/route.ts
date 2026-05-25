import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canReorderQueue } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const skipSchema = z.object({
  orderId: z.string(),
});

/**
 * POST /api/admin/queue/skip
 * Mueve un pedido al final de la cola (solo ADMIN)
 * Útil para saltar un pedido temporalmente sin pausarlo
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canReorderQueue(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para modificar la cola" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderId } = skipSchema.parse(body);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado" },
      { status: 404 }
    );
  }

  if (order.status !== "PENDIENTE") {
    return NextResponse.json(
      { error: `Solo se pueden saltar pedidos PENDIENTES (actual: ${order.status})` },
      { status: 400 }
    );
  }

  // Get max queue position
  const maxQueue = await prisma.order.aggregate({
    _max: { queuePosition: true },
    where: { status: { in: ["PENDIENTE", "EN_PROCESO"] } },
  });

  const newPosition = (maxQueue._max.queuePosition || 0) + 1;
  const oldPosition = order.queuePosition;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      queuePosition: newPosition,
    },
  });

  await logAudit(user.id, "ORDER_QUEUE_MOVED", "Order", orderId, {
    action: "skip",
    folio: order.folio,
    from: oldPosition,
    to: newPosition,
  });

  return NextResponse.json({
    success: true,
    message: `Pedido ${order.folio} movido al final de la cola`,
    oldPosition,
    newPosition,
  });
}
