import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { resetWhatsAppSession } from "@/lib/whatsapp-service";
import { NextResponse } from "next/server";

/**
 * POST /api/whatsapp/disconnect
 * Reinicia la sesión de WhatsApp (cierra el socket y borra las
 * credenciales/claves guardadas en PostgreSQL) para forzar la
 * generación de un QR nuevo de vinculación.
 * Solo ADMIN y FACTURACION.
 */
export async function POST() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION"]);

  await resetWhatsAppSession();

  return NextResponse.json({
    success: true,
    message: "Sesión de WhatsApp reiniciada. Escanea el nuevo código QR.",
  });
}
