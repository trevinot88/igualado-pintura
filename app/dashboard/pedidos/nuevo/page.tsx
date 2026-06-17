"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { IgualacionLineCombobox } from "@/components/igualacion-line-combobox";
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
}

interface Seller {
  id: string;
  name: string;
  role: "ADMIN" | "VENDEDOR_READONLY";
  email: string;
}

interface VendedorFisico {
  id: string;
  nombre: string;
  activo: boolean;
}

interface IgualacionLine {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface OrderItem {
  id: string; // temp ID for React keys
  igualacionLineId: string;
  colorName: string;
  liters: number;
}

export default function NuevoPedidoPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<ColorGroup[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [vendedoresFisicos, setVendedoresFisicos] = useState<VendedorFisico[]>([]);
  const [lines, setLines] = useState<IgualacionLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);

  // Shared form data
  const [clientId, setClientId] = useState("");
  const [colorGroupId, setColorGroupId] = useState("");
  const [source, setSource] = useState("MOSTRADOR");
  const [sellerId, setSellerId] = useState("");
  const [notes, setNotes] = useState("");

  // Order items (multiple products)
  const [items, setItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), igualacionLineId: "", colorName: "", liters: 1 },
  ]);

  // New client form
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then(setClients);
    fetch("/api/color-groups?active=true").then((r) => r.json()).then(setGroups);
    fetch("/api/igualacion-lines?active=true").then((r) => r.json()).then(setLines);
    fetch("/api/usuarios/sellers").then((r) => r.json()).then(setSellers);
  }, []);

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

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), igualacionLineId: "", colorName: "", liters: 1 },
    ]);
  }

  function removeItem(id: string) {
    if (items.length === 1) return; // Keep at least one item
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: keyof OrderItem, value: any) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function selectIgualacionLine(itemId: string, lineId: string) {
    const selectedLine = lines.find((l) => l.id === lineId);
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              igualacionLineId: lineId,
              colorName: selectedLine?.description || "",
            }
          : item
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Create multiple orders (one per item)
      const promises = items.map((item) =>
        fetch("/api/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            colorGroupId,
            igualacionLineId: item.igualacionLineId || undefined,
            colorName: item.colorName,
            liters: item.liters,
            source,
            sellerId: source === "VENTAS" ? sellerId : undefined,
            notes,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const allSuccess = responses.every((r) => r.ok);

      if (allSuccess) {
        router.push("/dashboard/pedidos");
      } else {
        const firstError = responses.find((r) => !r.ok);
        const err = await firstError?.json();
        alert(err?.error || "Error al crear pedidos");
        setLoading(false);
      }
    } catch (error) {
      alert("Error al crear pedidos");
      setLoading(false);
    }
  }

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const sources = [
    { value: "MOSTRADOR", label: "Mostrador" },
    { value: "VENTAS", label: "Ventas" },
    { value: "REDES_SOCIALES", label: "Redes Sociales" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
                <Button variant="outline" type="button">
                  + Nuevo
                </Button>
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
                  <Button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={!newClientName}
                  >
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

        {/* Color Group */}
        <Card className="p-6 space-y-4">
          <CardTitle>Grupo de Color</CardTitle>
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
        </Card>

        {/* Products List */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>Productos ({items.length})</CardTitle>
            <Button type="button" variant="outline" onClick={addItem}>
              + Agregar Producto
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="p-4 border border-slate-200 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">
                    Producto #{index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Línea de Igualación</label>
                  <IgualacionLineCombobox
                    lines={lines}
                    value={item.igualacionLineId}
                    onChange={(lineId) => selectIgualacionLine(item.id, lineId)}
                    placeholder="Buscar por código o descripción..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del Color</label>
                  <Input
                    placeholder="Ej: BIKAPA CROMACRYL ORG. APERLADO 1L"
                    value={item.colorName}
                    onChange={(e) =>
                      updateItem(item.id, "colorName", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Litros</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={item.liters}
                    onChange={(e) =>
                      updateItem(item.id, "liters", parseFloat(e.target.value) || 0)
                    }
                    required
                  />
                </div>
              </div>
            ))}
          </div>
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
                  onClick={() => {
                    setSource(s.value);
                    if (s.value !== "VENTAS") setSellerId("");
                  }}
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

          {source === "VENTAS" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendedor *</label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                required
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
          disabled={
            loading ||
            !clientId ||
            !colorGroupId ||
            (source === "VENTAS" && !sellerId) ||
            items.some((item) => !item.colorName || !item.liters)
          }
        >
          {loading
            ? "Creando..."
            : `Crear ${items.length} Pedido${items.length > 1 ? "s" : ""}`}
        </Button>
      </form>
    </div>
  );
}
