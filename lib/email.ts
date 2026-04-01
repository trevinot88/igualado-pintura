import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

interface OrderEmailData {
  folio: string;
  clientName: string;
  clientEmail: string;
  colorName: string;
  liters: number;
  locationName?: string;
}

export async function sendOrderReadyEmail(data: OrderEmailData) {
  if (!data.clientEmail) return;

  try {
    await getResend().emails.send({
      from: process.env.EMAIL_FROM || "DYRLO <noreply@dyrlo.com>",
      to: data.clientEmail,
      subject: `Tu pedido ${data.folio} está listo - dyrlo`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">DYRLO Igualados Pro</h1>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #16a34a; margin-top: 0;">¡Tu pedido está listo! ✅</h2>
    <p>Hola <strong>${data.clientName}</strong>,</p>
    <p>Tu pedido de igualación de pintura está listo para recoger.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr style="background: #f8fafc;">
        <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e2e8f0;">Folio</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${data.folio}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e2e8f0;">Color</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${data.colorName}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e2e8f0;">Litros</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${data.liters}L</td>
      </tr>
      ${data.locationName ? `<tr>
        <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e2e8f0;">Sucursal</td>
        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${data.locationName}</td>
      </tr>` : ""}
    </table>
    <p style="color: #64748b; font-size: 14px;">Puedes pasar a recogerlo en horario de atención.</p>
  </div>
</body>
</html>`,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
