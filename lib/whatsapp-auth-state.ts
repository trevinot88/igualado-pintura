/**
 * Adapter de autenticación de Baileys usando Prisma (PostgreSQL).
 *
 * Reemplaza `useMultiFileAuthState` para que las credenciales de la
 * sesión de WhatsApp sobrevivan a redeploys en entornos con sistema
 * de archivos efímero (como Render).
 *
 * Baileys necesita dos cosas:
 *  1. `creds` — objeto AuthenticationCreds (datos de la sesión)
 *  2. `keys` — SignalKeyStore (claves criptográficas: preKeys,
 *     senderKeys, appStateKeys, etc.)
 *
 * Ambos se persisten en las tablas `WhatsAppSession` y `WhatsAppKey`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "./prisma";

// ─── Tipos mínimos de Baileys ──────────────────────────────────

interface AuthenticationCreds {
  registered: boolean;
  [key: string]: any;
}

interface SignalKeyStore {
  get<T = any>(type: string, ids: string[]): Promise<{ [id: string]: T | undefined }>;
  set(data: { [type: string]: { [id: string]: any } }): Promise<void>;
  clearAll?(): Promise<void>;
}

// ─── Helper: retraso no bloqueante ─────────────────────────────

/**
 * Ejecuta una promesa sin bloquear el flujo principal.
 * Útil para escrituras que no necesitan await (fire-and-forget).
 */
function fireAndForget(promise: Promise<unknown>, label: string): void {
  promise.catch((err) => console.error(`[WhatsApp-Auth] ${label}:`, err));
}

// ─── Estado de autenticación basado en Prisma ──────────────────

/**
 * Crea un estado de autenticación para Baileys persistido en PostgreSQL.
 *
 * @returns `{ state, saveCreds }` con la misma interfaz que
 *          `useMultiFileAuthState`.
 */
export async function usePrismaAuthState(): Promise<{
  state: { creds: AuthenticationCreds; keys: SignalKeyStore };
  saveCreds: () => Promise<void>;
  clearAuthState: () => Promise<void>;
}> {
  // ── Cargar credenciales desde la BD ──
  let creds: AuthenticationCreds;

  try {
    const row = await prisma.whatsAppSession.findUnique({
      where: { id: "singleton" },
    });
    if (row?.creds) {
      creds = row.creds as unknown as AuthenticationCreds;
      console.log("[WhatsApp-Auth] Sesión cargada desde PostgreSQL");
    } else {
      // Sin sesión previa — usar credenciales vacías
      // Baileys generará unas nuevas al conectar
      creds = { registered: false } as AuthenticationCreds;
      console.log("[WhatsApp-Auth] Sin sesión previa — se generará nuevo QR");
    }
  } catch (err) {
    console.error("[WhatsApp-Auth] Error cargando sesión, usando vacía:", err);
    creds = { registered: false } as AuthenticationCreds;
  }

  // ── Implementación de SignalKeyStore con Prisma ──
  const keys: SignalKeyStore = {
    /**
     * Obtiene múltiples claves por tipo e IDs en una sola consulta.
     */
    async get<T = any>(type: string, ids: string[]): Promise<{ [id: string]: T | undefined }> {
      const result: { [id: string]: T | undefined } = {};
      if (ids.length === 0) return result;

      try {
        const rows = await prisma.whatsAppKey.findMany({
          where: {
            type,
            keyId: { in: ids },
          },
          select: { keyId: true, data: true },
        });
        for (const row of rows) {
          result[row.keyId] = row.data as T;
        }
      } catch (err) {
        console.error(`[WhatsApp-Auth] Error leyendo claves tipo "${type}":`, err);
      }
      return result;
    },

    /**
     * Guarda múltiples claves agrupadas por tipo.
     * Usa upsert para insertar o actualizar según corresponda.
     */
    async set(data: { [type: string]: { [id: string]: any } }): Promise<void> {
      const operations: Promise<unknown>[] = [];

      for (const [type, entries] of Object.entries(data)) {
        for (const [id, value] of Object.entries(entries)) {
          operations.push(
            prisma.whatsAppKey.upsert({
              where: { type_keyId: { type, keyId: id } },
              create: { type, keyId: id, data: value as any },
              update: { data: value as any },
            })
          );
        }
      }

      if (operations.length > 0) {
        try {
          await Promise.all(operations);
        } catch (err) {
          console.error("[WhatsApp-Auth] Error guardando claves:", err);
        }
      }
    },

    /**
     * Elimina todas las claves (usado al invalidar sesión).
     */
    async clearAll(): Promise<void> {
      try {
        await prisma.whatsAppKey.deleteMany({});
        console.log("[WhatsApp-Auth] Todas las claves eliminadas");
      } catch (err) {
        console.error("[WhatsApp-Auth] Error eliminando claves:", err);
      }
    },
  };

  // ── Función para guardar credenciales ──
  let saveInProgress = false;
  let pendingSave = false;

  const saveCreds = async (): Promise<void> => {
    // Si ya hay un guardado en progreso, marcar para re-guardar después
    if (saveInProgress) {
      pendingSave = true;
      return;
    }

    saveInProgress = true;
    try {
      await prisma.whatsAppSession.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", creds: creds as any },
        update: { creds: creds as any },
      });
    } catch (err) {
      console.error("[WhatsApp-Auth] Error guardando credenciales:", err);
    } finally {
      saveInProgress = false;
      if (pendingSave) {
        pendingSave = false;
        // Re-guardar sin await para no bloquear
        fireAndForget(saveCreds(), "re-guardado pendiente");
      }
    }
  };

  // ── Función para limpiar todo (logout) ──
  const clearAuthState = async (): Promise<void> => {
    try {
      await prisma.whatsAppSession.deleteMany({});
      await prisma.whatsAppKey.deleteMany({});
      console.log("[WhatsApp-Auth] Sesión y claves eliminadas de PostgreSQL");
    } catch (err) {
      console.error("[WhatsApp-Auth] Error limpiando estado de auth:", err);
    }
  };

  return {
    state: { creds, keys },
    saveCreds,
    clearAuthState,
  };
}