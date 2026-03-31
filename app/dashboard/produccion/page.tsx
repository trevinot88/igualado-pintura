"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatMinutes, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils";
import { Play, CheckCircle, Clock, GripVertical } from "lucide-react";

interface QueueOrder {
  id: string;
  folio: string;
  colorName: string;
  liters: number;
  status: string;
  queuePosition: number;
  startedAt: string | null;
  createdAt: string;
  client: { name: string };
  seller: { name: string };
  igualador: { name: string } | null;
  colorGroup: { name: string };
}

export default function ProduccionPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [completedToday, setCompletedToday] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(() => {
    fetch("/api/produccion")
      .then((r) => r.json())
      .then((data) => {
        setQueue(data.queue || []);
        setCompletedToday(data.completedToday || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchQueue]);

  async function handleStatusChange(orderId: string, newStatus: string) {
    await fetch(`/api/pedidos/${orderId}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchQueue();
  }

  async function handleReorder(dragIdx: number, dropIdx: number) {
    if (role !== "ADMIN") return;
    const reordered = [...queue.filter((o) => o.status === "PENDIENTE")];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    await fetch("/api/produccion", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((o) => o.id) }),
    });
    fetchQueue();
  }

  if (loading) return <div className="p-8 text-center">Cargando cola...</div>;

  const pendientes = queue.filter((o) => o.status === "PENDIENTE");
  const enProceso = queue.filter((o) => o.status === "EN_PROCESO");
  const nextInQueue = pendientes[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Producción</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* En Cola */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            En Cola ({pendientes.length})
          </h2>
          <div className="space-y-2">
            {pendientes.map((order, idx) => (
              <Card key={order.id} className="p-4">
                <div className="flex items-start gap-2">
                  {role === "ADMIN" && (
                    <button
                      className="mt-1 cursor-grab text-slate-400 hover:text-slate-600"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("idx", String(idx))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const fromIdx = parseInt(e.dataTransfer.getData("idx"));
                        handleReorder(fromIdx, idx);
                      }}
                    >
                      <GripVertical className="h-5 w-5" />
                    </button>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm">{order.folio}</span>
                      <Badge className={ORDER_STATUS_COLORS[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <p className="font-semibold mt-1">{order.colorName}</p>
                    <p className="text-sm text-slate-500">
                      {order.colorGroup.name} · {order.liters}L · {order.client.name}
                    </p>
                    {/* FIFO: only first in queue can be taken */}
                    {order.id === nextInQueue?.id && (role === "ADMIN" || role === "IGUALADOR") && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => handleStatusChange(order.id, "EN_PROCESO")}
                      >
                        <Play className="h-4 w-4 mr-1" /> Tomar Siguiente
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {pendientes.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Cola vacía</p>
            )}
          </div>
        </div>

        {/* En Proceso */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-600" />
            En Proceso ({enProceso.length})
          </h2>
          <div className="space-y-2">
            {enProceso.map((order) => (
              <Card key={order.id} className="p-4 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">{order.folio}</span>
                  <Badge className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <p className="font-semibold mt-1">{order.colorName}</p>
                <p className="text-sm text-slate-500">
                  {order.colorGroup.name} · {order.liters}L · {order.client.name}
                </p>
                {order.igualador && (
                  <p className="text-xs text-slate-500 mt-1">
                    Igualador: {order.igualador.name}
                  </p>
                )}
                {order.startedAt && (
                  <LiveTimer startedAt={order.startedAt} />
                )}
                {(role === "ADMIN" || role === "IGUALADOR") && (
                  <Button
                    size="sm"
                    variant="default"
                    className="mt-2 w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusChange(order.id, "LISTO")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Finalizar
                  </Button>
                )}
              </Card>
            ))}
            {enProceso.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Ninguno en proceso</p>
            )}
          </div>
        </div>

        {/* Listos Hoy */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Listos Hoy ({completedToday.length})
          </h2>
          <div className="space-y-2">
            {completedToday.map((order) => (
              <Card key={order.id} className="p-4 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">{order.folio}</span>
                  <Badge className={ORDER_STATUS_COLORS.LISTO}>Listo</Badge>
                </div>
                <p className="font-semibold mt-1">{order.colorName}</p>
                <p className="text-sm text-slate-500">
                  {order.colorGroup.name} · {order.liters}L · {order.client.name}
                </p>
              </Card>
            ))}
            {completedToday.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Sin completados hoy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
      <Clock className="h-3 w-3" /> {formatMinutes(elapsed)}
    </p>
  );
}
