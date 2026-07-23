import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { getWhatsAppQR } from "@/lib/whatsapp-service";
import { NextResponse } from "next/server";

/**
 * GET /api/whatsapp/qr
 * Devuelve el código QR para vincular WhatsApp (Baileys) como Data URL.
 * Si ya está conectado, devuelve `{ connected: true }` sin QR.
 * Solo ADMIN.
 */
export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  const { qr, dataUrl } = await getWhatsAppQR();

  if (!qr || !dataUrl) {
    return NextResponse.json({
      connected: true,
      message: "WhatsApp ya está conectado o el QR aún no está disponible",
    });
  }

  return NextResponse.json({
    connected: false,
    qr: dataUrl, // Data URL (image/png base64) lista para <img src="...">
    rawQr: qr, // string crudo del QR (para clientes que lo rendericen)
  });
}