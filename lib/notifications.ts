/**
 * Notificaciones de WhatsApp usando Baileys (reemplaza GREEN-API).
 *
 * Las funciones públicas mantienen la misma firma que la versión
 * anterior para que los endpoints que las consumen no requieran
 * cambios.
 */

import { logAudit } from "./audit";
import {
  sendWhatsAppMessage,
  getWhatsAppStatus,
  connectWhatsApp,
} from "./whatsapp-service";
import type { WhatsAppStatus } from "./whatsapp-types";

// Re-exportar el tipo para compatibilidad con código existente
export type GreenApiStatus = WhatsAppStatus;

/**
 * Consulta el estado de la conexión de WhatsApp (Baileys).
 * Reemplaza a `checkGreenApiStatus()` de GREEN-API.
 */
export async function checkGreenApiStatus(): Promise<GreenApiStatus> {
  // En producción, asegurar que la conexión esté iniciada
  if (process.env.NODE_ENV === "production") {
    void connectWhatsApp().catch(() => {
      // El error se registra dentro del servicio
    });
  }

  return getWhatsAppStatus();
}

/**
 * Envía un mensaje WhatsApp usando Baileys cuando el pedido está listo.
 * Mantiene la misma firma que la versión anterior de GREEN-API.
 */
export async function sendWhatsAppNotification(
  phone: string,
  orderFolio: string,
  clientName: string,
  orderId: string,
  colorName?: string
): Promise<boolean> {
  const colorPart = colorName ? `de *${colorName}* ` : "";
  const message =
    `¡Hola ${clientName}! 🎨 Tu pedido ${colorPart}ya está *listo para recolección* en sucursal.\n\n` +
    `Folio: *${orderFolio}*\n\n_Pinturas Dyrlo — gracias por tu preferencia_ 🙏`;

  const result = await sendWhatsAppMessage(phone, message);

  if (!result.success) {
    console.warn(
      `[WhatsApp] Notificación omitida para pedido ${orderFolio}: ${result.error}`
    );
    return false;
  }

  await logAudit(null, "WHATSAPP_SENT", "Order", orderId, {
    phone: result.jid,
    folio: orderFolio,
    clientName,
  });

  return true;
}

/**
 * Envía un mensaje de prueba de WhatsApp.
 * Usado por el endpoint de diagnóstico /api/whatsapp/test.
 * Devuelve detalles del resultado para inspección.
 */
export async function sendTestWhatsAppMessage(
  phone: string
): Promise<{
  success: boolean;
  chatId: string;
  apiResponse?: unknown;
  error?: string;
}> {
  const message =
    `🧪 *Mensaje de prueba — Pinturas Dyrlo*\n\n` +
    `Este es un mensaje de verificación del sistema de notificaciones automáticas.\n` +
    `Hora: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`;

  const result = await sendWhatsAppMessage(phone, message);

  return {
    success: result.success,
    chatId: result.jid,
    apiResponse: result.success
      ? { provider: "baileys", jid: result.jid }
      : undefined,
    error: result.error,
  };
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