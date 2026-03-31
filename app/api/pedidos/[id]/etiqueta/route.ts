import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { generateLabelHTML } from "@/lib/labels";
import { logAudit } from "@/lib/audit";
import { formatDate } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      seller: { select: { name: true } },
      colorGroup: { select: { name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const html = generateLabelHTML({
    folio: order.folio,
    colorName: order.colorName,
    colorGroup: order.colorGroup.name,
    clientName: order.client.name,
    liters: order.liters,
    vendedor: order.seller.name,
    date: formatDate(order.createdAt),
    notes: order.notes || undefined,
  });

  // Record label print
  await prisma.label.create({
    data: {
      orderId: id,
      content: {
        folio: order.folio,
        colorName: order.colorName,
        clientName: order.client.name,
        liters: order.liters,
      },
    },
  });

  await logAudit({
    userId: user.id,
    action: "LABEL_PRINTED",
    entity: "Order",
    entityId: id,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
