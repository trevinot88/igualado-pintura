import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/pricing";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  const { searchParams } = new URL(req.url);
  const colorGroupId = searchParams.get("colorGroupId");
  const liters = parseFloat(searchParams.get("liters") || "0");

  if (!colorGroupId || !liters) {
    return NextResponse.json({ error: "colorGroupId y liters requeridos" }, { status: 400 });
  }

  const group = await prisma.colorGroup.findUnique({ where: { id: colorGroupId } });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  const price = await calculatePrice(colorGroupId, liters);
  return NextResponse.json(price);
}
