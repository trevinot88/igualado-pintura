"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  locationId: string | null;
  location: { name: string } | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  VENDEDOR: "bg-blue-100 text-blue-800",
  IGUALADOR: "bg-green-100 text-green-800",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("VENDEDOR");

  function fetchUsers() {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function openCreate() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("VENDEDOR");
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditingId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (editingId) {
      const body: Record<string, unknown> = { name, role };
      if (password) body.password = password;
      await fetch(`/api/usuarios/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error al crear usuario");
        return;
      }
    }
    setShowForm(false);
    fetchUsers();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar este usuario?")) return;
    await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nombre *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
              </div>
              {!editingId && (
                <div>
                  <label className="text-sm font-medium">Email *</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dyrlo.com" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">{editingId ? "Nueva Contraseña (dejar vacío para mantener)" : "Contraseña *"}</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="text-sm font-medium">Rol</label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="IGUALADOR">Igualador</option>
                </select>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!name || (!editingId && (!email || !password))}
                className="w-full"
              >
                {editingId ? "Guardar Cambios" : "Crear Usuario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-left px-4 py-3 font-medium">Sucursal</th>
                <th className="text-left px-4 py-3 font-medium">Creado</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={ROLE_COLORS[user.role] || ""}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.location?.name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
