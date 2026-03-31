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

export function canCreateOrder(role: Role): boolean {
  return role === "ADMIN" || role === "VENDEDOR";
}

export function canEditOrder(role: Role): boolean {
  return role === "ADMIN";
}

export function canReorderQueue(role: Role): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

export function canManagePrices(role: Role): boolean {
  return role === "ADMIN";
}

// Status transitions allowed per role
const TRANSITIONS: Record<string, Record<string, Role[]>> = {
  PENDIENTE: {
    EN_PROCESO: ["ADMIN", "IGUALADOR"],
    CANCELADO: ["ADMIN"],
  },
  EN_PROCESO: {
    LISTO: ["ADMIN", "IGUALADOR"],
    CANCELADO: ["ADMIN"],
  },
  LISTO: {
    FACTURADO: ["ADMIN", "VENDEDOR"],
    CANCELADO: ["ADMIN"],
  },
  FACTURADO: {
    PAGADO: ["ADMIN", "VENDEDOR"],
    CANCELADO: ["ADMIN"],
  },
  PAGADO: {
    ENTREGADO: ["ADMIN", "VENDEDOR"],
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
