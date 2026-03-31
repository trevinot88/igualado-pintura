"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface PriceTier {
  id: string;
  minLiters: number;
  maxLiters: number;
  pricePerLiter: number;
}

interface ColorGroup {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  priceTiers: PriceTier[];
}

export default function PreciosPage() {
  const [groups, setGroups] = useState<ColorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  // New group form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Tier editing
  const [editTiers, setEditTiers] = useState<{ minLiters: number; maxLiters: number; pricePerLiter: number }[]>([]);

  function fetchGroups() {
    fetch("/api/precios")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateGroup() {
    await fetch("/api/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        description: newDesc || undefined,
        tiers: [
          { minLiters: 0.5, maxLiters: 3.99, pricePerLiter: 200 },
          { minLiters: 4, maxLiters: 9.99, pricePerLiter: 180 },
          { minLiters: 10, maxLiters: 19.99, pricePerLiter: 160 },
          { minLiters: 20, maxLiters: 999, pricePerLiter: 140 },
        ],
      }),
    });
    setShowNewGroup(false);
    setNewName("");
    setNewDesc("");
    fetchGroups();
  }

  function startEditTiers(group: ColorGroup) {
    setEditingGroup(group.id);
    setEditTiers(group.priceTiers.map((t) => ({
      minLiters: t.minLiters,
      maxLiters: t.maxLiters,
      pricePerLiter: t.pricePerLiter,
    })));
  }

  async function saveTiers(groupId: string) {
    await fetch(`/api/precios/${groupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiers: editTiers }),
    });
    setEditingGroup(null);
    fetchGroups();
  }

  function updateTier(index: number, field: string, value: number) {
    setEditTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function addTier() {
    const last = editTiers[editTiers.length - 1];
    setEditTiers([...editTiers, {
      minLiters: last ? last.maxLiters + 0.01 : 0.5,
      maxLiters: last ? last.maxLiters + 10 : 3.99,
      pricePerLiter: last ? last.pricePerLiter : 100,
    }]);
  }

  function removeTier(index: number) {
    setEditTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("¿Eliminar este grupo de color?")) return;
    await fetch(`/api/precios/${id}`, { method: "DELETE" });
    fetchGroups();
  }

  if (loading) return <div className="p-8 text-center">Cargando precios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grupos de Color y Precios</h1>
        <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nuevo Grupo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Grupo de Color</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nombre *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Pasteles" />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Tonos suaves..." />
              </div>
              <p className="text-xs text-slate-500">Se crearán 4 rangos de precios por defecto que podrás editar después.</p>
              <Button onClick={handleCreateGroup} disabled={!newName} className="w-full">Crear Grupo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.id} className="overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              onClick={() => toggleExpand(group.id)}
            >
              <div>
                <h3 className="font-semibold text-lg">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-slate-500">{group.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{group.priceTiers.length} rangos</span>
                {expanded.has(group.id) ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
            </button>

            {expanded.has(group.id) && (
              <div className="border-t border-slate-200 dark:border-slate-800 p-4">
                {editingGroup === group.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-500">
                      <span>Min Litros</span>
                      <span>Max Litros</span>
                      <span>Precio/Litro</span>
                      <span></span>
                    </div>
                    {editTiers.map((tier, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={tier.minLiters}
                          onChange={(e) => updateTier(i, "minLiters", parseFloat(e.target.value))}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={tier.maxLiters}
                          onChange={(e) => updateTier(i, "maxLiters", parseFloat(e.target.value))}
                        />
                        <Input
                          type="number"
                          step="1"
                          value={tier.pricePerLiter}
                          onChange={(e) => updateTier(i, "pricePerLiter", parseFloat(e.target.value))}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeTier(i)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={addTier}>
                        <Plus className="h-4 w-4 mr-1" /> Agregar Rango
                      </Button>
                      <div className="flex-1" />
                      <Button variant="outline" size="sm" onClick={() => setEditingGroup(null)}>Cancelar</Button>
                      <Button size="sm" onClick={() => saveTiers(group.id)}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="py-2">Rango (Litros)</th>
                          <th className="py-2">Precio/Litro</th>
                          <th className="py-2">Ejemplo (4L)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.priceTiers.map((tier) => (
                          <tr key={tier.id} className="border-b border-slate-100">
                            <td className="py-2">{tier.minLiters}L — {tier.maxLiters}L</td>
                            <td className="py-2 font-medium">{formatCurrency(tier.pricePerLiter)}</td>
                            <td className="py-2 text-slate-500">
                              {4 >= tier.minLiters && 4 <= tier.maxLiters
                                ? formatCurrency(tier.pricePerLiter * 4)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => startEditTiers(group)}>
                        Editar Precios
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 className="h-4 w-4 text-red-500 mr-1" /> Eliminar
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
