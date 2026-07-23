/**
 * Tipos compartidos para el servicio de WhatsApp (Baileys).
 */

export type WhatsAppStatus = {
  /** Baileys no requiere configuración previa, siempre true */
  configured: boolean;
  /** true si el socket está abierto y conectado */
  connected: boolean;
  /** true si la sesión está autorizada (equivale a connected en Baileys) */
  authorized: boolean;
  /** true si hay un código QR disponible para escanear */
  hasQr: boolean;
  /** Contenido del QR (string), si está disponible */
  qr?: string | null;
  /** JID del usuario conectado, ej. 521XXXXXXXXXX@s.whatsapp.net */
  user?: string | null;
  /** Último error registrado, si lo hay */
  error?: string;
};