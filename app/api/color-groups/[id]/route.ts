import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, logOrderEdit } from "@/lib/audit";
import { requireRole, canManageCatalogs } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]);

  const { id } = await params;
  const group = await prisma.colorGroup.findUnique({
    where: { id },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Grupo de color no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(group);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canManageCatalogs(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para gestionar catálogos" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const data = updateGroupSchema.parse(body);

  const { id } = await params;
  const oldGroup = await prisma.colorGroup.findUnique({
    where: { id },
  });

  if (!oldGroup) {
    return NextResponse.json(
      { error: "Grupo de color no encontrado" },
      { status: 404 }
    );
  }

  const group = await prisma.colorGroup.update({
    where: { id },
    data,
  });

  await logOrderEdit(
    user.id,
    group.id,
    oldGroup as unknown as Record<string, unknown>,
    group as unknown as Record<string, unknown>,
    { entity: "ColorGroup" }
  );

  return NextResponse.json(group);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canManageCatalogs(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para gestionar catálogos" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const group = await prisma.colorGroup.findUnique({
    where: { id },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Grupo de color no encontrado" },
      { status: 404 }
    );
  }

  // Prevent deletion if there are orders using this group
  if (group._count.orders > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar. Hay ${group._count.orders} pedidos asociados` },
      { status: 400 }
    );
  }

  await prisma.colorGroup.delete({
    where: { id },
  });

  await logAudit(user.id, "DELETE", "ColorGroup", id, {
    name: group.name,
  });

  return NextResponse.json({ success: true });
}
