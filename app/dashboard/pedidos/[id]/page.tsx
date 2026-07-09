"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IgualacionLineCombobox } from "@/components/igualacion-line-combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDate,
  formatMinutes,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_SOURCE_LABELS,
} from "@/lib/utils";
import {
  ArrowLeft,
  Printer,
  Mail,
  ChevronRight,
  Pencil,
} from "lucide-react";


interface OrderDetail {
  id: string;
  folio: string;
  colorName: string;
  liters: number;
  status: string;
  source: string;
  notes: string | null;
  queuePosition: number;
  productionTimeMinutes: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  clientId: string;
  colorGroupId: string;
  igualacionLineId: string | null;
  sellerId: string;
  igualadorId: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null; company: string | null; allowCredit: boolean };
  seller: { id: string; name: string; email: string };
  vendedor: { id: string; nombre: string } | null;
  igualador: { id: string; name: string; email: string } | null;
  colorGroup: { id: string; name: string };
  igualacionLine: { id: string; code: string; name: string } | null;
  location: { name: string } | null;
  labels: { id: string; printedAt: string }[];
  auditTrail: { id: string; action: string; changes: Record<string, unknown> | null; createdAt: string; user: { name: string } | null }[];
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface ColorGroup {
  id: string;
  name: string;
}

interface Seller {
  id: string;
  name: string;
  role: "ADMIN" | "VENDEDOR_READONLY";
  email: string;
}

interface IgualadorOption {
  id: string;
  name: string;
  email: string;
}

interface IgualacionLine {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const STATUS_TRANSITIONS: Record<string, { next: string; label: string; roles: string[]; color: string }[]> = {
  PENDIENTE: [
    { next: "EN_PROCESO", label: "Iniciar Producción", roles: ["ADMIN", "IGUALADOR"], color: "bg-blue-600 hover:bg-blue-700" },
    { next: "PAUSADO", label: "Pausar", roles: ["ADMIN"], color: "bg-yellow-600 hover:bg-yellow-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  EN_PROCESO: [
    { next: "LISTO", label: "Marcar como Listo", roles: ["ADMIN", "IGUALADOR"], color: "bg-green-600 hover:bg-green-700" },
    { next: "PAUSADO", label: "Pausar", roles: ["ADMIN"], color: "bg-yellow-600 hover:bg-yellow-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  LISTO: [
    { next: "ENTREGADO", label: "Marcar Entregado", roles: ["ADMIN", "FACTURACION"], color: "bg-gray-600 hover:bg-gray-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  PAUSADO: [
    { next: "PENDIENTE", label: "Reanudar", roles: ["ADMIN"], color: "bg-blue-600 hover:bg-blue-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
};

const NON_EDITABLE_STATUSES = ["ENTREGADO", "CANCELADO"];

const SOURCES = [
  { value: "MOSTRADOR", label: "Mostrador" },
  { value: "VENTAS", label: "Ventas" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "REDES_SOCIALES", label: "Redes Sociales" },
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string })?.role || "";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [notesContent, setNotesContent] = useState("");

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<ColorGroup[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [igualadores, setIgualadores] = useState<IgualadorOption[]>([]);
  const [lines, setLines] = useState<IgualacionLine[]>([]);

  // Edit form fields
  const [editClientId, setEditClientId] = useState("");
  const [editColorGroupId, setEditColorGroupId] = useState("");
  const [editIgualacionLineId, setEditIgualacionLineId] = useState<string | null>(null);
  const [editColorName, setEditColorName] = useState("");
  const [editLiters, setEditLiters] = useState(1);
  const [editSource, setEditSource] = useState("MOSTRADOR");
  const [editSellerId, setEditSellerId] = useState("");
  const [editIgualadorId, setEditIgualadorId] = useState<string | null>(null);
  const [editFormNotes, setEditFormNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  function fetchOrder() {
    fetch(`/api/pedidos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchOrder();
  }, [id]);

  // Auto-open edit modal when ?edit=1 is in the URL
  useEffect(() => {
    if (searchParams.get("edit") === "1" && !loading && order) {
      openEditModal();
    }
  }, [searchParams, loading, order]);

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/pedidos/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      fetchOrder();
    } else {
      const err = await res.json();
      alert(err.error || "Error al cambiar estado");
    }
  }

  async function handlePrintLabel() {
    const res = await fetch(`/api/pedidos/${id}/etiqueta`);
    const html = await res.text();
    const win = window.open("", "_blank", "width=400,height=250");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
    fetchOrder();
  }

  async function handleResendEmail() {
    await fetch("/api/notificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    alert("Email enviado");
  }

  async function handleSaveNotes() {
    const res = await fetch(`/api/pedidos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesContent }),
    });
    if (res.ok) {
      setNotesDialogOpen(false);
      fetchOrder();
    } else {
      const err = await res.json();
      alert(err.error || "Error al guardar notas");
    }
  }

  function openEditModal() {
    if (!order) return;
    setEditClientId(order.clientId);
    setEditColorGroupId(order.colorGroupId);
    setEditIgualacionLineId(order.igualacionLineId);
    setEditColorName(order.colorName);
    setEditLiters(order.liters);
    setEditSource(order.source);
    setEditSellerId(order.sellerId);
    setEditIgualadorId(order.igualadorId);
    setEditFormNotes(order.notes || "");
    setClientSearch(order.client.name);
    setShowEditModal(true);

    // Load options if not already loaded
    if (clients.length === 0) fetch("/api/clientes").then((r) => r.json()).then(setClients);
    if (groups.length === 0) fetch("/api/color-groups").then((r) => r.json()).then(setGroups);
    if (sellers.length === 0) fetch("/api/usuarios/sellers").then((r) => r.json()).then(setSellers);
    if (igualadores.length === 0) fetch("/api/usuarios/igualadores").then((r) => r.json()).then(setIgualadores);
    if (lines.length === 0) fetch("/api/igualacion-lines").then((r) => r.json()).then(setLines);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: editClientId,
          colorGroupId: editColorGroupId,
          igualacionLineId: editIgualacionLineId,
          colorName: editColorName,
          liters: editLiters,
          source: editSource,
          sellerId: editSource === "VENTAS" ? editSellerId : undefined,
          igualadorId: editIgualadorId,
          notes: editFormNotes || undefined,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchOrder();
      } else {
        const err = await res.json();
        alert(err.error || "Error al guardar cambios");
      }
    } catch {
      alert("Error al guardar cambios");
    }
    setSaving(false);
  }

  if (loading || !order) return <div className="p-8 text-center">Cargando pedido...</div>;


  const transitions = STATUS_TRANSITIONS[order.status] || [];
  const allowedTransitions = transitions.filter((t) => t.roles.includes(role));
  const canEdit = sessionStatus === "authenticated" && role === "ADMIN" && !NON_EDITABLE_STATUSES.includes(order.status);

  const timeline = [
    { label: "Creado", date: order.createdAt, done: true },
    { label: "En Proceso", date: order.startedAt, done: !!order.startedAt },
    { label: "Listo", date: order.completedAt, done: !!order.completedAt },
    { label: "Entregado", date: order.deliveredAt, done: !!order.deliveredAt },
  ];

  if (order.cancelledAt) {
    timeline.push({ label: "Cancelado", date: order.cancelledAt, done: true });
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-mono">{order.folio}</h1>
            <p className="text-sm text-slate-500">{ORDER_SOURCE_LABELS[order.source]} · {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <Badge className={`${ORDER_STATUS_COLORS[order.status]} text-sm px-3 py-1`}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {allowedTransitions.map((t) => (
          <Button
            key={t.next}
            className={`text-white ${t.color}`}
            onClick={() => handleStatusChange(t.next)}
          >
            {t.label}
          </Button>
        ))}
        {canEdit && (
          <Button variant="outline" onClick={openEditModal}>
            <Pencil className="h-4 w-4 mr-1" /> Editar Pedido
          </Button>
        )}
        <Button variant="outline" onClick={handlePrintLabel}>
          <Printer className="h-4 w-4 mr-1" /> Etiqueta
        </Button>
        {role === "ADMIN" && (
          <Button variant="outline" onClick={() => {
            setNotesContent(order.notes || "");
            setNotesDialogOpen(true);
          }}>
            <Pencil className="h-4 w-4 mr-1" /> Notas / Factura
          </Button>
        )}
        {order.status === "LISTO" && order.client.email && role === "ADMIN" && (
          <Button variant="outline" onClick={handleResendEmail}>
            <Mail className="h-4 w-4 mr-1" /> Reenviar Email
          </Button>
        )}
      </div>


      <div className="grid md:grid-cols-2 gap-6">
        {/* Order Info */}
        <Card>
          <CardTitle className="mb-4">Información del Pedido</CardTitle>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Color</dt>
                <dd className="font-medium">{order.colorName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Grupo</dt>
                <dd>{order.colorGroup.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Litros</dt>
                <dd>{order.liters}L</dd>
              </div>
              {order.igualacionLine && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Línea Igualación</dt>
                  <dd>{order.igualacionLine.code} - {order.igualacionLine.name}</dd>
                </div>
              )}
              {order.productionTimeMinutes && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tiempo Producción</dt>
                  <dd>{formatMinutes(order.productionTimeMinutes)}</dd>
                </div>
              )}
              <div className="border-t pt-2">
                <div className="flex items-center justify-between mb-1">
                  <dt className="text-slate-500">Notas</dt>
                  {role === "ADMIN" && (
                    <button
                      onClick={() => {
                        setNotesContent(order.notes || "");
                        setNotesDialogOpen(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  )}
                </div>
                <dd className={`rounded p-2 text-sm ${order.notes ? "bg-slate-50 dark:bg-slate-900" : "text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/50"}`}>
                  {order.notes || "Sin notas"}
                </dd>
              </div>
            </dl>

          </CardContent>
        </Card>

        {/* Client Info */}
        <Card>
          <CardTitle className="mb-4">Cliente</CardTitle>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Nombre</dt>
                <dd className="font-medium">{order.client.name}</dd>
              </div>
              {order.client.email && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Email</dt>
                  <dd>{order.client.email}</dd>
                </div>
              )}
              {order.client.phone && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Teléfono</dt>
                  <dd>{order.client.phone}</dd>
                </div>
              )}
              {order.client.company && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Empresa</dt>
                  <dd>{order.client.company}</dd>
                </div>
              )}
              {order.client.allowCredit && (
                <div>
                  <Badge className="bg-amber-100 text-amber-800">Crédito Habilitado</Badge>
                </div>
              )}
              <div className="border-t pt-2">
                <dt className="text-slate-500">Vendedor</dt>
                <dd>{order.seller.name}</dd>
              </div>
              {order.igualador && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Igualador</dt>
                  <dd>{order.igualador.name}</dd>
                </div>
              )}
              {order.location && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Sucursal</dt>
                  <dd>{order.location.name}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardTitle className="mb-4">Timeline</CardTitle>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {timeline.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className={`flex flex-col items-center min-w-[80px] ${step.done ? "text-green-600" : "text-slate-300"}`}>
                  <div className={`w-3 h-3 rounded-full ${step.done ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                  <span className="text-xs font-medium mt-1">{step.label}</span>
                  {step.date && (
                    <span className="text-[10px] text-slate-400">{formatDate(step.date)}</span>
                  )}
                </div>
                {i < timeline.length - 1 && (
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 ${step.done ? "text-green-400" : "text-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Labels */}
      {order.labels.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Etiquetas Impresas</CardTitle>
          <CardContent>
            <div className="space-y-1">
              {order.labels.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <Printer className="h-4 w-4 text-slate-400" />
                  <span>Impresa: {formatDate(l.printedAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <CardTitle className="mb-4">Historial de Cambios</CardTitle>
        <CardContent>
          {order.auditTrail.length > 0 ? (
            <div className="space-y-2">
              {order.auditTrail.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm border-b border-slate-100 pb-2">
                  <div className="flex-1">
                    <span className="font-medium">{log.user?.name || "Sistema"}</span>
                    <span className="text-slate-500 ml-2">{log.action}</span>
                    {log.changes && (
                      <pre className="text-xs text-slate-500 mt-1 bg-slate-50 dark:bg-slate-900 rounded p-1 overflow-x-auto">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Sin registros</p>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog - available in any status (except CANCELADO) */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Notas - {order.folio}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Agrega el número de factura, nota de venta o cualquier otra observación.
            </p>
            <textarea
              className="w-full min-h-[120px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Escribe las notas aquí..."
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNotes}>
                Guardar Notas
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pedido {order.folio}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              <Input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setEditClientId(c.id);
                      setClientSearch(c.name);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      editClientId === c.id
                        ? "bg-slate-900 text-white"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    {c.phone && <div className="text-xs opacity-70">{c.phone}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Grupo de Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Grupo de Color</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setEditColorGroupId(g.id)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                      editColorGroupId === g.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 hover:border-slate-400 dark:border-slate-700"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Línea de Igualación */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Línea de Igualación</label>
              <IgualacionLineCombobox
                lines={lines}
                value={editIgualacionLineId || ""}
                onChange={(lineId) => {
                  setEditIgualacionLineId(lineId || null);
                  const selectedLine = lines.find((l) => l.id === lineId);
                  if (selectedLine?.description && !editColorName) {
                    setEditColorName(selectedLine.description);
                  }
                }}
                placeholder="Buscar por código o descripción..."
              />
            </div>

            {/* Color Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del Color</label>
              <Input
                placeholder="Ej: BIKAPA CROMACRYL ORG. APERLADO 1L"
                value={editColorName}
                onChange={(e) => setEditColorName(e.target.value)}
              />
            </div>

            {/* Litros */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Litros</label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={editLiters}
                onChange={(e) => setEditLiters(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Canal */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Canal</label>
              <div className="flex gap-2 flex-wrap">
                {SOURCES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      setEditSource(s.value);
                      if (s.value !== "VENTAS") setEditSellerId("");
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      editSource === s.value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendedor (only for VENTAS) */}
            {editSource === "VENTAS" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Vendedor *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={editSellerId}
                  onChange={(e) => setEditSellerId(e.target.value)}
                >
                  <option value="">Selecciona quién hizo la venta</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name} ({seller.role === "ADMIN" ? "Admin" : "Vendedor"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Igualador */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Igualador</label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={editIgualadorId || ""}
                onChange={(e) => setEditIgualadorId(e.target.value || null)}
              >
                <option value="">Sin asignar</option>
                {igualadores.map((ig) => (
                  <option key={ig.id} value={ig.id}>
                    {ig.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas</label>
              <textarea
                className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                rows={3}
                placeholder="Notas adicionales..."
                value={editFormNotes}
                onChange={(e) => setEditFormNotes(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSaveEdit}
              disabled={
                saving ||
                !editClientId ||
                !editColorGroupId ||
                !editColorName ||
                !editLiters ||
                (editSource === "VENTAS" && !editSellerId)
              }
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
