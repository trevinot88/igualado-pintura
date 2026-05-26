"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface IgualacionLine {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  _count?: {
    orders: number;
  };
}

export default function CodigosIGPage() {
  const [lines, setLines] = useState<IgualacionLine[]>([]);
  const [filteredLines, setFilteredLines] = useState<IgualacionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [editingLine, setEditingLine] = useState<IgualacionLine | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Form state for editing
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSortOrder, setEditSortOrder] = useState(0);

  useEffect(() => {
    fetchLines();
  }, []);

  useEffect(() => {
    let result = lines;

    // Filter by active status
    if (showActiveOnly) {
      result = result.filter((line) => line.active);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (line) =>
          line.code.toLowerCase().includes(searchLower) ||
          line.name.toLowerCase().includes(searchLower) ||
          line.description?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLines(result);
  }, [lines, search, showActiveOnly]);

  async function fetchLines() {
    setLoading(true);
    try {
      const res = await fetch("/api/igualacion-lines");
      const data = await res.json();
      setLines(data);
      setFilteredLines(data);
    } catch (error) {
      console.error("Error fetching lines:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(line: IgualacionLine) {
    try {
      const res = await fetch(`/api/igualacion-lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !line.active }),
      });

      if (res.ok) {
        await fetchLines();
      } else {
        const err = await res.json();
        alert(err.error || "Error al actualizar");
      }
    } catch (error) {
      alert("Error al actualizar el código");
    }
  }

  function openEditDialog(line: IgualacionLine) {
    setEditingLine(line);
    setEditCode(line.code);
    setEditName(line.name);
    setEditDescription(line.description || "");
    setEditActive(line.active);
    setEditSortOrder(line.sortOrder);
    setShowEditDialog(true);
  }

  async function handleSaveEdit() {
    if (!editingLine) return;

    try {
      const res = await fetch(`/api/igualacion-lines/${editingLine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editCode,
          name: editName,
          description: editDescription || null,
          active: editActive,
          sortOrder: editSortOrder,
        }),
      });

      if (res.ok) {
        await fetchLines();
        setShowEditDialog(false);
        setEditingLine(null);
      } else {
        const err = await res.json();
        alert(err.error || "Error al actualizar");
      }
    } catch (error) {
      alert("Error al guardar cambios");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Códigos de Igualación</h1>
        <div className="text-sm text-slate-500">
          {filteredLines.length} de {lines.length} códigos
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por código o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button
              variant={showActiveOnly ? "default" : "outline"}
              onClick={() => setShowActiveOnly(!showActiveOnly)}
            >
              {showActiveOnly ? "Todos" : "Solo Activos"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">Cargando...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Orden
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900">
                        {line.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-slate-900">{line.name}</div>
                        {line.description && line.description !== line.name && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {line.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={line.active ? "default" : "secondary"}>
                        {line.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{line.sortOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(line)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant={line.active ? "secondary" : "default"}
                          onClick={() => toggleActive(line)}
                        >
                          {line.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLines.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No se encontraron códigos de igualación
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Código de Igualación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Código</label>
              <Input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="Ej: BCRYL100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre/Descripción</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ej: BIKAPA CROMACRYL REGULARES 20L"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción adicional</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Orden</label>
              <Input
                type="number"
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editActive"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="editActive" className="text-sm font-medium">
                Activo
              </label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} className="flex-1">
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
