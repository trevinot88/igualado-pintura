import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canCreateOrder } from "@/lib/permissions";
import { generateFolio } from "@/lib/folio";
import { calculatePrice } from "@/lib/pricing";
import { NextResponse } from "next/server";
import { z } from "zod";

const createOrderSchema = z.object({
  clientId: z.string().min(1),
  colorGroupId: z.string().min(1),
  colorName: z.string().min(1),
  liters: z.number().positive(),
  source: z.enum(["MOSTRADOR", "VENTAS", "WHATSAPP", "REDES_SOCIALES"]).optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const clientId = searchParams.get("clientId");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (source) where.source = source;
  if (clientId) where.clientId = clientId;

  // Scope: VENDEDOR sees only their orders
  if (user.role === "VENDEDOR") {
    where.sellerId = user.id;
  }

  if (search) {
    where.OR = [
      { folio: { contains: search, mode: "insensitive" } },
      { colorName: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      client: { select: { name: true, email: true, phone: true } },
      seller: { select: { name: true } },
      igualador: { select: { name: true } },
      colorGroup: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  if (!canCreateOrder(user.role)) {
    return NextResponse.json({ error: "Sin permisos para crear pedidos" }, { status: 403 });
  }

  const body = await req.json();
  const data = createOrderSchema.parse(body);

  // Calculate price
  const { pricePerLiter, totalPrice } = await calculatePrice(
    data.colorGroupId,
    data.liters
  );

  // Generate folio and queue position atomically
  const folio = await generateFolio();

  const maxQueue = await prisma.order.aggregate({
    _max: { queuePosition: true },
    where: { status: { in: ["PENDIENTE", "EN_PROCESO"] } },
  });

  const order = await prisma.order.create({
    data: {
      folio,
      clientId: data.clientId,
      sellerId: user.id,
      colorGroupId: data.colorGroupId,
      colorName: data.colorName,
      liters: data.liters,
      pricePerLiter,
      totalPrice,
      source: data.source || "MOSTRADOR",
      notes: data.notes || null,
      queuePosition: (maxQueue._max.queuePosition || 0) + 1,
      locationId: user.locationId || null,
    },
    include: {
      client: { select: { name: true } },
      colorGroup: { select: { name: true } },
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Order",
    entityId: order.id,
    changes: { folio, ...data, pricePerLiter, totalPrice },
  });

  return NextResponse.json(order, { status: 201 });
}
