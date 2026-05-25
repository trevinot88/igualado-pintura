import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, logOrderEdit } from "@/lib/audit";
import { requireRole, canManageCatalogs } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateLineSchema = z.object({
  code: z.string().min(1).max(50).optional(),
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
  const line = await prisma.igualacionLine.findUnique({
    where: { id },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!line) {
    return NextResponse.json(
      { error: "Línea no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(line);
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
  const data = updateLineSchema.parse(body);

  const { id } = await params;
  const oldLine = await prisma.igualacionLine.findUnique({
    where: { id },
  });

  if (!oldLine) {
    return NextResponse.json(
      { error: "Línea no encontrada" },
      { status: 404 }
    );
  }

  // Check if new code already exists (if changing code)
  if (data.code && data.code !== oldLine.code) {
    const existing = await prisma.igualacionLine.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "El código ya existe" },
        { status: 400 }
      );
    }
  }

  const line = await prisma.igualacionLine.update({
    where: { id },
    data,
  });

  await logOrderEdit(
    user.id,
    line.id,
    oldLine as unknown as Record<string, unknown>,
    line as unknown as Record<string, unknown>,
    { entity: "IgualacionLine" }
  );

  return NextResponse.json(line);
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
  const line = await prisma.igualacionLine.findUnique({
    where: { id },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!line) {
    return NextResponse.json(
      { error: "Línea no encontrada" },
      { status: 404 }
    );
  }

  // Prevent deletion if there are orders using this line
  if (line._count.orders > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar. Hay ${line._count.orders} pedidos asociados` },
      { status: 400 }
    );
  }

  await prisma.igualacionLine.delete({
    where: { id },
  });

  await logAudit(user.id, "DELETE", "IgualacionLine", id, {
    code: line.code,
    name: line.name,
  });

  return NextResponse.json({ success: true });
}
