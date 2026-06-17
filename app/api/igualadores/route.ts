import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createIgualadorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
});

/**
 * GET /api/igualadores
 * Lista todos los igualadores físicos (activos e inactivos).
 * Si ?activos=true solo devuelve los activos.
 */
export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "IGUALADOR"]);

  const { searchParams } = new URL(req.url);
  const soloActivos = searchParams.get("activos") === "true";

  const igualadores = await prisma.igualador.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(igualadores);
}

/**
 * POST /api/igualadores
 * Crea un nuevo igualador físico (entra activo por defecto).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    requireRole(session?.user, ["ADMIN"]);

    const body = await req.json();
    const { nombre } = createIgualadorSchema.parse(body);

    const igualador = await prisma.igualador.create({
      data: { nombre },
    });

    return NextResponse.json(igualador, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("POST /api/igualadores error:", error);
    return NextResponse.json(
      { error: "Error interno al crear igualador" },
      { status: 500 }
    );
  }
}
