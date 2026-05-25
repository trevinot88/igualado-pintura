import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canReorderQueue } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

/**
 * POST /api/admin/queue/reorder
 * Reordena manualmente la cola de producción (solo ADMIN)
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canReorderQueue(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para reordenar la cola" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { orderedIds } = reorderSchema.parse(body);

  // Verify all orders exist and are in valid states
  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderedIds },
      status: { in: ["PENDIENTE", "EN_PROCESO"] },
    },
  });

  if (orders.length !== orderedIds.length) {
    return NextResponse.json(
      { error: "Algunos pedidos no existen o no están en la cola" },
      { status: 400 }
    );
  }

  // Reorder in transaction
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.order.update({
        where: { id },
        data: { queuePosition: index + 1 },
      })
    )
  );

  await logAudit(user.id, "ORDER_QUEUE_MOVED", "Order", undefined, {
    action: "reorder",
    orderedIds,
    count: orderedIds.length,
  });

  return NextResponse.json({
    success: true,
    message: `Cola reordenada: ${orderedIds.length} pedidos`,
  });
}
