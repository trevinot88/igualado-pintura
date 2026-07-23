import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { checkGreenApiStatus, sendTestWhatsAppMessage } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * GET /api/whatsapp/test
 * Devuelve el estado de la conexión de WhatsApp (Baileys).
 * Solo ADMIN.
 */
export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  const status = await checkGreenApiStatus();
  return NextResponse.json(status);
}

const testSchema = z.object({
  phone: z.string().min(10, "Teléfono inválido"),
});

/**
 * POST /api/whatsapp/test
 * Envía un mensaje de prueba al número indicado y reporta el resultado.
 * Solo ADMIN.
 *
 * Body: { "phone": "5512345678" }
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const body = await req.json();
  const { phone } = testSchema.parse(body);

  // Primero verifica el estado de la conexión
  const status = await checkGreenApiStatus();

  if (!status.connected) {
    return NextResponse.json(
      {
        success: false,
        error:
          "WhatsApp no está conectado. Escanea el código QR desde /api/whatsapp/qr.",
        status,
      },
      { status: 400 }
    );
  }

  // Enviar mensaje de prueba
  const result = await sendTestWhatsAppMessage(phone);

  await logAudit(user.id, "WHATSAPP_SENT", "System", undefined, {
    phone,
    result,
    test: true,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, chatId: result.chatId },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Mensaje de prueba enviado correctamente",
    chatId: result.chatId,
    apiResponse: result.apiResponse,
  });
}