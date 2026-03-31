"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  STATUS_CHANGED: "bg-purple-100 text-purple-800",
  QUEUE_REORDERED: "bg-orange-100 text-orange-800",
  LOGIN: "bg-gray-100 text-gray-800",
  EMAIL_SENT: "bg-cyan-100 text-cyan-800",
  LABEL_PRINTED: "bg-yellow-100 text-yellow-800",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  function fetchLogs() {
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    params.set("limit", "200");
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  const entities = ["", "Order", "Client", "ColorGroup", "User", "Payment"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Auditoría</h1>

      <div className="flex gap-2 flex-wrap">
        {entities.map((e) => (
          <button
            key={e}
            onClick={() => setEntityFilter(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              entityFilter === e
                ? "bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {e || "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-8 text-slate-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Usuario</th>
                <th className="text-left px-4 py-3 font-medium">Acción</th>
                <th className="text-left px-4 py-3 font-medium">Entidad</th>
                <th className="text-left px-4 py-3 font-medium">Cambios</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user?.name || <span className="text-slate-400">Sistema</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"}>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{log.entity}</span>
                    {log.entityId && (
                      <span className="text-xs text-slate-400 ml-1">{log.entityId.slice(0, 8)}...</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {log.changes ? (
                      <pre className="text-xs text-slate-500 whitespace-pre-wrap truncate max-h-20 overflow-hidden">
                        {JSON.stringify(log.changes, null, 1)}
                      </pre>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Sin registros de auditoría
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
