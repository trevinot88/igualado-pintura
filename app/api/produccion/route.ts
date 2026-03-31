import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canReorderQueue } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

// GET: Production queue (FIFO)
export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const queue = await prisma.order.findMany({
    where: { status: { in: ["PENDIENTE", "EN_PROCESO"] } },
    include: {
      client: { select: { name: true } },
      seller: { select: { name: true } },
      igualador: { select: { name: true } },
      colorGroup: { select: { name: true } },
    },
    orderBy: { queuePosition: "asc" },
  });

  // Also get today's completed orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedToday = await prisma.order.findMany({
    where: {
      status: "LISTO",
      completedAt: { gte: today },
    },
    include: {
      client: { select: { name: true } },
      igualador: { select: { name: true } },
      colorGroup: { select: { name: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  return NextResponse.json({ queue, completedToday });
}

// PATCH: Reorder queue (admin only)
const reorderSchema = z.object({
  orderedIds: z.array(z.string()),
});

export async function PATCH(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canReorderQueue(user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { orderedIds } = reorderSchema.parse(body);

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.order.update({
        where: { id },
        data: { queuePosition: index + 1 },
      })
    )
  );

  await logAudit({
    userId: user.id,
    action: "QUEUE_REORDERED",
    entity: "Order",
    changes: { orderedIds },
  });

  return NextResponse.json({ ok: true });
}
