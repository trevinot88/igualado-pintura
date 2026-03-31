"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface ColorGroup {
  id: string;
  name: string;
  priceTiers: { minLiters: number; maxLiters: number; pricePerLiter: number }[];
}

export default function NuevoPedidoPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<ColorGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);

  // Form state
  const [clientId, setClientId] = useState("");
  const [colorGroupId, setColorGroupId] = useState("");
  const [colorName, setColorName] = useState("");
  const [liters, setLiters] = useState<number>(1);
  const [source, setSource] = useState("MOSTRADOR");
  const [notes, setNotes] = useState("");

  // Price preview
  const [preview, setPreview] = useState<{ pricePerLiter: number; totalPrice: number } | null>(null);

  // New client form
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClients);
    fetch("/api/precios").then((r) => r.json()).then(setGroups);
  }, []);

  // Calculate price preview
  useEffect(() => {
    if (!colorGroupId || !liters) {
      setPreview(null);
      return;
    }
    fetch(`/api/precios/calcular?colorGroupId=${colorGroupId}&liters=${liters}`)
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [colorGroupId, liters]);

  async function handleCreateClient() {
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClientName,
        email: newClientEmail || undefined,
        phone: newClientPhone || undefined,
      }),
    });
    const client = await res.json();
    setClients((prev) => [...prev, client]);
    setClientId(client.id);
    setShowNewClient(false);
    setNewClientName("");
    setNewClientEmail("");
    setNewClientPhone("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, colorGroupId, colorName, liters, source, notes }),
    });

    if (res.ok) {
      const order = await res.json();
      router.push(`/dashboard/pedidos/${order.id}`);
    } else {
      const err = await res.json();
      alert(err.error || "Error al crear pedido");
      setLoading(false);
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const sources = [
    { value: "MOSTRADOR", label: "Mostrador" },
    { value: "VENTAS", label: "Ventas" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "REDES_SOCIALES", label: "Redes Sociales" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nuevo Pedido</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Selection */}
        <Card className="p-6 space-y-4">
          <CardTitle>Cliente</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <Dialog open={showNewClient} onOpenChange={setShowNewClient}>
              <DialogTrigger asChild>
                <Button variant="outline" type="button">+ Nuevo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Nombre *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Teléfono"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                  <Button type="button" onClick={handleCreateClient} disabled={!newClientName}>
                    Crear Cliente
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  clientId === c.id
                    ? "bg-slate-900 text-white"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="font-medium">{c.name}</div>
                {c.phone && <div className="text-xs opacity-70">{c.phone}</div>}
              </button>
            ))}
          </div>
        </Card>

        {/* Color & Liters */}
        <Card className="p-6 space-y-4">
          <CardTitle>Color y Cantidad</CardTitle>

          <div className="space-y-2">
            <label className="text-sm font-medium">Grupo de Color</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setColorGroupId(g.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                    colorGroupId === g.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 hover:border-slate-400 dark:border-slate-700"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre del Color</label>
            <Input
              placeholder="Ej: Azul Cielo, Rojo Ferrari..."
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Litros</label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={liters}
              onChange={(e) => setLiters(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          {/* Price Preview */}
          {preview && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-4 mt-2">
              <div className="flex justify-between text-sm">
                <span>Precio por litro:</span>
                <span className="font-medium">{formatCurrency(preview.pricePerLiter)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-1">
                <span>Total:</span>
                <span className="text-green-600">{formatCurrency(preview.totalPrice)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Source & Notes */}
        <Card className="p-6 space-y-4">
          <CardTitle>Detalles</CardTitle>

          <div className="space-y-2">
            <label className="text-sm font-medium">Canal</label>
            <div className="flex gap-2 flex-wrap">
              {sources.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    source === s.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notas</label>
            <textarea
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              rows={3}
              placeholder="Notas adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Card>

        <Button
          type="submit"
          className="w-full h-12 text-lg"
          disabled={loading || !clientId || !colorGroupId || !colorName || !liters}
        >
          {loading ? "Creando..." : "Crear Pedido"}
        </Button>
      </form>
    </div>
  );
}
