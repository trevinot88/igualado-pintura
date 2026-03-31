import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { sendOrderReadyEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { z } from "zod";

const notifSchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const body = await req.json();
  const { orderId } = notifSchema.parse(body);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { name: true, email: true } },
      location: { select: { name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (order.status !== "LISTO") {
    return NextResponse.json({ error: "Solo se puede notificar pedidos LISTO" }, { status: 400 });
  }
  if (!order.client.email) {
    return NextResponse.json({ error: "El cliente no tiene email" }, { status: 400 });
  }

  await sendOrderReadyEmail({
    folio: order.folio,
    clientName: order.client.name,
    clientEmail: order.client.email,
    colorName: order.colorName,
    liters: order.liters,
    locationName: order.location?.name,
  });

  await logAudit({
    userId: user.id,
    action: "EMAIL_SENT",
    entity: "Order",
    entityId: orderId,
    metadata: { email: order.client.email },
  });

  return NextResponse.json({ ok: true });
}
