import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const groupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const tierSchema = z.object({
  minLiters: z.number().positive(),
  maxLiters: z.number().positive(),
  pricePerLiter: z.number().positive(),
});

export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "VENDEDOR", "IGUALADOR"]);

  const groups = await prisma.colorGroup.findMany({
    where: { active: true },
    include: { priceTiers: { orderBy: { minLiters: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const body = await req.json();
  const { tiers, ...groupData } = z
    .object({
      ...groupSchema.shape,
      tiers: z.array(tierSchema).optional(),
    })
    .parse(body);

  const group = await prisma.colorGroup.create({
    data: {
      ...groupData,
      priceTiers: tiers ? { create: tiers } : undefined,
    },
    include: { priceTiers: true },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "ColorGroup",
    entityId: group.id,
    changes: body,
  });

  return NextResponse.json(group, { status: 201 });
}
