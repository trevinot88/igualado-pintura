import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { getWhatsAppStatus } from "@/lib/whatsapp-service";
import { NextResponse } from "next/server";

/**
 * GET /api/whatsapp/status
 * Devuelve el estado actual de la conexión de WhatsApp (Baileys).
 * Solo ADMIN.
 */
export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  const status = getWhatsAppStatus();

  return NextResponse.json(status);
}