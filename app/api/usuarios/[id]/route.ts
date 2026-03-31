import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "VENDEDOR", "IGUALADOR"]).optional(),
  locationId: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  const body = await req.json();
  const data = updateUserSchema.parse(body);

  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.role) updateData.role = data.role;
  if (data.locationId !== undefined) updateData.locationId = data.locationId;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.password) {
    updateData.hashedPassword = createHash("sha256").update(data.password).digest("hex");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, locationId: true },
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    changes: data as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  await prisma.user.update({ where: { id }, data: { active: false } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entity: "User",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
