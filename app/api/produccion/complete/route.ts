import { auth } from "@/lib/auth";
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
  const { orderId, productionTimeMinutes } = completeSchema.parse(body);

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

  // Complete the order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "LISTO",
      completedAt: new Date(),
      productionTimeMinutes: productionTimeMinutes || null,
    },
    include: {
      client: { select: { name: true, phone: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
      igualador: { select: { name: true } },
    },
  });

  // Log status change
  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: "EN_PROCESO",
    to: "LISTO",
    folio: order.folio,
    productionTimeMinutes,
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
        orderId
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
