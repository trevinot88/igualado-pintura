"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatMinutes, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils";
import { Play, CheckCircle, Clock, GripVertical, Printer, PackageCheck, UserCheck, Trash2 } from "lucide-react";

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
  igualadorId: string | null;
  igualador: { name: string } | null;
  operadorFisico: { id: string; nombre: string } | null;
  colorGroup: { name: string };
}

/** Tipo para el catálogo de Igualadores Físicos */
interface OperadorFisico {
  id: string;
  nombre: string;
  activo: boolean;
}

export default function ProduccionPage() {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  const role = user?.role;
  const userId = user?.id;
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [completedToday, setCompletedToday] = useState<QueueOrder[]>([]);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<QueueOrder | null>(null);
  const [ayudanteId, setAyudanteId] = useState("");
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  // Estado para confirmar override de turno
  const [showTurnoConfirm, setShowTurnoConfirm] = useState(false);
  const [pendingTakeOrder, setPendingTakeOrder] = useState<QueueOrder | null>(null);
  const [lastEqualizerName, setLastEqualizerName] = useState("");

  // 🆕 Estados para el modal de selección de operador físico
  const [showOperadorModal, setShowOperadorModal] = useState(false);
  const [operadoresFisicos, setOperadoresFisicos] = useState<OperadorFisico[]>([]);
  const [selectedOperadorId, setSelectedOperadorId] = useState("");
  const [pendingOperadorOrder, setPendingOperadorOrder] = useState<QueueOrder | null>(null);
  const [startingProduction, setStartingProduction] = useState(false);

  const fetchQueue = useCallback(() => {
    fetch("/api/produccion")
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "No se pudo cargar la cola de producción");
        }
        return r.json();
      })
      .then((data) => {
        setQueue(data.queue || []);
        setCompletedToday(data.completedToday || []);
        setLoading(false);
      })
      .catch((error) => {
        alert(error.message || "Error cargando producción");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchQueue();
    // Cargar igualadores físicos activos (Catálogo de Igualadores Físicos)
    fetchOperadoresFisicos();

    const interval = setInterval(fetchQueue, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchQueue]);

  /** 🆕 Carga los operadores físicos activos desde el catálogo */
  async function fetchOperadoresFisicos() {
    try {
      const res = await fetch("/api/igualadores?activos=true");
      const data = await res.json();
      setOperadoresFisicos(Array.isArray(data) ? data : []);
    } catch {
      console.error("Error fetching operadores físicos");
    }
  }

  async function handleMarkDelivered(orderId: string) {
    const res = await fetch(`/api/pedidos/${orderId}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ENTREGADO" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "No se pudo marcar como entregado");
      return;
    }
    fetchQueue();
  }

  async function handlePrintLabel(orderId: string) {
    const res = await fetch(`/api/pedidos/${orderId}/etiqueta`);
    const html = await res.text();
    const win = window.open("", "_blank", "width=400,height=250");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  }

  /** 🆕 Ejecuta el start vía API con operadorFisicoId */
  async function doTakeOrder(orderId: string, operadorFisicoId: string) {
    setStartingProduction(true);
    const res = await fetch("/api/produccion/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, operadorFisicoId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "No se pudo tomar el pedido");
      setStartingProduction(false);
      return;
    }
    setStartingProduction(false);
    fetchQueue();
  }

  /** 🆕 Al hacer clic en "Tomar Siguiente": abre el modal de selección de operador */
  function handleTakeOrder(order: QueueOrder) {
    // Guardar el pedido pendiente y abrir modal de selección de operador físico
    setPendingOperadorOrder(order);
    setSelectedOperadorId("");
    setShowOperadorModal(true);
  }

  /** 🆕 Confirmar operador y proceder */
  async function confirmOperadorYTomar() {
    if (!pendingOperadorOrder || !selectedOperadorId) return;

    // Si es ADMIN y quiere override de turno, manejarlo
    if (role === "ADMIN") {
      await doTakeOrder(pendingOperadorOrder.id, selectedOperadorId);
      setShowOperadorModal(false);
      setPendingOperadorOrder(null);
      return;
    }

    // Verificar turno (lógica existente)
    if (pendingOperadorOrder.igualadorId && pendingOperadorOrder.igualadorId !== userId) {
      setLastEqualizerName(pendingOperadorOrder.igualador?.name || "otro igualador");
      setPendingTakeOrder(pendingOperadorOrder);
      // Cerrar modal de operador, abrir modal de confirmación de turno
      setShowOperadorModal(false);
      return;
    }

    const enProceso = queue.filter((o) => o.status === "EN_PROCESO");
    const lastTaken = enProceso[enProceso.length - 1];
    if (lastTaken && lastTaken.igualadorId && lastTaken.igualadorId !== userId) {
      setLastEqualizerName(lastTaken.igualador?.name || "otro igualador");
      setPendingTakeOrder(pendingOperadorOrder);
      setShowOperadorModal(false);
      return;
    }

    // Es su turno — tomar directo
    await doTakeOrder(pendingOperadorOrder.id, selectedOperadorId);
    setShowOperadorModal(false);
    setPendingOperadorOrder(null);
  }

  async function confirmTakeOrder() {
    if (pendingTakeOrder && selectedOperadorId) {
      await doTakeOrder(pendingTakeOrder.id, selectedOperadorId);
    }
    setShowTurnoConfirm(false);
    setPendingTakeOrder(null);
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

  function openCompleteModal(order: QueueOrder) {
    setSelectedOrder(order);
    setAyudanteId("");
    setShowCompleteModal(true);
  }

  async function handleDeleteOrder(orderId: string, folio: string) {
    if (!window.confirm(`¿Eliminar/Cancelar pedido ${folio}?`)) return;
    const res = await fetch(`/api/pedidos/${orderId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "No se pudo eliminar el pedido");
      return;
    }
    fetchQueue();
  }

  async function handleCompleteOrder() {
    if (!selectedOrder) return;
    setCompleting(true);

    const res = await fetch("/api/produccion/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: selectedOrder.id,
        ayudanteFisicoId: ayudanteId || undefined,
      }),
    });

    setCompleting(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "No se pudo completar el pedido");
      return;
    }

    setShowCompleteModal(false);
    setSelectedOrder(null);
    setAyudanteId("");
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
                      <div className="flex items-center gap-1">
                        {role === "ADMIN" && (
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.folio)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Eliminar/Cancelar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <Badge className={ORDER_STATUS_COLORS[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </div>
                    </div>
                    <p className="font-semibold mt-1">{order.colorName}</p>
                    <p className="text-sm text-slate-500">
                      {order.colorGroup.name} · {order.liters}L · {order.client.name}
                    </p>
                    {/* FIFO: solo el primero puede ser tomado */}
                    {order.id === nextInQueue?.id && (role === "ADMIN" || role === "IGUALADOR") && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => handleTakeOrder(order)}
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
                  <div className="flex items-center gap-1">
                    {role === "ADMIN" && (
                      <button
                        onClick={() => handleDeleteOrder(order.id, order.folio)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Eliminar/Cancelar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <Badge className={ORDER_STATUS_COLORS[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                </div>
                <p className="font-semibold mt-1">{order.colorName}</p>
                <p className="text-sm text-slate-500">
                  {order.colorGroup.name} · {order.liters}L · {order.client.name}
                </p>
                {order.igualador && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> {order.igualador.name}
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
                    onClick={() => openCompleteModal(order)}
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
                  <div className="flex items-center gap-1">
                    {role === "ADMIN" && (
                      <button
                        onClick={() => handleDeleteOrder(order.id, order.folio)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Eliminar/Cancelar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <Badge className={ORDER_STATUS_COLORS.LISTO}>Listo</Badge>
                  </div>
                </div>
                <p className="font-semibold mt-1">{order.colorName}</p>
                <p className="text-sm text-slate-500">
                  {order.colorGroup.name} · {order.liters}L · {order.client.name}
                </p>
                <div className="flex gap-2 mt-2">
                  {(role === "ADMIN" || role === "FACTURACION") && (
                    <Button
                      size="sm"
                      className="flex-1 bg-slate-700 hover:bg-slate-800"
                      onClick={() => handleMarkDelivered(order.id)}
                    >
                      <PackageCheck className="h-4 w-4 mr-1" /> Entregar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handlePrintLabel(order.id)}
                  >
                    <Printer className="h-4 w-4 mr-1" /> Etiqueta
                  </Button>
                </div>
              </Card>
            ))}
            {completedToday.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Sin completados hoy</p>
            )}
          </div>
        </div>
      </div>

      {/* 🆕 Modal: Selección de Operador Físico */}
      <Dialog open={showOperadorModal} onOpenChange={setShowOperadorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              ¿Quién está procesando este pedido?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pendingOperadorOrder && (
              <p className="text-sm text-slate-600">
                Pedido: <span className="font-semibold">{pendingOperadorOrder.folio}</span> — {pendingOperadorOrder.colorName}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Selecciona el operador físico *</label>
              {operadoresFisicos.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                  No hay operadores físicos activos. Un administrador debe agregarlos en la sección de Usuarios.
                </p>
              ) : (
                <select
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={selectedOperadorId}
                  onChange={(e) => setSelectedOperadorId(e.target.value)}
                >
                  <option value="">-- Seleccionar --</option>
                  {operadoresFisicos.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowOperadorModal(false);
                  setPendingOperadorOrder(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmOperadorYTomar}
                disabled={!selectedOperadorId || startingProduction}
              >
                {startingProduction ? "Iniciando..." : "Confirmar y Tomar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de turno */}
      <Dialog open={showTurnoConfirm} onOpenChange={setShowTurnoConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-500" />
              ¿No es tu turno?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{lastEqualizerName}</span> tomó el último pedido. 
              Normalmente debería tomar el siguiente, pero si está ausente puedes tomarlo tú.
            </p>
            <p className="text-sm text-slate-500">
              ¿Seguro que quieres tomar este pedido?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowTurnoConfirm(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmTakeOrder}>
                Sí, tomarlo yo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de completar */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedOrder && (
              <p className="text-sm text-slate-600">
                Pedido <span className="font-semibold">{selectedOrder.folio}</span> - {selectedOrder.colorName}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">¿Recibiste ayuda de otro igualador físico? (opcional)</label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={ayudanteId}
                onChange={(e) => setAyudanteId(e.target.value)}
              >
                <option value="">Sin ayudante</option>
                {operadoresFisicos
                  .filter((i) => i.id !== selectedOrder?.operadorFisico?.id)
                  .map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleCompleteOrder}
              disabled={completing}
            >
              {completing ? "Completando..." : "Guardar y Completar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
