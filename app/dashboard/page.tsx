"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Clock, Factory, Handshake } from "lucide-react";
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
  Legend,
} from "recharts";

const SOURCE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

interface DashboardData {
  kpis: {
    queueCount: number;
    avgProductionTime: number;
    collaborationRateToday: number;
    todayCompleted: number;
    todayWithHelp: number;
  };
  charts: {
    ordersBySource: { source: string; count: number }[];
    igualadorStacked: { name: string; solo: number; conAyuda: number }[];
    sellerVolume: { name: string; count: number }[];
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

  if (!data)
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando dashboard...
      </div>
    );

  const { kpis, charts } = data;
  const queueAlert = kpis.queueCount >= 5;

  return (
    <div className="space-y-6">
      {/* ── Header + Filtros ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-slate-500">Desde:</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
          <label className="text-sm text-slate-500">Hasta:</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* ── 1. KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pedidos en Cola */}
        <Card
          className={cn(
            "p-5 border-2",
            queueAlert
              ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
              : "border-slate-200"
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                queueAlert
                  ? "bg-orange-100 dark:bg-orange-900/30"
                  : "bg-slate-100 dark:bg-slate-800"
              )}
            >
              <Factory
                className={cn(
                  "h-6 w-6",
                  queueAlert ? "text-orange-600" : "text-slate-500"
                )}
              />
            </div>
            <span className="text-sm font-medium text-slate-500">
              Pedidos en Cola
            </span>
          </div>
          <p
            className={cn(
              "text-5xl font-bold",
              queueAlert ? "text-orange-600" : "text-slate-900 dark:text-white"
            )}
          >
            {kpis.queueCount}
          </p>
          <p className="text-xs mt-2 text-slate-400">
            {queueAlert ? (
              <span className="text-orange-600 font-medium">
                ⚠ Taller saturado — más de 5 pendientes
              </span>
            ) : (
              "Pendientes + En proceso"
            )}
          </p>
        </Card>

        {/* Tiempo Promedio de Igualación */}
        <Card className="p-5 border-2 border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">
              Tiempo Prom. Igualación
            </span>
          </div>
          <p className="text-5xl font-bold text-slate-900 dark:text-white">
            {kpis.avgProductionTime}
            <span className="text-2xl font-normal text-slate-400 ml-1">
              min
            </span>
          </p>
          <p className="text-xs mt-2 text-slate-400">
            Desde creación hasta completado
          </p>
        </Card>

        {/* Tasa de Colaboración del Día */}
        <Card className="p-5 border-2 border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <Handshake className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">
              Colaboración Hoy
            </span>
          </div>
          <p className="text-5xl font-bold text-slate-900 dark:text-white">
            {kpis.collaborationRateToday}
            <span className="text-2xl font-normal text-slate-400 ml-1">%</span>
          </p>
          <p className="text-xs mt-2 text-slate-400">
            {kpis.todayWithHelp} de {kpis.todayCompleted} completados hoy
            requirieron apoyo
          </p>
        </Card>
      </div>

      {/* ── 2 + 4. Stacked bar + Donut ── */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* 2. Índice de Asistencia Cruzada (stacked bar) */}
        <Card className="md:col-span-2">
          <CardTitle className="px-6 pt-6 pb-1">
            Índice de Asistencia Cruzada
          </CardTitle>
          <p className="px-6 text-xs text-slate-400 mb-2">
            Quién trabaja solo vs. quién requiere apoyo de su compañero
          </p>
          <CardContent className="h-[320px] p-4">
            {charts.igualadorStacked.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.igualadorStacked}
                  margin={{ top: 8, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={32} />
                  <Bar
                    dataKey="solo"
                    name="Solo (eficiencia)"
                    stackId="a"
                    fill="#22c55e"
                  />
                  <Bar
                    dataKey="conAyuda"
                    name="Requirió Ayuda"
                    stackId="a"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-500 pt-28">
                Sin datos de producción en el rango seleccionado
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4. Pedidos por Canal (donut) */}
        <Card>
          <CardTitle className="px-6 pt-6 pb-1">Pedidos por Canal</CardTitle>
          <p className="px-6 text-xs text-slate-400 mb-2">
            Origen del flujo de clientes
          </p>
          <CardContent className="h-[320px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.ordersBySource.map((s) => ({
                    ...s,
                    name: ORDER_SOURCE_LABELS[s.source] || s.source,
                  }))}
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={88}
                  dataKey="count"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {charts.ordersBySource.map((_, i) => (
                    <Cell
                      key={i}
                      fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} pedidos`, ""]} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Volumen por Vendedor ── */}
      <Card>
        <CardTitle className="px-6 pt-6 pb-1">Volumen por Vendedor</CardTitle>
        <p className="px-6 text-xs text-slate-400 mb-2">
          Cantidad de pedidos generados por persona
        </p>
        <CardContent className="h-[260px] p-4">
          {charts.sellerVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={charts.sellerVolume}
                layout="vertical"
                margin={{ left: 90, right: 30, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 13 }}
                  width={90}
                />
                <Tooltip formatter={(v) => [`${v} pedidos`, "Volumen"]} />
                <Bar
                  dataKey="count"
                  name="Pedidos"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-500 pt-16">
              Sin datos en el rango seleccionado
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Detalle Asistencia Cruzada (tabla) ── */}
      {charts.crossAssistance.length > 0 && (
        <Card className="p-6">
          <CardTitle className="mb-1">Detalle de Asistencia Cruzada</CardTitle>
          <p className="text-xs text-slate-400 mb-4">
            Pedidos donde el igualador principal recibió apoyo de su compañero
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Igualador Principal</th>
                <th className="py-2">Ayudante</th>
                <th className="py-2 text-right">Pedidos con apoyo</th>
              </tr>
            </thead>
            <tbody>
              {charts.crossAssistance.map((row) => (
                <tr
                  key={`${row.principal}-${row.helper}`}
                  className="border-b border-slate-100"
                >
                  <td className="py-2 font-medium">{row.principal}</td>
                  <td className="py-2 text-slate-600">{row.helper}</td>
                  <td className="py-2 text-right font-semibold">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
