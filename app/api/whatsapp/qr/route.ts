import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { getWhatsAppQR, getWhatsAppStatus } from "@/lib/whatsapp-service";
import { NextResponse } from "next/server";

/**
 * GET /api/whatsapp/qr
 * Devuelve el código QR para vincular WhatsApp (Baileys) como Data URL.
 * Si ya está conectado, devuelve `{ connected: true }` sin QR.
 * Si no está conectado pero el QR aún no se generó, devuelve
 * `{ connected: false }` para que la UI lo siga intentando.
 * Solo ADMIN y FACTURACION.
 */
export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION"]);

  const { qr, dataUrl } = await getWhatsAppQR();

  if (!qr || !dataUrl) {
    const status = getWhatsAppStatus();
    return NextResponse.json({
      connected: status.connected,
      message: status.connected
        ? "WhatsApp ya está conectado"
        : "El QR aún no está disponible. Intenta de nuevo en unos segundos.",
    });
  }

  return NextResponse.json({
    connected: false,
    qr: dataUrl, // Data URL (image/png base64) lista para <img src="...">
    rawQr: qr, // string crudo del QR (para clientes que lo rendericen)
  });
}