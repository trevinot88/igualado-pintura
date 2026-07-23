/**
 * Servicio de WhatsApp usando @whiskeysockets/baileys.
 *
 * Sustituye la integración anterior con GREEN-API. Mantiene una única
 * conexión (singleton) persistente con reconexión automática y expone
 * métodos para:
 *  - Obtener el código QR (Data URL) para vincular el dispositivo.
 *  - Consultar el estado de la conexión.
 *  - Enviar mensajes de texto nativos vía Baileys.
 *  - Recibir mensajes entrantes (messages.upsert) listos para conectar
 *    a un pipeline de IA futuro.
 *
 * La sesión se persiste en PostgreSQL con `usePrismaAuthState` para
 * sobrevivir a redeploys en entornos con sistema de archivos efímero
 * (como Render).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { WhatsAppStatus } from "@/lib/whatsapp-types";

// ─── Estado interno del singleton ──────────────────────────────

let sock: any = null;
let currentQr: string | null = null;
let connectionState: "connecting" | "open" | "close" = "close";
let lastError: string | null = null;
let connectPromise: Promise<void> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// ─── Importación dinámica de Baileys ───────────────────────────

/**
 * Baileys usa APIs de Node.js que no deben ser empaquetadas por el
 * bundler de Next.js. Lo importamos dinámicamente para que solo se
 * cargue en el servidor.
 */
async function importBaileys(): Promise<any> {
  const baileys = await import("@whiskeysockets/baileys");
  return baileys;
}

// ─── Pipeline de mensajes entrantes ────────────────────────────

/**
 * Procesa un mensaje entrante de WhatsApp.
 *
 * Este es el punto de entrada para conectar con un pipeline de IA
 * futuro (clasificación de intención, extracción de datos, etc.).
 * Por ahora solo registra el mensaje en consola.
 *
 * La estructura de datos intenta mantener compatibilidad con el
 * payload que enviaba GREEN-API en su webhook.
 */
async function handleIncomingMessage(msg: any): Promise<void> {
  try {
    const jid: string = msg?.key?.remoteJid ?? "";
    const fromMe: boolean = msg?.key?.fromMe ?? false;

    // Extraer texto (mensaje normal o extendido/respuesta)
    const messageObj = msg?.message ?? {};
    let text: string | null = null;

    if (typeof messageObj.conversation === "string") {
      text = messageObj.conversation;
    } else if (
      messageObj.extendedTextMessage &&
      typeof messageObj.extendedTextMessage.text === "string"
    ) {
      text = messageObj.extendedTextMessage.text;
    }

    // Detectar si tiene adjuntos (audio, imagen, documento)
    const hasAudio = !!messageObj.audioMessage;
    const hasImage = !!messageObj.imageMessage;
    const hasDocument = !!messageObj.documentMessage;
    const hasVideo = !!messageObj.videoMessage;

    console.log(
      `[WhatsApp] Mensaje entrante de ${jid} (fromMe=${fromMe}): ` +
        `text="${text ? text.substring(0, 50) : "(sin texto)"}" ` +
        `audio=${hasAudio} image=${hasImage} doc=${hasDocument} video=${hasVideo}`
    );

    // TODO: Conectar aquí con el pipeline de IA cuando se implemente.
    // El objeto `msg` mantiene la misma estructura que el payload de
    // GREEN-API para facilitar la migración del handler existente.
  } catch (error) {
    console.error("[WhatsApp] Error procesando mensaje entrante:", error);
  }
}

// ─── Conexión del socket ───────────────────────────────────────

/**
 * Inicializa (o reinicia) la conexión de Baileys.
 * Es idempotente: si ya hay una conexión en progreso, espera a que
 * termine en lugar de crear una duplicada.
 */
export function connectWhatsApp(): Promise<void> {
  if (connectionState === "open" || connectionState === "connecting") {
    return connectPromise ?? Promise.resolve();
  }
  if (!connectPromise) {
    connectPromise = startConnection().finally(() => {
      connectPromise = null;
    });
  }
  return connectPromise;
}

async function startConnection(): Promise<void> {
  try {
    const baileys = await importBaileys();
    const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

    // Ruta absoluta para persistencia de credenciales
    const path = await import("path");
    const fs = await import("fs");
    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Crear socket
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // generamos el QR nosotros vía API
      browser: ["Pinturas Dyrlo", "Chrome", "1.0.0"],
    });

    // ── Guardar credenciales cuando se actualicen ──
    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
      } catch (err) {
        console.error("[WhatsApp] Error guardando credenciales:", err);
      }
    });

    // ── Manejar actualizaciones de conexión ──
    sock.ev.on(
      "connection.update",
      (update: any) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          currentQr = qr;
          console.log("[WhatsApp] QR generado — esperando escaneo");
        }

        if (connection === "open") {
          connectionState = "open";
          currentQr = null;
          reconnectAttempts = 0;
          lastError = null;
          const user = sock?.user;
          console.log(
            `[WhatsApp] Conexión abierta${user ? ` como ${user.id}` : ""}`
          );
        }

        if (connection === "close") {
          connectionState = "close";
          sock = null;

          const statusCode = lastDisconnect?.output?.statusCode;
          const reason = lastDisconnect?.error?.message ?? "desconocido";

          // loggedOut = sesión invalidada, necesita reescanear QR
          if (statusCode === DisconnectReason.loggedOut) {
            lastError = `Sesión cerrada (${statusCode}): ${reason}. Reescanear QR.`;
            console.error(`[WhatsApp] ${lastError}`);
            // Limpiar credenciales para forzar nuevo QR
            clearAuthState();
            // Reintentar conexión (generará nuevo QR)
            scheduleReconnect();
            return;
          }

          // Otros motivos: reconectar automáticamente
          lastError = `Conexión cerrada (${statusCode ?? "?"}): ${reason}`;
          console.warn(`[WhatsApp] ${lastError}`);
          scheduleReconnect();
        }
      }
    );

    // ── Recibir mensajes entrantes ──
    sock.ev.on("messages.upsert", (m: any) => {
      if (m.type !== "notify") return; // solo mensajes nuevos
      for (const msg of m.messages) {
        handleIncomingMessage(msg).catch((err: unknown) =>
          console.error("[WhatsApp] Error en handler de mensaje:", err)
        );
      }
    });

    connectionState = "connecting";
  } catch (error) {
    connectionState = "close";
    lastError = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] Error iniciando conexión:", error);
    scheduleReconnect();
  }
}

/**
 * Programa una reconexión con backoff exponencial.
 */
function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `[WhatsApp] Máximo de reintentos (${MAX_RECONNECT_ATTEMPTS}) alcanzado. ` +
        "Se requiere reinicio manual."
    );
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 60000); // máx 60s
  console.log(
    `[WhatsApp] Reintentando conexión en ${delay}ms (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
  );

  setTimeout(() => {
    connectPromise = null; // permitir nueva conexión
    connectWhatsApp().catch((err) =>
      console.error("[WhatsApp] Error en reconexión programada:", err)
    );
  }, delay);
}

/**
 * Elimina las credenciales persistidas (cuando la sesión se invalida).
 */
async function clearAuthState(): Promise<void> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const authFolder = path.join(process.cwd(), "auth_info_baileys");
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log("[WhatsApp] Credenciales eliminadas — se generará nuevo QR");
    }
  } catch (err) {
    console.error("[WhatsApp] Error limpiando credenciales:", err);
  }
}

// ─── API pública del servicio ──────────────────────────────────

/**
 * Devuelve el estado actual de la conexión de WhatsApp.
 */
export function getWhatsAppStatus(): WhatsAppStatus {
  return {
    configured: true, // Baileys no requiere configuración previa de instancia
    connected: connectionState === "open",
    authorized: connectionState === "open",
    hasQr: currentQr !== null,
    qr: currentQr,
    user: sock?.user?.id ?? null,
    error: lastError ?? undefined,
  };
}

/**
 * Devuelve el código QR actual como string (el contenido del QR,
 * no la imagen). El endpoint /api/whatsapp/qr lo convierte a Data URL.
 *
 * Inicia la conexión automáticamente si no hay socket activo.
 */
export async function getWhatsAppQR(): Promise<{
  qr: string | null;
  dataUrl: string | null;
}> {
  // Si ya está conectado, no hay QR
  if (connectionState === "open") {
    return { qr: null, dataUrl: null };
  }

  // Asegurar que la conexión está iniciada (generará un QR)
  if (connectionState === "close") {
    void connectWhatsApp().catch((err) =>
      console.error("[WhatsApp] Error iniciando conexión para QR:", err)
    );
  }

  // Si ya tenemos un QR, generar Data URL
  if (currentQr) {
    const dataUrl = await generateQrDataUrl(currentQr);
    return { qr: currentQr, dataUrl };
  }

  // QR aún no disponible (conexión en progreso)
  return { qr: null, dataUrl: null };
}

/**
 * Genera un código QR como Data URL (image/png en base64) usando la
 * librería `qrcode`.
 */
async function generateQrDataUrl(qrString: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(qrString, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Normaliza un número de teléfono al formato JID de WhatsApp.
 * Acepta: +52 123..., 52123..., 10 dígitos locales MX
 */
function formatPhoneToJid(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "521" + digits;
  } else if (digits.startsWith("52") && digits.length === 12) {
    digits = "521" + digits.slice(2);
  }
  return `${digits}@s.whatsapp.net`;
}

/**
 * Envía un mensaje de texto por WhatsApp usando Baileys.
 * Inicia la conexión automáticamente si no está activa.
 *
 * @returns objeto con `success`, `jid` y opcionalmente `error`
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; jid: string; error?: string }> {
  const jid = formatPhoneToJid(phone);

  // Asegurar conexión activa
  if (connectionState !== "open") {
    await connectWhatsApp();
  }

  if (connectionState !== "open" || !sock) {
    return {
      success: false,
      jid,
      error: "WhatsApp no está conectado. Escanea el código QR primero.",
    };
  }

  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] Mensaje enviado a ${jid}`);
    return { success: true, jid };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[WhatsApp] Error enviando mensaje a ${jid}:`, msg);
    return { success: false, jid, error: msg };
  }
}

/**
 * Cierra la conexión de WhatsApp limpiamente.
 */
export function disconnectWhatsApp(): void {
  if (sock) {
    try {
      sock.end("disconnect requested");
    } catch {
      // ignore
    }
    sock = null;
  }
  connectionState = "close";
  currentQr = null;
}

// ─── Inicialización automática en producción ───────────────────

/**
 * Inicia la conexión de WhatsApp automáticamente cuando el módulo se
 * carga por primera vez en el servidor. En desarrollo se puede
 * iniciar on-demand desde el endpoint de QR.
 */
if (process.env.NODE_ENV === "production") {
  // Pequeño delay para no bloquear el arranque del servidor
  setTimeout(() => {
    connectWhatsApp().catch((err) =>
      console.error("[WhatsApp] Error en auto-inicio:", err)
    );
  }, 3000);
}