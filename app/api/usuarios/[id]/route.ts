import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  try {
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

    try {
      await logAudit(user.id, "UPDATE", "User", id, data as Record<string, unknown>);
    } catch (auditError) {
      console.error("Audit log failed on user update:", auditError);
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos de usuario inválidos", details: error.flatten() }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    console.error("PUT /api/usuarios/[id] error:", error);
    return NextResponse.json({ error: "Error interno al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Buscar admin para reasignar órdenes
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", id: { not: id } },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) {
      return NextResponse.json({ error: "No hay otro admin para reasignar las órdenes" }, { status: 500 });
    }

    // Reasignar órdenes del usuario (sellerId es NOT NULL)
    await prisma.order.updateMany({
      where: { sellerId: id },
      data: { sellerId: admin.id },
    });

    // Nullificar referencias en igualadorId y ayudanteId (son nullable)
    await prisma.order.updateMany({
      where: { igualadorId: id },
      data: { igualadorId: null },
    });
    await prisma.order.updateMany({
      where: { ayudanteId: id },
      data: { ayudanteId: null },
    });

    // Desvincular audit logs
    await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });

    // Finalmente eliminar el usuario
    await prisma.user.delete({ where: { id } });

    try {
      await logAudit(user.id, "DELETE", "User", id, { hardDeleted: true, email: target.email, ordersReassignedTo: admin.id });
    } catch (auditError) {
      console.error("Audit log failed on user delete:", auditError);
    }

    return NextResponse.json({ ok: true, mode: "hard", message: "Usuario eliminado permanentemente. Órdenes reasignadas al admin." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    console.error("DELETE /api/usuarios/[id] error:", error);
    return NextResponse.json({ error: "Error interno al eliminar usuario" }, { status: 500 });
  }
}
