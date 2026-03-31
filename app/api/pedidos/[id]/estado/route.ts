import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canTransition } from "@/lib/permissions";
import { sendOrderReadyEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum([
    "PENDIENTE",
    "EN_PROCESO",
    "LISTO",
    "FACTURADO",
    "PAGADO",
    "ENTREGADO",
    "CANCELADO",
  ]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const { id } = await params;
  const body = await req.json();
  const { status: newStatus } = statusSchema.parse(body);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true } },
      location: { select: { name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Validate transition
  if (!canTransition(order.status, newStatus, user.role)) {
    return NextResponse.json(
      { error: `Transición ${order.status} → ${newStatus} no permitida para tu rol` },
      { status: 403 }
    );
  }

  // FIFO enforcement for igualador: PENDIENTE → EN_PROCESO
  if (newStatus === "EN_PROCESO" && user.role === "IGUALADOR") {
    const nextInQueue = await prisma.order.findFirst({
      where: { status: "PENDIENTE" },
      orderBy: { queuePosition: "asc" },
    });

    if (!nextInQueue || nextInQueue.id !== id) {
      return NextResponse.json(
        { error: "Debes tomar el siguiente pedido en la cola FIFO" },
        { status: 400 }
      );
    }
  }

  // Build update data with timestamps
  const updateData: Record<string, unknown> = { status: newStatus };

  if (newStatus === "EN_PROCESO") {
    updateData.startedAt = new Date();
    updateData.igualadorId = user.id;
  } else if (newStatus === "LISTO") {
    updateData.completedAt = new Date();
    if (order.startedAt) {
      updateData.productionTimeMinutes = Math.round(
        (Date.now() - order.startedAt.getTime()) / 60000
      );
    }
  } else if (newStatus === "FACTURADO") {
    updateData.invoicedAt = new Date();
  } else if (newStatus === "PAGADO") {
    updateData.paidAt = new Date();
  } else if (newStatus === "ENTREGADO") {
    updateData.deliveredAt = new Date();
  } else if (newStatus === "CANCELADO") {
    updateData.cancelledAt = new Date();
  }

  const updated = await prisma.order.update({
    where: { id },
    data: updateData,
  });

  await logAudit({
    userId: user.id,
    action: "STATUS_CHANGED",
    entity: "Order",
    entityId: id,
    changes: { status: { from: order.status, to: newStatus } },
  });

  // Send email notification when order is ready (async, non-blocking)
  if (newStatus === "LISTO" && order.client.email) {
    sendOrderReadyEmail({
      folio: order.folio,
      clientName: order.client.name,
      clientEmail: order.client.email,
      colorName: order.colorName,
      liters: order.liters,
      locationName: order.location?.name,
    }).catch((err) => console.error("Email error:", err));
  }

  return NextResponse.json(updated);
}
