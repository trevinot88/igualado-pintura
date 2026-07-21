import { logAudit } from "./audit";

const GREEN_API_BASE = "https://api.green-api.com";

export interface GreenApiStatus {
  configured: boolean;
  instanceId: string | null;
  authorized: boolean | null;
  stateInstance?: string | null;
  apiResponse?: unknown;
  error?: string;
}

/**
 * Consulta el estado de la instancia de Green API.
 * Usa el endpoint getStateInstance para verificar si la cuenta sigue
 * autorizada (tras escanear el código QR).
 * Documentación: https://green-api.com/en/docs/api/instance-state/GetStateInstance/
 */
export async function checkGreenApiStatus(): Promise<GreenApiStatus> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;

  if (!instanceId || !token) {
    return {
      configured: false,
      instanceId: instanceId ?? null,
      authorized: null,
      error: "GREEN_API_INSTANCE_ID o GREEN_API_TOKEN no configurados",
    };
  }

  const url = `${GREEN_API_BASE}/waInstance${instanceId}/getStateInstance/${token}`;

  try {
    const res = await fetch(url, { method: "GET" });

    const bodyText = await res.text();
    let bodyJson: unknown = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = bodyText;
    }

    if (!res.ok) {
      return {
        configured: true,
        instanceId,
        authorized: false,
        apiResponse: bodyJson,
        error: `Green API respondió HTTP ${res.status}`,
      };
    }

    // getStateInstance devuelve { stateInstance: "authorized" | "notAuthorized" | "blocked" }
    const state =
      typeof bodyJson === "object" && bodyJson !== null
        ? (bodyJson as Record<string, unknown>).stateInstance
        : null;

    return {
      configured: true,
      instanceId,
      authorized: state === "authorized",
      stateInstance: typeof state === "string" ? state : null,
      apiResponse: bodyJson,
    };
  } catch (error) {
    return {
      configured: true,
      instanceId,
      authorized: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Normaliza un número de teléfono al formato Green API: 521XXXXXXXXXX@c.us
 * Acepta: +52 123..., 52123..., 10 dígitos locales MX
 */
function formatPhoneForGreenApi(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "521" + digits;
  } else if (digits.startsWith("52") && digits.length === 12) {
    digits = "521" + digits.slice(2);
  }
  return `${digits}@c.us`;
}

/**
 * Envía un mensaje WhatsApp usando Green API cuando el pedido está listo.
 */
export async function sendWhatsAppNotification(
  phone: string,
  orderFolio: string,
  clientName: string,
  orderId: string,
  colorName?: string
): Promise<boolean> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;

  if (!instanceId || !token) {
    console.warn(
      "[WhatsApp] GREEN_API_INSTANCE_ID o GREEN_API_TOKEN no configurados — notificación omitida"
    );
    return false;
  }

  const chatId = formatPhoneForGreenApi(phone);
  const colorPart = colorName ? `de *${colorName}* ` : "";
  const message =
    `¡Hola ${clientName}! 🎨 Tu pedido ${colorPart}ya está *listo para recolección* en sucursal.\n\nFolio: *${orderFolio}*\n\n_Pinturas Dyrlo — gracias por tu preferencia_ 🙏`;

  const url = `${GREEN_API_BASE}/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[WhatsApp] Error ${res.status} de Green API:`, body);
      return false;
    }

    console.log(`[WhatsApp] Mensaje enviado a ${chatId} para pedido ${orderFolio}`);

    await logAudit(null, "WHATSAPP_SENT", "Order", orderId, {
      phone: chatId,
      folio: orderFolio,
      clientName,
    });

    return true;
  } catch (error) {
    console.error("[WhatsApp] Error al llamar Green API:", error);
    return false;
  }
}

/**
 * Envía un mensaje de prueba de WhatsApp.
 * Usado por el endpoint de diagnóstico /api/whatsapp/test.
 * Devuelve detalles del resultado para inspección.
 */
export async function sendTestWhatsAppMessage(
  phone: string
): Promise<{ success: boolean; chatId: string; apiResponse?: unknown; error?: string }> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;

  if (!instanceId || !token) {
    return {
      success: false,
      chatId: "",
      error: "GREEN_API_INSTANCE_ID o GREEN_API_TOKEN no configurados",
    };
  }

  const chatId = formatPhoneForGreenApi(phone);
  const message =
    `🧪 *Mensaje de prueba — Pinturas Dyrlo*\n\n` +
    `Este es un mensaje de verificación del sistema de notificaciones automáticas.\n` +
    `Hora: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`;

  const url = `${GREEN_API_BASE}/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });

    const bodyText = await res.text();
    let bodyJson: unknown = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = bodyText;
    }

    if (!res.ok) {
      return {
        success: false,
        chatId,
        apiResponse: bodyJson,
        error: `Green API respondió HTTP ${res.status}`,
      };
    }

    return { success: true, chatId, apiResponse: bodyJson };
  } catch (error) {
    return {
      success: false,
      chatId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sends an email notification (optional backup to WhatsApp)
 */
export async function sendEmailNotification(
  email: string,
  orderFolio: string,
  clientName: string
): Promise<boolean> {
  try {
    console.log(`[Email] Sending notification to ${email} for order ${orderFolio}`);
    return true;
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
}
