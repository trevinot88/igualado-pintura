import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole, canManageCatalogs } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]);

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";

  const where = activeOnly ? { active: true } : {};

  const groups = await prisma.colorGroup.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(groups);
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
  const data = createGroupSchema.parse(body);

  const group = await prisma.colorGroup.create({
    data: {
      name: data.name,
      description: data.description || null,
      active: data.active ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  await logAudit(user.id, "CREATE", "ColorGroup", group.id, {
    name: group.name,
  });

  return NextResponse.json(group, { status: 201 });
}
