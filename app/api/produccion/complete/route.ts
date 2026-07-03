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
  ayudanteFisicoId: z.string().optional(),
});

/**
 * POST /api/produccion/complete
 * Completa un pedido en producción y activa triggers:
 * - Genera etiqueta automáticamente
 * - Envía notificación WhatsApp al cliente
 * - Registra si recibió ayuda de un igualador físico (del catálogo)
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "IGUALADOR", "FACTURACION"]);

  if (!canCompleteOrder(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para completar pedidos" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderId, productionTimeMinutes, ayudanteFisicoId } = completeSchema.parse(body);

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

  // FIFO validation per operator: IGUALADOR cannot complete a pedido if they have
  // an older one (started earlier) still in process. ADMIN can override.
  // Each operador físico works independently, so we only check orders assigned
  // to the same operadorFisicoId, not globally.
  if (user.role !== "ADMIN") {
    const olderInProcess = await prisma.order.findFirst({
      where: {
        status: "EN_PROCESO",
        id: { not: orderId },
        startedAt: { lt: order.startedAt ?? undefined },
        operadorFisicoId: order.operadorFisicoId ?? undefined,
      },
      orderBy: { startedAt: "asc" },
      select: { folio: true },
    });

    if (olderInProcess) {
      return NextResponse.json(
        {
          error: `Debes completar primero el pedido #${olderInProcess.folio} que entró antes a producción. Los pedidos se completan en orden para no afectar a los clientes que esperan primero.`,
        },
        { status: 400 }
      );
    }
  }

  // Validate ayudanteFisicoId (from Catálogo de Igualadores Físicos)
  let validatedAyudanteFisicoId: string | null = null;
  if (ayudanteFisicoId) {
    if (ayudanteFisicoId === order.operadorFisicoId) {
      return NextResponse.json(
        { error: "El ayudante debe ser distinto al operador principal" },
        { status: 400 }
      );
    }

    const ayudante = await prisma.igualador.findFirst({
      where: {
        id: ayudanteFisicoId,
        activo: true,
      },
      select: { id: true },
    });

    if (!ayudante) {
      return NextResponse.json(
        { error: "El ayudante seleccionado no es válido o está inactivo" },
        { status: 400 }
      );
    }

    validatedAyudanteFisicoId = ayudante.id;
  }

  // Complete the order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "LISTO",
      completedAt: new Date(),
      productionTimeMinutes: productionTimeMinutes || null,
      ayudanteFisicoId: validatedAyudanteFisicoId,
    },
    include: {
      client: { select: { name: true, phone: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
      operadorFisico: { select: { nombre: true } },
      ayudanteFisico: { select: { nombre: true } },
    },
  });

  // Log status change
  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: "EN_PROCESO",
    to: "LISTO",
    folio: order.folio,
    productionTimeMinutes,
    ayudanteFisicoId: validatedAyudanteFisicoId,
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
  if (order.client.phone && order.source === "MOSTRADOR") {
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
