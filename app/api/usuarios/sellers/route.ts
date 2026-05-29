import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "FACTURACION"]);

  const sellers = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: ["ADMIN", "VENDEDOR_READONLY"] },
    },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sellers);
}