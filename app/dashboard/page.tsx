"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
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

const SOURCE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#a3e635", "#fb923c"];

const GROUP_COLORS: Record<string, string> = {
  "Básicos": "#3b82f6",
  "Premium": "#8b5cf6",
  "Metálicos": "#f59e0b",
  "Especiales": "#ec4899",
};

const GROUP_COLORS_ARRAY = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981", "#06b6d4", "#fb923c", "#a3e635"];

type Period = "dia" | "semana" | "mes" | "anio";

const PERIOD_LABELS: Record<Period, string> = {
  dia: "Hoy",
  semana: "Esta Semana",
  mes: "Este Mes",
  anio: "Este Año",
};

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  // Instantes ISO precisos en hora LOCAL del navegador → evita el desfase
  // de zona horaria (un "2026-06-20" suelto se interpretaba como medianoche UTC).
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  // Fin del día de HOY: garantiza que los pedidos creados hoy siempre cuenten.
  const to = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999
  ).toISOString();

  switch (period) {
    case "dia":
      return { from: startOfDay(now), to };
    case "semana": {
      const day = now.getDay(); // 0=Dom, 1=Lun…
      const diff = day === 0 ? -6 : 1 - day; // lunes de esta semana
      const start = new Date(now);
      start.setDate(now.getDate() + diff);
      return { from: startOfDay(start), to };
    }
    case "mes": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to };
    }
    case "anio": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: startOfDay(start), to };
    }
  }
}

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
    sellerVolume: { name: string; count: number; liters: number }[];
    sellerVolumeNoTienda: { name: string; count: number; liters: number }[];
    crossAssistance: { principal: string; helper: string; count: number }[];
    litersByGroup: { groupName: string; totalLiters: number }[];
    litersByColor: { colorName: string; groupName: string; totalLiters: number }[];
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<Period>("semana");

  useEffect(() => {
    const { from, to } = getPeriodDates(period);
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    fetch(`/api/reportes?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [period]);

  if (!data)
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando dashboard...
      </div>
    );

  const { kpis, charts } = data;
  const queueAlert = kpis.queueCount >= 5;

  // Para el donut: expandir la rebanada "Ventas" en una por vendedor.
  // Se usa sellerVolumeNoTienda para no incluir "Tienda" (MOSTRADOR ya tiene
  // su propia rebanada en el donut y se atribuye aparte en volumen).
  const donutData = charts.ordersBySource.flatMap((s) => {
    if (
      s.source === "VENTAS" &&
      charts.sellerVolumeNoTienda &&
      charts.sellerVolumeNoTienda.length > 0
    ) {
      return charts.sellerVolumeNoTienda.map((sv) => ({
        name: `${sv.name} · Ventas`,
        count: sv.count,
      }));
    }
    return [{ name: ORDER_SOURCE_LABELS[s.source] || s.source, count: s.count }];
  });

  return (
    <div className="space-y-6">
      {/* ── Header + Filtros ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                period === p
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600"
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
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
                  data={donutData}
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={88}
                  dataKey="count"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {donutData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} pedidos`, ""]} />
                <Legend
                  verticalAlign="bottom"
                  height={48}
                  content={({ payload }) => (
                    <div
                      className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 px-2"
                      style={{ maxHeight: 48, overflow: "hidden" }}
                    >
                      {payload?.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 text-[11px]"
                          style={{
                            maxWidth: 110,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: entry.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Volumen por Vendedor ── */}
      <Card>
        <CardTitle className="px-6 pt-6 pb-1">Volumen por Vendedor</CardTitle>
        <p className="px-6 text-xs text-slate-400 mb-2">
          Pedidos y litros vendidos por persona
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
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 13 }}
                  width={90}
                />
                <Tooltip
                  formatter={(v, name) =>
                    name === "Litros"
                      ? [`${Number(v).toFixed(1)} L`, "Litros"]
                      : [`${v} pedidos`, "Pedidos"]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="count"
                  name="Pedidos"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="liters"
                  name="Litros"
                  fill="#10b981"
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

      {/* ── Litros por Grupo de Color ── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardTitle className="px-6 pt-6 pb-1">Litros por Grupo de Color</CardTitle>
          <p className="px-6 text-xs text-slate-400 mb-2">
            Volumen total de pintura igualada por grupo
          </p>
          <CardContent className="h-[300px] p-4">
            {charts.litersByGroup && charts.litersByGroup.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.litersByGroup}
                  layout="vertical"
                  margin={{ left: 80, right: 30, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="groupName"
                    tick={{ fontSize: 13 }}
                    width={80}
                  />
                  <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(1)} L`, "Volumen"]} />
                  <Bar dataKey="totalLiters" name="Litros" radius={[0, 4, 4, 0]}>
                    {charts.litersByGroup.map((entry, i) => (
                      <Cell key={i} fill={GROUP_COLORS[entry.groupName] || GROUP_COLORS_ARRAY[i % GROUP_COLORS_ARRAY.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Sin datos en el rango seleccionado
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardTitle className="px-6 pt-6 pb-1">Litros por Color Exacto</CardTitle>
          <p className="px-6 text-xs text-slate-400 mb-2">
            Los colores más igualados por volumen
          </p>
          <CardContent className="max-h-[300px] overflow-y-auto p-4">
            {charts.litersByColor && charts.litersByColor.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">Color</th>
                    <th className="py-2">Grupo</th>
                    <th className="py-2 text-right">Litros</th>
                  </tr>
                </thead>
                <tbody>
                  {charts.litersByColor.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 font-medium">{row.colorName}</td>
                      <td className="py-2 text-slate-600">{row.groupName}</td>
                      <td className="py-2 text-right font-semibold">{row.totalLiters.toFixed(1)} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400">
                Sin datos en el rango seleccionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
