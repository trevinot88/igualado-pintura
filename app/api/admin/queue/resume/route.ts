import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canPauseOrder } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const resumeSchema = z.object({
  orderId: z.string(),
});

/**
 * POST /api/admin/queue/resume
 * Reanuda un pedido pausado (solo ADMIN)
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canPauseOrder(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para reanudar pedidos" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderId } = resumeSchema.parse(body);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado" },
      { status: 404 }
    );
  }

  if (order.status !== "PAUSADO") {
    return NextResponse.json(
      { error: `El pedido no está pausado (estado actual: ${order.status})` },
      { status: 400 }
    );
  }

  // Calcular cuánto tiempo estuvo pausado para ajustar startedAt
  // y que el timer de producción no cuente el tiempo de pausa
  const updateData: Record<string, unknown> = {
    status: "PENDIENTE",
    pausedAt: null,
  };

  if (order.pausedAt && order.startedAt) {
    const pausedMs = Date.now() - order.pausedAt.getTime();
    // Ajustar startedAt sumando el tiempo pausado, así el timer
    // mostrará solo el tiempo real de producción
    updateData.startedAt = new Date(order.startedAt.getTime() + pausedMs);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });

  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: "PAUSADO",
    to: "PENDIENTE",
    folio: order.folio,
    action: "resumed",
  });

  return NextResponse.json({
    order: updatedOrder,
    message: "Pedido reanudado exitosamente",
  });
}