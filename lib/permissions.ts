import type { Role } from "@prisma/client";

type SessionUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  locationId?: string | null;
};

export function requireRole(
  user: SessionUser | undefined | null,
  allowedRoles: Role[]
): SessionUser {
  if (!user) throw new Error("No autenticado");
  if (!allowedRoles.includes(user.role)) throw new Error("Sin permisos");
  return user;
}

// ─── ROL: ADMIN ──────────────────────────────────────────

export function canManageCatalogs(role: Role): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

export function canPauseOrder(role: Role): boolean {
  return role === "ADMIN";
}

export function canReorderQueue(role: Role): boolean {
  return role === "ADMIN";
}

export function canEditOrder(role: Role): boolean {
  return role === "ADMIN";
}

// ─── ROL: FACTURACION ────────────────────────────────────

export function canCreateOrder(role: Role): boolean {
  return role === "ADMIN" || role === "FACTURACION";
}

export function canCreateClient(role: Role): boolean {
  return role === "ADMIN" || role === "FACTURACION";
}

export function canMarkAsDelivered(role: Role): boolean {
  return role === "ADMIN" || role === "FACTURACION";
}

// ─── ROL: IGUALADOR ──────────────────────────────────────

export function canStartProduction(role: Role): boolean {
  return role === "ADMIN" || role === "IGUALADOR";
}

export function canCompleteOrder(role: Role): boolean {
  return role === "ADMIN" || role === "IGUALADOR";
}

// ─── ROL: VENDEDOR_READONLY ──────────────────────────────

export function canViewOrders(role: Role): boolean {
  return true; // Todos pueden ver (filtrado por scope en query)
}

// ─── Status Transitions ──────────────────────────────────

const TRANSITIONS: Record<string, Record<string, Role[]>> = {
  PENDIENTE: {
    EN_PROCESO: ["ADMIN", "IGUALADOR"],
    CANCELADO: ["ADMIN"],
    PAUSADO: ["ADMIN"],
  },
  EN_PROCESO: {
    LISTO: ["ADMIN", "IGUALADOR"],
    CANCELADO: ["ADMIN"],
    PAUSADO: ["ADMIN"],
  },
  LISTO: {
    ENTREGADO: ["ADMIN", "FACTURACION"],
  },
  PAUSADO: {
    PENDIENTE: ["ADMIN"],
  },
  ENTREGADO: {},
  CANCELADO: {},
};

export function canTransition(
  currentStatus: string,
  newStatus: string,
  role: Role
): boolean {
  const allowed = TRANSITIONS[currentStatus]?.[newStatus];
  return allowed ? allowed.includes(role) : false;
}
