import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { DEMO_REPORTES } from "@/lib/demo-data";

const DEMO_MODE =
  process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

export async function GET(req: Request) {
  const session = await auth();
  try {
    requireRole(session?.user, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (DEMO_MODE) return NextResponse.json(DEMO_REPORTES);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rangeWhere = from ? { createdAt: dateFilter } : {};

  const [
    queueCount,
    avgProductionTime,
    todayCompleted,
    todayWithHelp,
    ordersBySource,
    igualadorSolo,
    igualadorConAyuda,
    sellerVolume,
    crossAssistance,
  ] = await Promise.all([
    // KPI 1 – Pedidos en cola (siempre en tiempo real)
    prisma.order.count({
      where: { status: { in: ["PENDIENTE", "EN_PROCESO"] } },
    }),

    // KPI 2 – Tiempo promedio de igualación (rango seleccionado)
    prisma.order.aggregate({
      _avg: { productionTimeMinutes: true },
      where: {
        productionTimeMinutes: { not: null },
        status: { not: "CANCELADO" },
        ...rangeWhere,
      },
    }),

    // KPI 3a – Pedidos completados HOY (siempre hoy, ignora el filtro de rango)
    prisma.order.count({
      where: {
        completedAt: { gte: today },
        status: { not: "CANCELADO" },
      },
    }),

    // KPI 3b – De los completados hoy, cuántos tuvieron ayudante
    prisma.order.count({
      where: {
        completedAt: { gte: today },
        ayudanteId: { not: null },
        status: { not: "CANCELADO" },
      },
    }),

    // Chart: Pedidos por Canal (donut)
    prisma.order.groupBy({
      by: ["source"],
      _count: true,
      where: { status: { not: "CANCELADO" }, ...rangeWhere },
    }),

    // Chart stacked – igualador SOLO (sin ayudante)
    prisma.order.groupBy({
      by: ["igualadorId"],
      _count: true,
      where: {
        igualadorId: { not: null },
        ayudanteId: null,
        completedAt: { not: null },
        status: { not: "CANCELADO" },
        ...rangeWhere,
      },
    }),

    // Chart stacked – igualador CON ayuda
    prisma.order.groupBy({
      by: ["igualadorId"],
      _count: true,
      where: {
        igualadorId: { not: null },
        ayudanteId: { not: null },
        completedAt: { not: null },
        status: { not: "CANCELADO" },
        ...rangeWhere,
      },
    }),

    // Chart: Volumen por Vendedor
    prisma.order.groupBy({
      by: ["sellerId"],
      _count: true,
      where: { status: { not: "CANCELADO" }, ...rangeWhere },
    }),

    // Tabla detalle: asistencia cruzada
    prisma.order.groupBy({
      by: ["igualadorId", "ayudanteId"],
      _count: true,
      where: {
        igualadorId: { not: null },
        ayudanteId: { not: null },
        completedAt: { not: null },
        status: { not: "CANCELADO" },
        ...rangeWhere,
      },
    }),
  ]);

  // Recopilar todos los user IDs que necesitamos enriquecer
  const igualadorIds = Array.from(
    new Set([
      ...igualadorSolo.map((i) => i.igualadorId!),
      ...igualadorConAyuda.map((i) => i.igualadorId!),
      ...crossAssistance.map((i) => i.igualadorId!),
      ...crossAssistance.filter((i) => i.ayudanteId).map((i) => i.ayudanteId!),
    ])
  );
  const sellerIds = sellerVolume
    .filter((s) => s.sellerId)
    .map((s) => s.sellerId!);
  const allUserIds = Array.from(new Set([...igualadorIds, ...sellerIds]));

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Construir datos apilados por igualador
  const soloMap: Record<string, number> = {};
  igualadorSolo.forEach((i) => {
    if (i.igualadorId) soloMap[i.igualadorId] = i._count;
  });
  const ayudaMap: Record<string, number> = {};
  igualadorConAyuda.forEach((i) => {
    if (i.igualadorId) ayudaMap[i.igualadorId] = i._count;
  });
  const allIgIds = Array.from(
    new Set([
      ...igualadorSolo.map((i) => i.igualadorId!),
      ...igualadorConAyuda.map((i) => i.igualadorId!),
    ])
  ).filter(Boolean);
  const igualadorStacked = allIgIds.map((id) => ({
    name: userMap[id] || "Desconocido",
    solo: soloMap[id] || 0,
    conAyuda: ayudaMap[id] || 0,
  }));

  const collaborationRateToday =
    todayCompleted > 0
      ? Math.round((todayWithHelp / todayCompleted) * 100)
      : 0;

  return NextResponse.json({
    kpis: {
      queueCount,
      avgProductionTime: Math.round(
        avgProductionTime._avg.productionTimeMinutes || 0
      ),
      collaborationRateToday,
      todayCompleted,
      todayWithHelp,
    },
    charts: {
      ordersBySource: ordersBySource.map((s) => ({
        source: s.source,
        count: s._count,
      })),
      igualadorStacked,
      sellerVolume: sellerVolume
        .filter((s) => s.sellerId)
        .map((s) => ({
          name: userMap[s.sellerId!] || "Desconocido",
          count: s._count,
        }))
        .sort((a, b) => b.count - a.count),
      crossAssistance: crossAssistance
        .map((i) => ({
          principal: userMap[i.igualadorId!] || "Desconocido",
          helper: userMap[i.ayudanteId!] || "Desconocido",
          count: i._count,
        }))
        .sort((a, b) => b.count - a.count),
    },
  });
}
