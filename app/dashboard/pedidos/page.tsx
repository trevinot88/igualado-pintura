"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_SOURCE_LABELS,
} from "@/lib/utils";
import { Search, Filter, Eye, Trash2, Calendar, Pencil } from "lucide-react";

interface Order {
  id: string;
  folio: string;
  colorName: string;
  liters: number;
  status: string;
  source: string;
  createdAt: string;
  client: { name: string };
  seller: { name: string };
  colorGroup: { name: string };
  igualador: { name: string } | null;
  ayudante: { name: string } | null;
  operadorFisico: { nombre: string } | null;
  vendedor: { nombre: string } | null;
}

type DateFilter = "" | "day" | "week" | "month" | "year";

function getDateRange(filter: DateFilter): { from?: string; to?: string } {
  if (!filter) return {};
  const now = new Date();
  const from = new Date();
  if (filter === "day") {
    from.setHours(0, 0, 0, 0);
  } else if (filter === "week") {
    from.setDate(from.getDate() - from.getDay());
    from.setHours(0, 0, 0, 0);
  } else if (filter === "month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else if (filter === "year") {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

export default function PedidosPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const dr = getDateRange(dateFilter);
    if (dr.from) params.set("from", dr.from);
    if (dr.to) params.set("to", dr.to);

    fetch(`/api/pedidos?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
      });
  }, [search, statusFilter, dateFilter]);

  async function handleDeleteOrder(orderId: string, folio: string) {
    if (!window.confirm(`¿Eliminar/Cancelar pedido ${folio}?`)) return;
    const res = await fetch(`/api/pedidos/${orderId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "No se pudo eliminar el pedido");
      return;
    }
    // Refresh
    setSearch((s) => s + " ");
    setTimeout(() => setSearch((s) => s.trim()), 0);
  }

  const statuses = [
    "",
    "PENDIENTE",
    "EN_PROCESO",
    "PAUSADO",
    "LISTO",
    "ENTREGADO",
    "CANCELADO",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Link href="/dashboard/pedidos/nuevo">
          <Button>+ Nuevo Pedido</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          <Input
            placeholder="Buscar por folio, color o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {s ? ORDER_STATUS_LABELS[s] : "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-slate-400" />
        <div className="flex gap-1 flex-wrap">
          {(["", "day", "week", "month", "year"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                dateFilter === d
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {d === "" ? "Todas las fechas" : d === "day" ? "Hoy" : d === "week" ? "Semana" : d === "month" ? "Mes" : "Año"}
            </button>
          ))}
        </div>
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Orders Table */}
      {loading ? (
        <p className="text-center py-8 text-slate-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-4 py-3 font-medium">Folio</th>
                <th className="text-left px-4 py-3 font-medium">Color</th>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">Litros</th>
                <th className="text-left px-4 py-3 font-medium">Canal</th>
                <th className="text-left px-4 py-3 font-medium">Igualador</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td className="px-4 py-3 font-mono font-medium">{order.folio}</td>
                  <td className="px-4 py-3">
                    <div>{order.colorName}</div>
                    <div className="text-xs text-slate-500">{order.colorGroup.name}</div>
                  </td>
                  <td className="px-4 py-3">{order.client.name}</td>
                  <td className="px-4 py-3">{order.liters}L</td>
                  <td className="px-4 py-3 text-xs">
                    {order.source === "VENTAS" && order.vendedor ? (
                      <span>
                        {ORDER_SOURCE_LABELS[order.source] || order.source} - {order.vendedor.nombre}
                      </span>
                    ) : (
                      ORDER_SOURCE_LABELS[order.source] || order.source
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {order.operadorFisico ? (
                      <div>
                        <span>{order.operadorFisico.nombre}</span>
                        {order.ayudante && (
                          <span className="block text-slate-400">+ {order.ayudante.name}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={ORDER_STATUS_COLORS[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {role === "ADMIN" && (
                        <button
                          onClick={() => handleDeleteOrder(order.id, order.folio)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Eliminar/Cancelar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <Link href={`/dashboard/pedidos/${order.id}`}>
                        <Button variant="ghost" size="icon" title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {sessionStatus === "authenticated" && role === "ADMIN" && order.status !== "ENTREGADO" && order.status !== "CANCELADO" && (
                        <Link href={`/dashboard/pedidos/${order.id}?edit=1`}>
                          <Button variant="ghost" size="icon" title="Editar pedido">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500">
                    No se encontraron pedidos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}