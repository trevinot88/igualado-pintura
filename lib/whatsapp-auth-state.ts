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

// ─── Serialización de Buffers (BufferJSON) ─────────────────────

/**
 * Baileys guarda sus credenciales/claves con `BufferJSON` para que los
 * Buffer/Uint8Array sobrevivan al JSON. Sin esto, al guardar en PostgreSQL
 * las claves quedan como string/objeto plano y al recargar falla con:
 * "Invalid private key type: String".
 */
let bufferJSONPromise: Promise<any> | null = null;

function getBufferJSON(): Promise<any> {
  if (!bufferJSONPromise) {
    bufferJSONPromise = import("@whiskeysockets/baileys").then(
      (baileys) => baileys.BufferJSON
    );
  }
  return bufferJSONPromise;
}

async function serializeWithBufferJSON(value: unknown): Promise<unknown> {
  const { replacer } = await getBufferJSON();
  return JSON.parse(JSON.stringify(value, replacer));
}

async function deserializeWithBufferJSON(value: unknown): Promise<unknown> {
  const { reviver } = await getBufferJSON();
  return JSON.parse(JSON.stringify(value), reviver);
}

function isBufferLike(value: unknown): boolean {
  return (
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array ||
    ArrayBuffer.isView(value)
  );
}

// ─── Estado de autenticación basado en Prisma ──────────────────

/**
 * Inicializa credenciales nuevas de Baileys usando `initAuthCreds()`.
 *
 * Baileys requiere un `noiseKey` y otros campos para poder generar el
 * QR. Si solo usamos `{ registered: false }`, al conectar falla con:
 * "Cannot read properties of undefined (reading 'public')".
 */
async function createInitialCreds(): Promise<AuthenticationCreds> {
  const baileys = await import("@whiskeysockets/baileys");
  return baileys.initAuthCreds() as AuthenticationCreds;
}

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
    // Solo reutilizar la sesión guardada si, tras revivir los Buffers,
    // tiene un noiseKey válido (con claves Buffer). De lo contrario
    // (sesión corrupta o inexistente), generar credenciales nuevas.
    const rawCreds = row?.creds as
      | { noiseKey?: { private?: unknown; public?: unknown } }
      | null
      | undefined;
    if (rawCreds?.noiseKey) {
      const revived = (await deserializeWithBufferJSON(
        rawCreds
      )) as AuthenticationCreds;
      const noiseKey = revived.noiseKey as {
        private?: unknown;
        public?: unknown;
      };
      if (isBufferLike(noiseKey?.private) && isBufferLike(noiseKey?.public)) {
        creds = revived;
        console.log("[WhatsApp-Auth] Sesión cargada desde PostgreSQL");
      } else {
        creds = await createInitialCreds();
        console.log(
          "[WhatsApp-Auth] Sesión guardada corrupta (noiseKey inválido) — credenciales reinicializadas"
        );
      }
    } else {
      creds = await createInitialCreds();
      console.log(
        "[WhatsApp-Auth] Sin sesión previa — credenciales inicializadas para nuevo QR"
      );
    }
  } catch (err) {
    console.error("[WhatsApp-Auth] Error cargando sesión, usando credenciales nuevas:", err);
    creds = await createInitialCreds();
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
          result[row.keyId] = (await deserializeWithBufferJSON(row.data)) as T;
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
            (async () => {
              const serialized = await serializeWithBufferJSON(value);
              return prisma.whatsAppKey.upsert({
                where: { type_keyId: { type, keyId: id } },
                create: { type, keyId: id, data: serialized as any },
                update: { data: serialized as any },
              });
            })()
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
      const serializedCreds = await serializeWithBufferJSON(creds);
      await prisma.whatsAppSession.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", creds: serializedCreds as any },
        update: { creds: serializedCreds as any },
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