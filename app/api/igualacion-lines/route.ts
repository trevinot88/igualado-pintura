import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canManageCatalogs } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const createLineSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateLineSchema = createLineSchema.partial();

export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]);

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";

  const where = activeOnly ? { active: true } : {};

  const lines = await prisma.igualacionLine.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(lines);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  if (!canManageCatalogs(user.role)) {
    return NextResponse.json(
      { error: "Sin permisos para gestionar catálogos" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const data = createLineSchema.parse(body);

  // Check if code already exists
  const existing = await prisma.igualacionLine.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    return NextResponse.json(
      { error: "El código ya existe" },
      { status: 400 }
    );
  }

  const line = await prisma.igualacionLine.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description || null,
      active: data.active ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  await logAudit(user.id, "CREATE", "IgualacionLine", line.id, {
    code: line.code,
    name: line.name,
  });

  return NextResponse.json(line, { status: 201 });
}
