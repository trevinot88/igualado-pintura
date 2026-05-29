import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { DEMO_AUDIT } from "@/lib/demo-data";

const DEMO_MODE = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  if (DEMO_MODE) return NextResponse.json(DEMO_AUDIT);

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const entityId = searchParams.get("entityId");
  const limit = parseInt(searchParams.get("limit") || "100");

  const where: Record<string, unknown> = {};
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });

  return NextResponse.json(logs);
}
