import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateVendedorSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

/**
 * PUT /api/vendedores/[id]
 * Edita el nombre y/o activo de un vendedor físico (soft delete toggle).
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  try {
    requireRole(session?.user, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const data = updateVendedorSchema.parse(body);

  const existing = await prisma.vendedor.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
  }

  const vendedor = await prisma.vendedor.update({
    where: { id },
    data,
  });

  return NextResponse.json(vendedor);
}
