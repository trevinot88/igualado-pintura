import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "IGUALADOR"]);

  const igualadores = await prisma.user.findMany({
    where: {
      active: true,
      role: "IGUALADOR",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(igualadores);
}
