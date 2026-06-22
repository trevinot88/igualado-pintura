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
import { Plus, Edit2, Trash2, User, ToggleLeft, ToggleRight } from "lucide-react";
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

/** 🆕 Tipo para el catálogo de operadores físicos */
interface OperadorFisico {
  id: string;
  nombre: string;
  activo: boolean;
  creadoAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  FACTURACION: "bg-purple-100 text-purple-800",
  VENDEDOR_READONLY: "bg-blue-100 text-blue-800",
  IGUALADOR: "bg-green-100 text-green-800",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [operadores, setOperadores] = useState<OperadorFisico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // 🆕 Estados para CRUD de operadores físicos
  const [showOperadorForm, setShowOperadorForm] = useState(false);
  const [editingOperadorId, setEditingOperadorId] = useState<string | null>(null);
  const [operadorNombre, setOperadorNombre] = useState("");

  // Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("FACTURACION");

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/usuarios?all=${showAll}&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Error cargando usuarios (${res.status})`);
        setUsers([]);
        return;
      }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("Error de red al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  /** 🆕 Carga el catálogo de operadores físicos */
  async function fetchOperadores() {
    try {
      const res = await fetch(`/api/igualadores?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setOperadores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleUserActive(user: User) {
    const res = await fetch(`/api/usuarios/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ active: !user.active }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || `Error al ${user.active ? "desactivar" : "activar"} usuario`);
      return;
    }
    await fetchUsers();
  }

  useEffect(() => {
    fetchUsers();
    fetchOperadores();
  }, [showAll]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("FACTURACION");
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
      const res = await fetch(`/api/usuarios/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al actualizar usuario");
        return;
      }
    } else {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al crear usuario");
        return;
      }
    }
    setShowForm(false);
    await fetchUsers();
  }

  async function handleHardDelete(user: User) {
    if (!confirm(`¿Eliminar definitivamente a "${user.name}" (${user.email})?\n\nEsta acción es irreversible. Las órdenes asociadas serán reasignadas al admin.`)) return;
    const res = await fetch(`/api/usuarios/${user.id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Error al eliminar usuario");
      return;
    }
    await fetchUsers();
  }

  // ─── CRUD de Operadores Físicos ───────────────────────────

  function openCreateOperador() {
    setEditingOperadorId(null);
    setOperadorNombre("");
    setShowOperadorForm(true);
  }

  function openEditOperador(op: OperadorFisico) {
    setEditingOperadorId(op.id);
    setOperadorNombre(op.nombre);
    setShowOperadorForm(true);
  }

  async function handleSaveOperador() {
    if (!operadorNombre.trim()) return;

    if (editingOperadorId) {
      const res = await fetch(`/api/igualadores/${editingOperadorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ nombre: operadorNombre.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al editar igualador");
        return;
      }
    } else {
      const res = await fetch("/api/igualadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ nombre: operadorNombre.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al crear igualador");
        return;
      }
    }

    setShowOperadorForm(false);
    setOperadorNombre("");
    setEditingOperadorId(null);
    await fetchOperadores();
  }

  async function handleToggleOperadorActivo(op: OperadorFisico) {
    const res = await fetch(`/api/igualadores/${op.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ activo: !op.activo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error al cambiar estado del igualador");
      return;
    }
    await fetchOperadores();
  }

  return (
    <div className="space-y-8">
      {/* ── SECCIÓN: Usuarios del Sistema ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                showAll
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-slate-300 text-slate-600 hover:border-slate-500"
              }`}
            >
              {showAll ? "Todos" : "Solo Activos"}
            </button>
          </div>
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
                    <option value="FACTURACION">Facturación</option>
                    <option value="IGUALADOR">Igualador</option>
                    <option value="VENDEDOR_READONLY">Vendedor (Solo Lectura)</option>
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
                  <tr
                    key={user.id}
                    className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      !user.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        {!user.active && (
                          <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Inactivo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge className={ROLE_COLORS[user.role] || ""}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{user.location?.name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Editar">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserActive(user)}
                          className={user.active ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-800"}
                        >
                          {user.active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleHardDelete(user)}
                          className="text-red-500 hover:text-red-700"
                          title="Eliminar definitivamente"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* ── 🆕 SECCIÓN: Catálogo de Igualadores Físicos ── */}
      <div className="border-t pt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold">Catálogo de Igualadores Físicos</h2>
          </div>
          <Dialog open={showOperadorForm} onOpenChange={setShowOperadorForm}>
            <DialogTrigger asChild>
              <Button onClick={openCreateOperador}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Igualador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingOperadorId ? "Editar Igualador Físico" : "Nuevo Igualador Físico"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre Completo *</label>
                  <Input
                    value={operadorNombre}
                    onChange={(e) => setOperadorNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <Button
                  onClick={handleSaveOperador}
                  disabled={!operadorNombre.trim()}
                  className="w-full"
                >
                  {editingOperadorId ? "Guardar Cambios" : "Crear Igualador"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Registro de las personas físicas que operan en el taller.
          Solo los igualadores <strong>activos</strong> aparecerán en el selector
          "¿Quién está procesando este pedido?" de la pantalla de Producción.
        </p>

        <div className="overflow-x-auto bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Creado</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {operadores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    No hay igualadores físicos registrados. Crea el primero usando el botón "Agregar Igualador".
                  </td>
                </tr>
              ) : (
                operadores.map((op) => (
                  <tr
                    key={op.id}
                    className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      !op.activo ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{op.nombre}</span>
                      {!op.activo && (
                        <span className="ml-2 text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleOperadorActivo(op)}
                        className={`inline-flex items-center gap-1 text-sm font-medium ${
                          op.activo
                            ? "text-green-600 hover:text-green-800"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                        title={op.activo ? "Desactivar (soft delete)" : "Activar"}
                      >
                        {op.activo ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                        {op.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(op.creadoAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditOperador(op)}
                        title="Editar nombre"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
