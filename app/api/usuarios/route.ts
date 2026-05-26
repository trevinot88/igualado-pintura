import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { DEMO_USUARIOS } from "@/lib/demo-data";

const DEMO_MODE = process.env.DEMO_MODE === "true";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "FACTURACION", "IGUALADOR", "VENDEDOR_READONLY"]),
  locationId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  requireRole(session?.user, ["ADMIN"]);

  if (DEMO_MODE) return NextResponse.json(DEMO_USUARIOS);

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

  const existing = await prisma.user.findFirst({ 
    where: { email: data.email } 
  });
  
  if (existing) {
    if (existing.active) {
      return NextResponse.json({ error: `El email ya está en uso por el usuario: ${existing.name}` }, { status: 400 });
    }
    // If user exists but inactive, reactivate with new data
    const hashedPassword = createHash("sha256").update(data.password).digest("hex");
    const reactivated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        hashedPassword,
        role: data.role,
        active: true,
        locationId: data.locationId || null,
      },
      select: { id: true, name: true, email: true, role: true, locationId: true, createdAt: true },
    });
    await logAudit(user.id, "UPDATE", "User", reactivated.id, { action: "reactivated", name: data.name, role: data.role });
    return NextResponse.json(reactivated, { status: 201 });
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

  await logAudit(user.id, "CREATE", "User", newUser.id, {
    name: data.name,
    email: data.email,
    role: data.role,
  });

  return NextResponse.json(newUser, { status: 201 });
}
