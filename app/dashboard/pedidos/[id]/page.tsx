"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatCurrency,
  formatDate,
  formatMinutes,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/utils";
import {
  ArrowLeft,
  Printer,
  Mail,
  CreditCard,
  ChevronRight,
} from "lucide-react";

interface OrderDetail {
  id: string;
  folio: string;
  colorName: string;
  liters: number;
  pricePerLiter: number;
  totalPrice: number;
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
  client: { id: string; name: string; email: string | null; phone: string | null; company: string | null; allowCredit: boolean };
  seller: { id: string; name: string; email: string };
  igualador: { id: string; name: string; email: string } | null;
  colorGroup: { name: string };
  location: { name: string } | null;
  payments: { id: string; amount: number; method: string; reference: string | null; notes: string | null; createdAt: string }[];
  labels: { id: string; printedAt: string }[];
  auditTrail: { id: string; action: string; changes: Record<string, unknown> | null; createdAt: string; user: { name: string } | null }[];
}

const STATUS_TRANSITIONS: Record<string, { next: string; label: string; roles: string[]; color: string }[]> = {
  PENDIENTE: [
    { next: "EN_PROCESO", label: "Iniciar Producción", roles: ["ADMIN", "IGUALADOR"], color: "bg-blue-600 hover:bg-blue-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  EN_PROCESO: [
    { next: "LISTO", label: "Marcar como Listo", roles: ["ADMIN", "IGUALADOR"], color: "bg-green-600 hover:bg-green-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  LISTO: [
    { next: "FACTURADO", label: "Facturar", roles: ["ADMIN", "VENDEDOR"], color: "bg-purple-600 hover:bg-purple-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  FACTURADO: [
    { next: "PAGADO", label: "Marcar Pagado", roles: ["ADMIN", "VENDEDOR"], color: "bg-emerald-600 hover:bg-emerald-700" },
    { next: "CANCELADO", label: "Cancelar", roles: ["ADMIN"], color: "bg-red-600 hover:bg-red-700" },
  ],
  PAGADO: [
    { next: "ENTREGADO", label: "Marcar Entregado", roles: ["ADMIN", "VENDEDOR"], color: "bg-gray-600 hover:bg-gray-700" },
  ],
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("EFECTIVO");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

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

  async function handleAddPayment() {
    const res = await fetch(`/api/pedidos/${id}/pagos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(payAmount),
        method: payMethod,
        reference: payRef || undefined,
        notes: payNotes || undefined,
      }),
    });
    if (res.ok) {
      setShowPayment(false);
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      fetchOrder();
    }
  }

  if (loading || !order) return <div className="p-8 text-center">Cargando pedido...</div>;

  const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = order.totalPrice - totalPaid;
  const transitions = STATUS_TRANSITIONS[order.status] || [];
  const allowedTransitions = transitions.filter((t) => t.roles.includes(role));

  const timeline = [
    { label: "Creado", date: order.createdAt, done: true },
    { label: "En Proceso", date: order.startedAt, done: !!order.startedAt },
    { label: "Listo", date: order.completedAt, done: !!order.completedAt },
    { label: "Facturado", date: order.invoicedAt, done: !!order.invoicedAt },
    { label: "Pagado", date: order.paidAt, done: !!order.paidAt },
    { label: "Entregado", date: order.deliveredAt, done: !!order.deliveredAt },
  ];

  if (order.cancelledAt) {
    timeline.push({ label: "Cancelado", date: order.cancelledAt, done: true });
  }

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
        <Button variant="outline" onClick={handlePrintLabel}>
          <Printer className="h-4 w-4 mr-1" /> Etiqueta
        </Button>
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
              <div className="flex justify-between">
                <dt className="text-slate-500">Precio/Litro</dt>
                <dd>{formatCurrency(order.pricePerLiter)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-slate-500 font-medium">Total</dt>
                <dd className="font-bold text-lg">{formatCurrency(order.totalPrice)}</dd>
              </div>
              {order.productionTimeMinutes && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tiempo Producción</dt>
                  <dd>{formatMinutes(order.productionTimeMinutes)}</dd>
                </div>
              )}
              {order.notes && (
                <div className="border-t pt-2">
                  <dt className="text-slate-500 mb-1">Notas</dt>
                  <dd className="bg-slate-50 dark:bg-slate-900 rounded p-2">{order.notes}</dd>
                </div>
              )}
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

      {/* Payments */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Pagos</CardTitle>
          {(role === "ADMIN" || role === "VENDEDOR") && (
            <Dialog open={showPayment} onOpenChange={setShowPayment}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <CreditCard className="h-4 w-4 mr-1" /> Registrar Pago
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Pago</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Monto</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder={`Pendiente: ${formatCurrency(remaining)}`}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Método</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Referencia</label>
                    <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="No. referencia" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notas</label>
                    <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Notas..." />
                  </div>
                  <Button onClick={handleAddPayment} disabled={!payAmount || parseFloat(payAmount) <= 0} className="w-full">
                    Registrar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <CardContent>
          <div className="flex justify-between text-sm mb-3 font-medium">
            <span>Total: {formatCurrency(order.totalPrice)}</span>
            <span>Pagado: {formatCurrency(totalPaid)}</span>
            <span className={remaining > 0 ? "text-red-600" : "text-green-600"}>
              {remaining > 0 ? `Pendiente: ${formatCurrency(remaining)}` : "Pagado completo"}
            </span>
          </div>
          {order.payments.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">Monto</th>
                  <th className="py-2">Método</th>
                  <th className="py-2">Referencia</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{formatCurrency(p.amount)}</td>
                    <td className="py-2">{PAYMENT_METHOD_LABELS[p.method] || p.method}</td>
                    <td className="py-2 text-slate-500">{p.reference || "—"}</td>
                    <td className="py-2 text-slate-500">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Sin pagos registrados</p>
          )}
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
    </div>
  );
}
