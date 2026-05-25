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

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PENDIENTE",
    },
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
