import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canStartProduction } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const startSchema = z.object({
  orderId: z.string(),
});

/**
 * POST /api/produccion/start
 * Inicia la producción de un pedido.
 * VALIDACIÓN FIFO: Solo permite iniciar el siguiente pedido en cola
 * (excepto para ADMIN que puede override)
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "IGUALADOR"]);

  if (!canStartProduction(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para iniciar producción" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderId } = startSchema.parse(body);

  // Get the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado" },
      { status: 404 }
    );
  }

  if (order.status !== "PENDIENTE" && order.status !== "PAUSADO") {
    return NextResponse.json(
      { error: `El pedido está en estado: ${order.status}` },
      { status: 400 }
    );
  }

  // FIFO VALIDATION: Check if this is the next order in queue
  // Skip for ADMIN (they can override)
  if (user.role !== "ADMIN") {
    const nextInQueue = await prisma.order.findFirst({
      where: {
        status: { in: ["PENDIENTE"] },
      },
      orderBy: { queuePosition: "asc" },
    });

    if (nextInQueue && nextInQueue.id !== orderId) {
      return NextResponse.json(
        {
          error: "Debe completar el pedido anterior en la cola",
          nextOrder: {
            folio: nextInQueue.folio,
            id: nextInQueue.id,
            queuePosition: nextInQueue.queuePosition,
          },
        },
        { status: 403 }
      );
    }
  }

  // Start production
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "EN_PROCESO",
      igualadorId: user.id,
      startedAt: new Date(),
    },
    include: {
      client: { select: { name: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
    },
  });

  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: order.status,
    to: "EN_PROCESO",
    folio: order.folio,
  });

  return NextResponse.json(updatedOrder);
}
