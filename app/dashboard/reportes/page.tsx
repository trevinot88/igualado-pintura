"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface ReportData {
  kpis: Record<string, number>;
  charts: {
    salesByGroup: { group: string; revenue: number; liters: number; count: number }[];
    ordersBySource: { source: string; count: number }[];
    productionDaily: { date: string; count: number; avg_time: number }[];
    igualadorPerformance: { name: string; count: number; avgTime: number }[];
  };
}

export default function ReportesPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function fetchData() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/reportes?${params}`)
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    fetchData();
  }, [from, to]);

  if (!data) return <div className="p-8 text-center">Cargando reportes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-slate-500">Desde:</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <label className="text-sm text-slate-500">Hasta:</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Pedidos Total</p>
          <p className="text-2xl font-bold">{data.kpis.ordersTotal}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Litros Hoy</p>
          <p className="text-2xl font-bold">{data.kpis.litersToday}L</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Ingresos Hoy</p>
          <p className="text-2xl font-bold">{formatCurrency(data.kpis.revenueToday)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Tiempo Promedio</p>
          <p className="text-2xl font-bold">{data.kpis.avgProductionTime}min</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Sales by Group */}
        <Card>
          <CardTitle className="px-6 pt-6">Ventas por Grupo de Color</CardTitle>
          <CardContent className="h-[350px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.salesByGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" fill="#3b82f6" name="Ingresos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by Source */}
        <Card>
          <CardTitle className="px-6 pt-6">Pedidos por Canal</CardTitle>
          <CardContent className="h-[350px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.ordersBySource.map((s) => ({
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
                  {data.charts.ordersBySource.map((_, i) => (
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
          <CardTitle className="px-6 pt-6">Rendimiento de Igualadores</CardTitle>
          <CardContent className="h-[350px] p-4">
            {data.charts.igualadorPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.igualadorPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" name="Pedidos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgTime" fill="#f59e0b" name="Tiempo Prom (min)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-500 pt-20">Sin datos de producción</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Production */}
        <Card>
          <CardTitle className="px-6 pt-6">Producción Diaria (última semana)</CardTitle>
          <CardContent className="h-[350px] p-4">
            {(data.charts.productionDaily as unknown[]).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.productionDaily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" name="Completados" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-500 pt-20">Sin datos de producción esta semana</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      {data.charts.salesByGroup.length > 0 && (
        <Card className="p-6">
          <CardTitle className="mb-4">Detalle por Grupo de Color</CardTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Grupo</th>
                <th className="py-2">Pedidos</th>
                <th className="py-2">Litros</th>
                <th className="py-2">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.charts.salesByGroup.map((row) => (
                <tr key={row.group} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{row.group}</td>
                  <td className="py-2">{row.count}</td>
                  <td className="py-2">{row.liters}L</td>
                  <td className="py-2 font-medium">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
