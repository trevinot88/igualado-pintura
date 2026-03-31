import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // KPIs
  const [
    ordersToday,
    ordersTotal,
    litersToday,
    revenueToday,
    queueCount,
    avgProductionTime,
    unpaidOrders,
    salesByGroup,
    ordersBySource,
    productionDaily,
    igualadorPerformance,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today }, status: { not: "CANCELADO" } } }),
    prisma.order.count({ where: { status: { not: "CANCELADO" }, ...(from ? { createdAt: dateFilter } : {}) } }),
    prisma.order.aggregate({
      _sum: { liters: true },
      where: { createdAt: { gte: today }, status: { not: "CANCELADO" } },
    }),
    prisma.order.aggregate({
      _sum: { totalPrice: true },
      where: { createdAt: { gte: today }, status: { not: "CANCELADO" } },
    }),
    prisma.order.count({ where: { status: { in: ["PENDIENTE", "EN_PROCESO"] } } }),
    prisma.order.aggregate({
      _avg: { productionTimeMinutes: true },
      where: { productionTimeMinutes: { not: null } },
    }),
    prisma.order.count({
      where: {
        status: { in: ["LISTO", "FACTURADO"] },
        payments: { none: {} },
      },
    }),
    // Sales by group
    prisma.order.groupBy({
      by: ["colorGroupId"],
      _sum: { totalPrice: true, liters: true },
      _count: true,
      where: { status: { not: "CANCELADO" }, ...(from ? { createdAt: dateFilter } : {}) },
    }),
    // Orders by source
    prisma.order.groupBy({
      by: ["source"],
      _count: true,
      where: { status: { not: "CANCELADO" }, ...(from ? { createdAt: dateFilter } : {}) },
    }),
    // Production by day (last 7 days)
    prisma.$queryRaw`
      SELECT DATE(completed_at) as date, COUNT(*)::int as count, 
             AVG(production_time_minutes)::int as avg_time
      FROM "Order" 
      WHERE completed_at IS NOT NULL 
        AND completed_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(completed_at)
      ORDER BY date
    `,
    // Igualador performance
    prisma.order.groupBy({
      by: ["igualadorId"],
      _count: true,
      _avg: { productionTimeMinutes: true },
      where: { igualadorId: { not: null }, completedAt: { not: null } },
    }),
  ]);

  // Enrich group names
  const groups = await prisma.colorGroup.findMany({
    select: { id: true, name: true },
  });
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));

  // Enrich igualador names
  const igualadorIds = igualadorPerformance
    .filter((i) => i.igualadorId)
    .map((i) => i.igualadorId!);
  const igualadores = await prisma.user.findMany({
    where: { id: { in: igualadorIds } },
    select: { id: true, name: true },
  });
  const igualadorMap = Object.fromEntries(igualadores.map((u) => [u.id, u.name]));

  return NextResponse.json({
    kpis: {
      ordersToday,
      ordersTotal,
      litersToday: litersToday._sum.liters || 0,
      revenueToday: revenueToday._sum.totalPrice || 0,
      queueCount,
      avgProductionTime: Math.round(avgProductionTime._avg.productionTimeMinutes || 0),
      unpaidOrders,
    },
    charts: {
      salesByGroup: salesByGroup.map((g) => ({
        group: groupMap[g.colorGroupId] || g.colorGroupId,
        revenue: g._sum.totalPrice || 0,
        liters: g._sum.liters || 0,
        count: g._count,
      })),
      ordersBySource: ordersBySource.map((s) => ({
        source: s.source,
        count: s._count,
      })),
      productionDaily,
      igualadorPerformance: igualadorPerformance.map((i) => ({
        name: igualadorMap[i.igualadorId!] || "Desconocido",
        count: i._count,
        avgTime: Math.round(i._avg.productionTimeMinutes || 0),
      })),
    },
  });
}
