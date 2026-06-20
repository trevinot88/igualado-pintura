import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { DEMO_REPORTES } from "@/lib/demo-data";

const DEMO_MODE =
  process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

// Siempre datos frescos: el dashboard debe reflejar pedidos en tiempo real.
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // `from`/`to` llegan como instantes ISO precisos (hora local del cliente → UTC),
  // así que se usan tal cual; sin parches de zona horaria.
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
    operadorSolo,
    operadorConAyuda,
    sellerVolume,
    crossAssistance,
    litersByGroupData,
    litersByColorData,
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

    // ⭐ Chart stacked – operador FÍSICO SOLO (sin ayudante)
    // Group by operadorFisicoId for real per-person metrics
    prisma.order.groupBy({
      by: ["operadorFisicoId"],
      _count: true,
      where: {
        operadorFisicoId: { not: null },
        ayudanteId: null,
        completedAt: { not: null },
        status: { not: "CANCELADO" },
        ...rangeWhere,
      },
    }),

    // ⭐ Chart stacked – operador FÍSICO CON ayuda
    prisma.order.groupBy({
      by: ["operadorFisicoId"],
      _count: true,
      where: {
        operadorFisicoId: { not: null },
        ayudanteId: { not: null },
        completedAt: { not: null },
        status: { not: "CANCELADO" },
        ...rangeWhere,
      },
    }),

    // Chart: Volumen por Vendedor (físico) — pedidos y litros
    prisma.order.groupBy({
      by: ["vendedorId"],
      _count: true,
      _sum: { liters: true },
      where: { vendedorId: { not: null }, status: { not: "CANCELADO" }, ...rangeWhere },
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

    // Litros por Grupo de Color
    prisma.colorGroup.findMany({
      select: {
        name: true,
        orders: {
          where: { status: { not: "CANCELADO" }, ...rangeWhere },
          select: { liters: true },
        },
      },
    }),

    // Litros por Color Exacto (colorName)
    prisma.order.groupBy({
      by: ["colorName", "colorGroupId"],
      _sum: { liters: true },
      where: { status: { not: "CANCELADO" }, ...rangeWhere },
      orderBy: { _sum: { liters: "desc" } },
      take: 20,
    }),
  ]);

  // ── Enrich operador FÍSICO names ──
  const operadorFisicoIds = Array.from(
    new Set([
      ...operadorSolo.map((i) => i.operadorFisicoId!).filter(Boolean),
      ...operadorConAyuda.map((i) => i.operadorFisicoId!).filter(Boolean),
    ])
  );

  // Fetch names from the Igualador table
  const igualadores = await prisma.igualador.findMany({
    where: { id: { in: operadorFisicoIds } },
    select: { id: true, nombre: true },
  });
  const igualadorNombreMap = Object.fromEntries(
    igualadores.map((ig) => [ig.id, ig.nombre])
  );

  // ── Enrich Vendedor Físico names for seller volume ──
  const sellerVendedorIds = sellerVolume
    .map((s) => s.vendedorId)
    .filter((id): id is string => Boolean(id));

  const vendedoresFisicos = sellerVendedorIds.length > 0
    ? await prisma.vendedor.findMany({
        where: { id: { in: sellerVendedorIds } },
        select: { id: true, nombre: true },
      })
    : [];
  const vendedorFisicoMap = Object.fromEntries(
    vendedoresFisicos.map((v) => [v.id, v.nombre])
  );

  // ── Enrich system user names (for cross-assistance) ──
  const allUserIds = Array.from(
    new Set([
      ...crossAssistance.map((i) => i.igualadorId!).filter(Boolean),
      ...crossAssistance.filter((i) => i.ayudanteId).map((i) => i.ayudanteId!).filter(Boolean),
    ])
  );

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // ── Build stacked bar data by operadorFISICO ──
  const soloMap: Record<string, number> = {};
  operadorSolo.forEach((i) => {
    if (i.operadorFisicoId) soloMap[i.operadorFisicoId] = i._count;
  });
  const ayudaMap: Record<string, number> = {};
  operadorConAyuda.forEach((i) => {
    if (i.operadorFisicoId) ayudaMap[i.operadorFisicoId] = i._count;
  });

  const allOperadorIds = Array.from(
    new Set([...Object.keys(soloMap), ...Object.keys(ayudaMap)])
  );

  const igualadorStacked = allOperadorIds.map((id) => ({
    name: igualadorNombreMap[id] || "Desconocido",
    solo: soloMap[id] || 0,
    conAyuda: ayudaMap[id] || 0,
  }));

  const collaborationRateToday =
    todayCompleted > 0
      ? Math.round((todayWithHelp / todayCompleted) * 100)
      : 0;

  // Litros por grupo de color - calcular suma de liters por grupo
  const litersByGroup = litersByGroupData
    .map((g) => ({
      groupName: g.name,
      totalLiters: g.orders.reduce((sum, o) => sum + o.liters, 0),
    }))
    .filter((g) => g.totalLiters > 0);

  // Get color group names
  let colorGroupNames: Record<string, string> = {};
  try {
    const colorGroups = await prisma.colorGroup.findMany({
      select: { id: true, name: true },
    });
    colorGroupNames = Object.fromEntries(colorGroups.map((g) => [g.id, g.name]));
  } catch {
    colorGroupNames = {};
  }

  const litersByColor = litersByColorData.map((c) => ({
    colorName: c.colorName,
    groupName: colorGroupNames[c.colorGroupId] || "Desconocido",
    totalLiters: c._sum.liters || 0,
  }));

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
        .filter((s) => s.vendedorId)
        .map((s) => ({
          name: vendedorFisicoMap[s.vendedorId!] || "Desconocido",
          count: s._count,
          liters: s._sum.liters || 0,
        }))
        .sort((a, b) => b.count - a.count),
      crossAssistance: crossAssistance
        .map((i) => ({
          principal: userMap[i.igualadorId!] || "Desconocido",
          helper: userMap[i.ayudanteId!] || "Desconocido",
          count: i._count,
        }))
        .sort((a, b) => b.count - a.count),
      litersByGroup,
      litersByColor,
    },
  });
}
