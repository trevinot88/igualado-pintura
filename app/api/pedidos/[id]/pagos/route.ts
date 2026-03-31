import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "CREDITO"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  const { id } = await params;
  const body = await req.json();
  const data = paymentSchema.parse(body);

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const payment = await prisma.payment.create({
    data: { orderId: id, ...data },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Payment",
    entityId: payment.id,
    changes: data as Record<string, unknown>,
    metadata: { orderId: id, folio: order.folio },
  });

  return NextResponse.json(payment, { status: 201 });
}
