import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createVendedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
});

/**
 * GET /api/vendedores
 * Retorna todos los vendedores físicos (solo activos por defecto).
 */
export async function GET(req: Request) {
  const session = await auth();
  try {
    requireRole(session?.user, ["ADMIN", "FACTURACION"]);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  const where = all ? {} : { activo: true };

  const vendedores = await prisma.vendedor.findMany({
    where,
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(vendedores);
}

/**
 * POST /api/vendedores
 * Crea un nuevo vendedor físico.
 */
export async function POST(req: Request) {
  const session = await auth();
  try {
    requireRole(session?.user, ["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const data = createVendedorSchema.parse(body);

  const vendedor = await prisma.vendedor.create({
    data: { nombre: data.nombre },
  });

  return NextResponse.json(vendedor, { status: 201 });
}
