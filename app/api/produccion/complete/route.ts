tambien import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canCompleteOrder } from "@/lib/permissions";
import { generateLabel } from "@/lib/label-printer";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";
import { z } from "zod";

const completeSchema = z.object({
  orderId: z.string(),
  productionTimeMinutes: z.number().int().positive().optional(),
  ayudanteId: z.string().optional(),
});

/**
 * POST /api/produccion/complete
 * Completa un pedido en producción y activa triggers:
 * - Genera etiqueta automáticamente
 * - Envía notificación WhatsApp al cliente
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "IGUALADOR"]);

  if (!canCompleteOrder(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para completar pedidos" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderId, productionTimeMinutes, ayudanteId } = completeSchema.parse(body);

  // Get the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado" },
      { status: 404 }
    );
  }

  if (order.status !== "EN_PROCESO") {
    return NextResponse.json(
      { error: `El pedido debe estar EN_PROCESO (actual: ${order.status})` },
      { status: 400 }
    );
  }

  // Igualador can only complete orders assigned to them (admin can override)
  if (user.role === "IGUALADOR" && order.igualadorId && order.igualadorId !== user.id) {
    return NextResponse.json(
      { error: "Solo el igualador asignado puede completar este pedido" },
      { status: 403 }
    );
  }

  // FIFO VALIDATION: Non-admin users cannot complete an order if an older order is still EN_PROCESO
  if (user.role !== "ADMIN") {
    const olderInProcess = await prisma.order.findFirst({
      where: {
        status: "EN_PROCESO",
        id: { not: orderId },
        queuePosition: { lt: order.queuePosition ?? 999999 },
      },
      orderBy: { queuePosition: "asc" },
    });

    if (olderInProcess) {
      return NextResponse.json(
        {
          error: `No puedes completar este pedido antes que el #${olderInProcess.folio} que entró primero a producción`,
        },
        { status: 400 }
      );
    }
  }

  let validatedAyudanteId: string | null = null;
  if (ayudanteId) {
    if (ayudanteId === order.igualadorId) {
      return NextResponse.json(
        { error: "El ayudante debe ser distinto al igualador principal" },
        { status: 400 }
      );
    }

    const ayudante = await prisma.user.findFirst({
      where: {
        id: ayudanteId,
        active: true,
        role: "IGUALADOR",
      },
      select: { id: true },
    });

    if (!ayudante) {
      return NextResponse.json(
        { error: "El ayudante seleccionado no es válido" },
        { status: 400 }
      );
    }

    validatedAyudanteId = ayudante.id;
  }

  // Complete the order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "LISTO",
      completedAt: new Date(),
      productionTimeMinutes: productionTimeMinutes || null,
      ayudanteId: validatedAyudanteId,
    },
    include: {
      client: { select: { name: true, phone: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
      igualador: { select: { name: true } },
      ayudante: { select: { name: true } },
    },
  });

  // Log status change
  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: "EN_PROCESO",
    to: "LISTO",
    folio: order.folio,
    productionTimeMinutes,
    ayudanteId: validatedAyudanteId,
  });

  // TRIGGER 1: Generate and print label
  try {
    const labelData = await generateLabel(orderId);
    console.log(`[Label] Generated for order ${order.folio}`, labelData);
  } catch (error) {
    console.error(`[Label] Error generating label for ${order.folio}:`, error);
    // Continue even if label fails
  }

  // TRIGGER 2: Send WhatsApp notification
  if (order.client.phone) {
    try {
      await sendWhatsAppNotification(
        order.client.phone,
        order.folio,
        order.client.name,
        orderId,
        order.colorName
      );
      console.log(`[WhatsApp] Notification sent for order ${order.folio}`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending notification for ${order.folio}:`, error);
      // Continue even if WhatsApp fails
    }
  }

  return NextResponse.json({
    order: updatedOrder,
    message: "Pedido completado. Etiqueta generada y notificación enviada.",
  });
}
