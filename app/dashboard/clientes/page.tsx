"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Plus, Edit2, Trash2 } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  allowCredit: boolean;
  createdAt: string;
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [allowCredit, setAllowCredit] = useState(false);

  function fetchClients() {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/clientes${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setNotes("");
    setAllowCredit(false);
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setName(client.name);
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setCompany(client.company || "");
    setNotes(client.notes || "");
    setAllowCredit(client.allowCredit);
    setShowForm(true);
  }

  async function handleSubmit() {
    const body = { name, email: email || undefined, phone: phone || undefined, company: company || undefined, notes: notes || undefined, allowCredit };

    if (editing) {
      await fetch(`/api/clientes/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setShowForm(false);
    fetchClients();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    fetchClients();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nombre *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
              </div>
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre empresa" />
              </div>
              <div>
                <label className="text-sm font-medium">Notas</label>
                <textarea
                  className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowCredit"
                  checked={allowCredit}
                  onChange={(e) => setAllowCredit(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="allowCredit" className="text-sm">Permitir crédito/fiado</label>
              </div>
              <Button onClick={handleSubmit} disabled={!name} className="w-full">
                {editing ? "Guardar Cambios" : "Crear Cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
        <Input
          placeholder="Buscar por nombre, email, teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="text-center py-8 text-slate-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium">Empresa</th>
                <th className="text-left px-4 py-3 font-medium">Crédito</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-slate-500">{client.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{client.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{client.company || "—"}</td>
                  <td className="px-4 py-3">
                    {client.allowCredit && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                        Sí
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No se encontraron clientes
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
