import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { checkGreenApiStatus, sendTestWhatsAppMessage } from "@/lib/notifications";
import { hasSavedCredentials, connectWhatsApp } from "@/lib/whatsapp-service";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";


/**
 * GET /api/whatsapp/test
 * Devuelve el estado de la conexión de WhatsApp (Baileys).
 * Solo ADMIN y FACTURACION.
 */
export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION"]);

  const status = await checkGreenApiStatus();
  return NextResponse.json(status);
}

const testSchema = z.object({
  phone: z.string().min(10, "Teléfono inválido"),
});

/**
 * POST /api/whatsapp/test
 * Envía un mensaje de prueba al número indicado y reporta el resultado.
 * Solo ADMIN y FACTURACION.
 *
 * Body: { "phone": "5512345678" }
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "FACTURACION"]);

  const body = await req.json();
  const { phone } = testSchema.parse(body);

  // Verificar el estado de la conexión
  const status = await checkGreenApiStatus();

  // Si no está conectado pero hay credenciales guardadas, esperar la
  // reconexión automática antes de fallar con el mensaje de QR.
  if (!status.connected && (await hasSavedCredentials())) {
    console.log(
      "[WhatsApp/test] Sesión guardada detectada. Esperando reconexión automática..."
    );
    await connectWhatsApp();
    // Esperar (polling) hasta ~12s a que el socket abra la conexión
    let retryStatus = await checkGreenApiStatus();
    for (let i = 0; i < 12 && !retryStatus.connected; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      retryStatus = await checkGreenApiStatus();
    }
    if (!retryStatus.connected) {
      return NextResponse.json(
        {
          success: false,
          error:
            "WhatsApp se está reconectando. Intenta de nuevo en unos segundos.",
          status: retryStatus,
        },
        { status: 400 }
      );
    }
  } else if (!status.connected) {
    return NextResponse.json(
      {
        success: false,
        error:
          "WhatsApp no está conectado y no hay sesión guardada. Escanea el código QR desde /api/whatsapp/qr.",
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