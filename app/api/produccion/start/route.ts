import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canStartProduction } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const startSchema = z.object({
  orderId: z.string(),
  operadorFisicoId: z.string().min(1, "Debe seleccionar un operador físico"),
});

/**
 * POST /api/produccion/start
 * Inicia la producción de un pedido.
 *
 * VALIDACIÓN FIFO: Solo permite iniciar el siguiente pedido en cola
 * (excepto para ADMIN que puede override)
 *
 * VALIDACIÓN ESTRICTA: operadorFisicoId es requerido — el frontend
 * debe forzar la selección del operador físico antes de continuar.
 * Si no se envía, el backend rebota con error 400.
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
  const parsed = startSchema.safeParse(body);

  if (!parsed.success) {
    const missingOperator = parsed.error.issues.some(
      (i) => i.path.includes("operadorFisicoId")
    );
    if (missingOperator) {
      return NextResponse.json(
        {
          error:
            "Debe seleccionar quién está procesando este pedido (operadorFisicoId requerido)",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId, operadorFisicoId } = parsed.data;

  // Validar que el operador físico existe y está activo
  const operadorFisico = await prisma.igualador.findUnique({
    where: { id: operadorFisicoId },
  });

  if (!operadorFisico) {
    return NextResponse.json(
      { error: "El operador físico seleccionado no existe" },
      { status: 400 }
    );
  }

  if (!operadorFisico.activo) {
    return NextResponse.json(
      { error: "El operador físico seleccionado está inactivo" },
      { status: 400 }
    );
  }

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

  // Start production — set both session user AND physical operator
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "EN_PROCESO",
      igualadorId: user.id,
      operadorFisicoId: operadorFisicoId,
      startedAt: new Date(),
    },
    include: {
      client: { select: { name: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
      operadorFisico: { select: { id: true, nombre: true } },
    },
  });

  await logAudit(user.id, "STATUS_CHANGED", "Order", orderId, {
    from: order.status,
    to: "EN_PROCESO",
    folio: order.folio,
    operadorFisicoId,
  });

  return NextResponse.json(updatedOrder);
}
