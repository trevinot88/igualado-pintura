import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, buildChanges } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  allowCredit: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  const { id } = await params;
  const body = await req.json();
  const data = updateSchema.parse(body);

  const before = await prisma.client.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const client = await prisma.client.update({ where: { id }, data });

  const changes = buildChanges(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
  if (changes) {
    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Client",
      entityId: id,
      changes,
    });
  }

  return NextResponse.json(client);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN"]);

  const { id } = await params;
  await prisma.client.update({ where: { id }, data: { active: false } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entity: "Client",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
