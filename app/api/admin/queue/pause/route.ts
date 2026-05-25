import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canPauseOrder } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const pauseSchema = z.object({
  orderId: z.string(),
  reason: z.string().optional(),
});

/**
 * POST /api/admin/queue/pause
 * Pausa un pedido en la cola (solo ADMIN)
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canPauseOrder(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para pausar pedidos" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderId, reason } = pauseSchema.parse(body);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado" },
      { status: 404 }
    );
  }

  if (order.status !== "PENDIENTE" && order.status !== "EN_PROCESO") {
    return NextResponse.json(
      { error: `No se puede pausar un pedido en estado: ${order.status}` },
      { status: 400 }
    );
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PAUSADO",
    },
  });

  await logAudit(user.id, "ORDER_PAUSED", "Order", orderId, {
    from: order.status,
    to: "PAUSADO",
    folio: order.folio,
    reason: reason || "No especificada",
  });

  return NextResponse.json({
    order: updatedOrder,
    message: "Pedido pausado exitosamente",
  });
}
