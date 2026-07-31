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
import { usePrismaAuthState } from "@/lib/whatsapp-auth-state";
import { prisma } from "@/lib/prisma";

// ─── Estado interno del singleton ──────────────────────────────

let sock: any = null;
let currentQr: string | null = null;
let connectionState: "connecting" | "open" | "close" = "close";
let lastError: string | null = null;
let connectPromise: Promise<void> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimer: NodeJS.Timeout | null = null;


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

// ─── Helpers de detección de estado real ───────────────────────

/**
 * Detección de la "conexión real" del socket de Baileys.
 *
 * La fuente de verdad es la instancia en memoria del socket, no un
 * flag en caché. Baileys expone el WebSocket subyacente en `sock.ws`;
 * `ws.readyState === WebSocket.OPEN (1)` es la señal más fiable de que
 * la conexión está realmente operativa.
 *
 * `sock.user` es el JID del número conectado y solo existe cuando la
 * sesión fue autenticada con éxito, así que también lo usamos como
 * señal de conexión real.
 */
function isSocketReallyOpen(socket: any): boolean {
  if (!socket) return false;

  // 1) El WebSocket subyacente está abierto (OPEN === 1)
  const wsState = socket?.ws?.readyState;
  if (typeof wsState === "number" && wsState === 1 /* WebSocket.OPEN */) {
    return true;
  }

  // 2) Fallback: usuario autenticado presente
  if (socket?.user?.id) {
    return true;
  }

  return false;
}

/**
 * Verifica si existen credenciales válidas guardadas en PostgreSQL.
 * Se usa para decidir si al reiniciar el servidor podemos reconectar
 * automáticamente o si realmente se necesita escanear un QR nuevo.
 */
export async function hasSavedCredentials(): Promise<boolean> {
  try {
    const row = await prisma.whatsAppSession.findUnique({
      where: { id: "singleton" },
    });
    const creds = row?.creds as
      | { registered?: boolean; me?: { id?: string } }
      | null
      | undefined;
    if (!creds) return false;
    // Sesión válida si está registrada o si ya hay un usuario vinculado
    // (`me.id` se llena tras escanear el QR con éxito).
    return creds.registered === true || !!creds.me?.id;
  } catch (err) {
    console.error("[WhatsApp] Error verificando credenciales guardadas:", err);
    return false;
  }
}


// ─── Conexión del socket ───────────────────────────────────────

/**
 * Inicializa (o reinicia) la conexión de Baileys.
 * Es idempotente: si ya hay una conexión en progreso, espera a que
 * termine en lugar de crear una duplicada.
 */
export function connectWhatsApp(): Promise<void> {
  // Fuente de verdad: el socket real. Si ya está realmente abierto, no
  // hacer nada. NO usamos el flag `connectionState === "open"` porque
  // podría estar desincronizado (era la causa del bug original).
  if (isSocketReallyOpen(sock)) {
    return Promise.resolve();
  }

  // Si ya hay una conexión en progreso, esperar a que termine
  if (connectPromise) {
    return connectPromise;
  }


  connectPromise = startConnection()
    .catch((err) => {
      console.error("[WhatsApp] Error en startConnection:", err);
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

async function startConnection(): Promise<void> {
  try {
    // ── Cerrar socket anterior si existe (evitar fugas) ──
    if (sock) {
      try {
        sock.end("reconnecting");
      } catch {
        // ignore
      }
      sock = null;
    }

    const baileys = await importBaileys();
    const { makeWASocket, DisconnectReason } = baileys;

    // ── Auth state persistido en PostgreSQL (no en FS efímero) ──
    const { state, saveCreds, clearAuthState } = await usePrismaAuthState();


    // Crear socket
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // generamos el QR nosotros vía API
      browser: ["Pinturas Dyrlo", "Chrome", "1.0.0"],
      syncFullHistory: false,
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
          // NOTA: NO ponemos sock = null aquí de inmediato. El socket
          // sigue siendo el objeto real de Baileys; el estado lo decide
          // isSocketReallyOpen() (ws.readyState / user). Esto evita que
          // el estado en memoria se desincronice de la realidad.
          // Después de desconectar físicamente, el socket no es usable.

          const statusCode = lastDisconnect?.output?.statusCode;
          const reason = lastDisconnect?.error?.message ?? "desconocido";

          // loggedOut = sesión invalidada, necesita reescanear QR
          if (statusCode === DisconnectReason.loggedOut) {
            lastError = `Sesión cerrada (${statusCode}): ${reason}. Reescanear QR.`;
            console.error(`[WhatsApp] ${lastError}`);
            // Limpiar credenciales para forzar nuevo QR
            void clearAuthState();
            // Eliminar socket muerto
            sock = null;
            // Reintentar conexión (generará nuevo QR)
            scheduleReconnect();
            return;
          }

          // Otros motivos: reconectar automáticamente
          lastError = `Conexión cerrada (${statusCode ?? "?"}): ${reason}`;
          console.warn(`[WhatsApp] ${lastError}`);
          // Marcar el socket como no conectado
          sock = null;
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

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPromise = null; // permitir nueva conexión
    connectWhatsApp().catch((err) =>
      console.error("[WhatsApp] Error en reconexión programada:", err)
    );
  }, delay);
}

// ─── API pública del servicio ──────────────────────────────────

/**
 * Devuelve el estado actual de la conexión de WhatsApp.
 *
 * IMPORTANTE: La fuente de verdad es la instancia real del socket en
 * memoria (ws.readyState / user), NO un flag en caché o BD. Esto
 * garantiza que el estado que ve la UI sea exactamente el mismo que
 * usará el endpoint de envío.
 */
export function getWhatsAppStatus(): WhatsAppStatus {
  const connected = isSocketReallyOpen(sock);

  // Sincronizar el flag con la realidad del socket
  if (connected) {
    connectionState = "open";
  } else if (connectionState === "open") {
    // El socket dice "open" pero el WebSocket no está realmente abierto:
    // desincronización detectada. Intentar reconexión automática.
    connectionState = "close";
    console.warn(
      "[WhatsApp] Detección de desincronización: el socket no está realmente abierto. Reconectando..."
    );
    void connectWhatsApp().catch((err) =>
      console.error("[WhatsApp] Error reconectando tras desincronización:", err)
    );
  }

  return {
    configured: true, // Baileys no requiere configuración previa de instancia
    connected,
    authorized: connected,
    hasQr: currentQr !== null,
    qr: currentQr,
    user: connected ? (sock?.user?.id ?? null) : null,
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
  // Si ya está conectado de verdad, no hay QR
  if (isSocketReallyOpen(sock)) {
    return { qr: null, dataUrl: null };
  }

  // Si hay credenciales guardadas, intentar reconexión automática
  // en vez de pedir QR inmediatamente (el QR solo se pide si de verdad
  // no hay sesión previa).
  const hasCreds = await hasSavedCredentials();
  if (hasCreds) {
    console.log("[WhatsApp] Credenciales guardadas detectadas. Reconectando automáticamente...");
    await connectWhatsApp();
    // Esperar un momento para que el socket tenga oportunidad de abrirse
    await new Promise((r) => setTimeout(r, 1500));
    if (isSocketReallyOpen(sock)) {
      return { qr: null, dataUrl: null };
    }
    // Si sigue sin conectar, dejamos que el flujo continúe y se genere QR
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
 *
 * Si el socket está nulo pero existe una sesión de autenticación
 * guardada, dispara la reconexión automática en lugar de pedir un
 * código QR inmediatamente. Solo si NO hay credenciales guardadas
 * se considera que el usuario debe escanear el QR.
 *
 * @returns objeto con `success`, `jid` y opcionalmente `error`
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; jid: string; error?: string }> {
  const jid = formatPhoneToJid(phone);

  // Si el socket no está realmente abierto, intentar reconectar
  if (!isSocketReallyOpen(sock)) {
    const hasCreds = await hasSavedCredentials();

    if (hasCreds) {
      // ── Punto 3: hay sesión guardada ⇒ reconexión automática ──
      console.log(
        "[WhatsApp] Socket nulo pero sesión guardada existe. Reconectando automáticamente..."
      );
      await connectWhatsApp();
      // Esperar razonable para dar oportunidad a que abra la conexión
      await new Promise((r) => setTimeout(r, 2000));

      if (isSocketReallyOpen(sock)) {
        // Reconectado correctamente, enviar el mensaje
        try {
          await sock.sendMessage(jid, { text: message });
          console.log(`[WhatsApp] Mensaje enviado a ${jid} (tras reconexión)`);
          return { success: true, jid };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[WhatsApp] Error enviando mensaje a ${jid}:`, msg);
          return { success: false, jid, error: msg };
        }
      }

      // La reconexión no llegó a abrirse aún. Informar con estado claro.
      return {
        success: false,
        jid,
        error:
          "Se detectaron credenciales guardadas y se está reconectando. Intenta de nuevo en unos segundos.",
      };
    }

    // ── Sin credenciales ⇒ sí requiere escanear QR ──
    return {
      success: false,
      jid,
      error:
        "WhatsApp no está conectado y no hay sesión guardada. Escanea el código QR primero.",
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
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
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

// ─── Inicialización automática ─────────────────────────────────

/**
 * Inicia la conexión de WhatsApp automáticamente cuando el módulo se
 * carga por primera vez en el servidor (producción). En desarrollo se
 * puede iniciar on-demand desde el endpoint de QR.
 *
 * Si existen credenciales guardadas (sesión previa), la reconexión usa
 * esas credenciales en lugar de pedir un QR nuevo.
 */
if (process.env.NODE_ENV === "production") {
  // Pequeño delay para no bloquear el arranque del servidor
  setTimeout(() => {
    connectWhatsApp().catch((err) =>
      console.error("[WhatsApp] Error en auto-inicio:", err)
    );
  }, 3000);
}
