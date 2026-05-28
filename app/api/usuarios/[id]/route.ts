import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]).optional(),
  locationId: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  const body = await req.json();
  const data = updateUserSchema.parse(body);

  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.role) updateData.role = data.role;
  if (data.locationId !== undefined) updateData.locationId = data.locationId;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.password) {
    updateData.hashedPassword = createHash("sha256").update(data.password).digest("hex");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, locationId: true },
  });

  await logAudit(user.id, "UPDATE", "User", id, data as Record<string, unknown>);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;

  if (id === user.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, _count: { select: { sellerOrders: true, igualadorOrders: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const hasOrders = target._count.sellerOrders > 0 || target._count.igualadorOrders > 0;

  if (hasOrders) {
    await prisma.user.update({ where: { id }, data: { active: false } });
    await logAudit(user.id, "DELETE", "User", id, { deactivated: true, reason: "user has orders" });
    return NextResponse.json({
      ok: true,
      mode: "soft",
      message: "Usuario tiene órdenes asociadas; se desactivó en lugar de borrar.",
    });
  }

  await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
  await prisma.user.delete({ where: { id } });
  await logAudit(user.id, "DELETE", "User", id, { hardDeleted: true, email: target.email });

  return NextResponse.json({ ok: true, mode: "hard" });
}
