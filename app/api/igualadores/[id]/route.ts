import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const updateIgualadorSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

/**
 * PUT /api/igualadores/[id]
 * Actualiza nombre y/o estado activo/inactivo (soft delete).
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    requireRole(session?.user, ["ADMIN"]);

    const { id } = await params;
    const body = await req.json();
    const data = updateIgualadorSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const updated = await prisma.igualador.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.flatten() },
        { status: 400 }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Igualador no encontrado" },
        { status: 404 }
      );
    }
    console.error("PUT /api/igualadores/[id] error:", error);
    return NextResponse.json(
      { error: "Error interno al actualizar igualador" },
      { status: 500 }
    );
  }
}
