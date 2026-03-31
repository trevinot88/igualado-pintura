import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "VENDEDOR", "IGUALADOR"]),
  locationId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      locationId: true,
      location: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const body = await req.json();
  const data = createUserSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });
  }

  const hashedPassword = createHash("sha256").update(data.password).digest("hex");

  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      hashedPassword,
      role: data.role,
      locationId: data.locationId || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      locationId: true,
      createdAt: true,
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "User",
    entityId: newUser.id,
    changes: { name: data.name, email: data.email, role: data.role },
  });

  return NextResponse.json(newUser, { status: 201 });
}
