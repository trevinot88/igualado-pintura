import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canCreateOrder } from "@/lib/permissions";
import { generateFolio } from "@/lib/folio";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PEDIDOS } from "@/lib/demo-data";

const DEMO_MODE = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

const createOrderSchema = z.object({
  clientId: z.string().min(1),
  colorGroupId: z.string().min(1),
  igualacionLineId: z.string().optional(),
  colorName: z.string().min(1),
  liters: z.number().positive(),
  source: z.enum(["MOSTRADOR", "VENTAS", "REDES_SOCIALES"]).optional(),
  sellerId: z.string().optional(),
  vendedorId: z.string().optional(),
  notes: z.string().optional(),
});

async function getNextIgualadorIdRoundRobin(): Promise<string | null> {
  const igualadores = await prisma.user.findMany({
    where: { role: "IGUALADOR", active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (igualadores.length === 0) return null;
  if (igualadores.length === 1) return igualadores[0].id;

  const igualadorIds = igualadores.map((i) => i.id);

  const lastAssigned = await prisma.order.findFirst({
    where: { igualadorId: { in: igualadorIds } },
    select: { igualadorId: true },
    orderBy: { createdAt: "desc" },
  });

  if (!lastAssigned?.igualadorId) return igualadores[0].id;

  const currentIndex = igualadores.findIndex((i) => i.id === lastAssigned.igualadorId);
  if (currentIndex < 0) return igualadores[0].id;

  const nextIndex = (currentIndex + 1) % igualadores.length;
  return igualadores[nextIndex].id;
}

export async function GET(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]);

  if (DEMO_MODE) return NextResponse.json(DEMO_PEDIDOS);

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

  // Scope: VENDEDOR_READONLY sees only their orders
  if (user.role === "VENDEDOR_READONLY") {
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
      ayudante: { select: { name: true } },
      operadorFisico: { select: { nombre: true } },
      vendedor: { select: { nombre: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "FACTURACION"]);

  if (!canCreateOrder(user.role)) {
    return NextResponse.json({ error: "Sin permisos para crear pedidos" }, { status: 403 });
  }

  const body = await req.json();
  const data = createOrderSchema.parse(body);

  // sellerId = cuenta de sistema que captura (siempre el usuario actual).
  // vendedorId = vendedor físico que hizo la venta (requerido en canal Ventas).
  const effectiveSellerId = user.id;
  let effectiveVendedorId: string | null = null;
  if (data.source === "VENTAS") {
    if (!data.vendedorId) {
      return NextResponse.json({ error: "Debes seleccionar un vendedor para canal Ventas" }, { status: 400 });
    }

    const vendedorFisico = await prisma.vendedor.findFirst({
      where: { id: data.vendedorId, activo: true },
      select: { id: true },
    });
    if (!vendedorFisico) {
      return NextResponse.json({ error: "El vendedor seleccionado no es válido" }, { status: 400 });
    }
    effectiveVendedorId = vendedorFisico.id;
  }

  // Siempre asignar igualador vía round-robin (Pedro o Enrique)
  const assignedIgualadorId = await getNextIgualadorIdRoundRobin();
  if (!assignedIgualadorId) {
    return NextResponse.json(
      { error: "No hay igualadores activos para asignar el pedido" },
      { status: 400 }
    );
  }

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
      sellerId: effectiveSellerId,
      vendedorId: effectiveVendedorId,
      igualadorId: assignedIgualadorId,
      colorGroupId: data.colorGroupId,
      igualacionLineId: data.igualacionLineId || null,
      colorName: data.colorName,
      liters: data.liters,
      source: data.source || "MOSTRADOR",
      notes: data.notes || null,
      queuePosition: (maxQueue._max.queuePosition || 0) + 1,
      locationId: user.locationId || null,
    },
    include: {
      client: { select: { name: true } },
      colorGroup: { select: { name: true } },
      igualacionLine: { select: { name: true } },
    },
  });

  await logAudit(user.id, "CREATE", "Order", order.id, {
    folio: order.folio,
    clientId: data.clientId,
    source: data.source || "MOSTRADOR",
    sellerId: effectiveSellerId,
    igualadorId: assignedIgualadorId,
  });

  return NextResponse.json(order, { status: 201 });
}
