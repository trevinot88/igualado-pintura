"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ClipboardList,
  Droplets,
  Clock,
  Factory,
  Handshake,
} from "lucide-react";
import { ORDER_SOURCE_LABELS } from "@/lib/utils";
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

interface DashboardData {
  kpis: {
    ordersToday: number;
    ordersTotal: number;
    litersToday: number;
    queueCount: number;
    avgProductionTime: number;
    collaborationOrders: number;
    collaborationRate: number;
  };
  charts: {
    volumeByGroup: { group: string; liters: number; count: number }[];
    ordersBySource: { source: string; count: number }[];
    productionDaily: { date: string; count: number; avg_time: number }[];
    igualadorPerformance: { name: string; count: number; avgTime: number }[];
    crossAssistance: { principal: string; helper: string; count: number }[];
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/reportes?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [from, to]);

  if (!data) return <div className="p-8 text-center">Cargando dashboard...</div>;

  const { kpis, charts } = data;

  const kpiCards = [
    { label: "Pedidos Hoy", value: kpis.ordersToday, icon: ClipboardList, color: "text-blue-600" },
    { label: "Pedidos Totales", value: kpis.ordersTotal, icon: ClipboardList, color: "text-indigo-600" },
    { label: "Litros Hoy", value: `${kpis.litersToday}L`, icon: Droplets, color: "text-cyan-600" },
    { label: "En Cola", value: kpis.queueCount, icon: Factory, color: "text-orange-600" },
    { label: "Tiempo Prom.", value: `${kpis.avgProductionTime}min`, icon: Clock, color: "text-purple-600" },
    { label: "Con Colaboración", value: `${kpis.collaborationOrders} (${kpis.collaborationRate}%)`, icon: Handshake, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-slate-500">Desde:</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <label className="text-sm text-slate-500">Hasta:</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

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

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardTitle className="px-6 pt-6">Volumen por Grupo de Color</CardTitle>
          <CardContent className="h-[320px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.volumeByGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Pedidos" radius={[4, 4, 0, 0]} />
                <Bar dataKey="liters" fill="#10b981" name="Litros" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardTitle className="px-6 pt-6">Pedidos por Canal</CardTitle>
          <CardContent className="h-[320px] p-4">
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

        <Card>
          <CardTitle className="px-6 pt-6">Rendimiento de Igualadores</CardTitle>
          <CardContent className="h-[320px] p-4">
            {charts.igualadorPerformance.length > 0 ? (
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
            ) : (
              <p className="text-center text-slate-500 pt-20">Sin datos de producción</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle className="px-6 pt-6">Producción Diaria (7 días)</CardTitle>
          <CardContent className="h-[320px] p-4">
            {(charts.productionDaily as unknown[]).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.productionDaily}>
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

      <Card className="p-6">
        <CardTitle className="mb-4">Asistencia Cruzada de Igualadores</CardTitle>
        {charts.crossAssistance.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Igualador Principal</th>
                <th className="py-2">Ayudante</th>
                <th className="py-2">Pedidos con apoyo</th>
              </tr>
            </thead>
            <tbody>
              {charts.crossAssistance
                .sort((a, b) => b.count - a.count)
                .map((row) => (
                  <tr key={`${row.principal}-${row.helper}`} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{row.principal}</td>
                    <td className="py-2">{row.helper}</td>
                    <td className="py-2 font-semibold">{row.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500">Sin registros de asistencia cruzada en el rango seleccionado.</p>
        )}
      </Card>
    </div>
  );
}
