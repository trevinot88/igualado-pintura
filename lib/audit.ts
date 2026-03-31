import { prisma } from "./prisma";
import { AuditAction } from "@prisma/client";

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  changes,
  metadata,
}: {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      changes: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

export function buildChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
