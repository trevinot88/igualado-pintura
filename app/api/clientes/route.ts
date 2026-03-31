import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  allowCredit: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const clients = await prisma.client.findMany({
    where: {
      active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = requireRole(session?.user, ["ADMIN", "VENDEDOR"]);

  const body = await req.json();
  const data = clientSchema.parse(body);

  const client = await prisma.client.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      notes: data.notes || null,
      allowCredit: data.allowCredit || false,
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Client",
    entityId: client.id,
    changes: data as Record<string, unknown>,
  });

  return NextResponse.json(client, { status: 201 });
}
