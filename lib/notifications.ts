import { logAudit } from "./audit";

/**
 * Sends a WhatsApp notification to the client when their order is ready.
 * Integrates with WhatsApp API (Twilio, Meta, etc.)
 */
export async function sendWhatsAppNotification(
  phone: string,
  orderFolio: string,
  clientName: string,
  orderId: string
): Promise<boolean> {
  try {
    // TODO: Integrate with WhatsApp API
    // Example with Twilio:
    // const message = await twilioClient.messages.create({
    //   from: 'whatsapp:+14155238886',
    //   to: `whatsapp:${phone}`,
    //   body: `Hola ${clientName}, tu pedido ${orderFolio} está listo para recoger. ¡Gracias!`
    // });

    console.log(`[WhatsApp] Sending notification to ${phone} for order ${orderFolio}`);

    // Log to audit
    await logAudit(null, "WHATSAPP_SENT", "Order", orderId, {
      phone,
      folio: orderFolio,
      clientName,
    });

    return true;
  } catch (error) {
    console.error("Error sending WhatsApp notification:", error);
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
    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    console.log(`[Email] Sending notification to ${email} for order ${orderFolio}`);
    return true;
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
}
