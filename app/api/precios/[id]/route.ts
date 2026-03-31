import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  tiers: z
    .array(
      z.object({
        id: z.string().optional(),
        minLiters: z.number().positive(),
        maxLiters: z.number().positive(),
        pricePerLiter: z.number().positive(),
      })
    )
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const { id } = await params;
  const group = await prisma.colorGroup.findUnique({
    where: { id },
    include: { priceTiers: { orderBy: { minLiters: "asc" } } },
  });

  if (!group) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(group);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  const body = await req.json();
  const { tiers, ...groupData } = updateGroupSchema.parse(body);

  const group = await prisma.$transaction(async (tx) => {
    if (tiers) {
      // Delete existing tiers and recreate
      await tx.priceTier.deleteMany({ where: { colorGroupId: id } });
      await tx.priceTier.createMany({
        data: tiers.map((t) => ({
          colorGroupId: id,
          minLiters: t.minLiters,
          maxLiters: t.maxLiters,
          pricePerLiter: t.pricePerLiter,
        })),
      });
    }

    return tx.colorGroup.update({
      where: { id },
      data: groupData,
      include: { priceTiers: { orderBy: { minLiters: "asc" } } },
    });
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "ColorGroup",
    entityId: id,
    changes: body,
  });

  return NextResponse.json(group);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  await prisma.colorGroup.update({ where: { id }, data: { active: false } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entity: "ColorGroup",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
