import { logAudit } from "./audit";

const GREEN_API_BASE = "https://api.green-api.com";

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
