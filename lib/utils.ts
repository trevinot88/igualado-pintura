import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En Proceso",
  LISTO: "Listo",
  FACTURADO: "Facturado",
  PAGADO: "Pagado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  LISTO: "bg-green-100 text-green-800",
  FACTURADO: "bg-purple-100 text-purple-800",
  PAGADO: "bg-emerald-100 text-emerald-800",
  ENTREGADO: "bg-gray-100 text-gray-800",
  CANCELADO: "bg-red-100 text-red-800",
};

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  MOSTRADOR: "Mostrador",
  VENTAS: "Ventas",
  WHATSAPP: "WhatsApp",
  REDES_SOCIALES: "Redes Sociales",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CHEQUE: "Cheque",
  CREDITO: "Crédito",
};
