"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  Droplets,
  DollarSign,
  Clock,
  AlertTriangle,
  Factory,
} from "lucide-react";
import { formatCurrency, ORDER_SOURCE_LABELS } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function DashboardPage() {
  const [data, setData] = useState<{
    kpis: Record<string, number>;
    charts: {
      salesByGroup: { group: string; revenue: number; count: number }[];
      ordersBySource: { source: string; count: number }[];
      productionDaily: { date: string; count: number; avg_time: number }[];
      igualadorPerformance: { name: string; count: number; avgTime: number }[];
    };
  } | null>(null);

  useEffect(() => {
    fetch("/api/reportes")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="p-8 text-center">Cargando dashboard...</div>;

  const { kpis, charts } = data;

  const kpiCards = [
    { label: "Pedidos Hoy", value: kpis.ordersToday, icon: ClipboardList, color: "text-blue-600" },
    { label: "Litros Hoy", value: `${kpis.litersToday}L`, icon: Droplets, color: "text-cyan-600" },
    { label: "Ingresos Hoy", value: formatCurrency(kpis.revenueToday), icon: DollarSign, color: "text-green-600" },
    { label: "En Cola", value: kpis.queueCount, icon: Factory, color: "text-orange-600" },
    { label: "Tiempo Prom.", value: `${kpis.avgProductionTime}min`, icon: Clock, color: "text-purple-600" },
    { label: "Sin Pagar", value: kpis.unpaidOrders, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <span className="text-xs text-slate-500">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sales by Group */}
        <Card>
          <CardTitle className="px-6 pt-6">Ventas por Grupo</CardTitle>
          <CardContent className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.salesByGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by Source */}
        <Card>
          <CardTitle className="px-6 pt-6">Pedidos por Canal</CardTitle>
          <CardContent className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.ordersBySource.map((s) => ({
                    ...s,
                    name: ORDER_SOURCE_LABELS[s.source] || s.source,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {charts.ordersBySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Igualador Performance */}
        <Card>
          <CardTitle className="px-6 pt-6">Rendimiento Igualadores</CardTitle>
          <CardContent className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.igualadorPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" name="Pedidos" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgTime" fill="#f59e0b" name="Tiempo Prom (min)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Production */}
        <Card>
          <CardTitle className="px-6 pt-6">Producción Diaria (7 días)</CardTitle>
          <CardContent className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.productionDaily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Completados" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
