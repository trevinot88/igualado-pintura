import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createHash } from "crypto";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.label.deleteMany();
  await prisma.order.deleteMany();
  await prisma.folioSequence.deleteMany();
  await prisma.igualacionLine.deleteMany();
  await prisma.colorGroup.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();

  // Create main location
  const location = await prisma.location.create({
    data: {
      name: "Sucursal Principal",
      address: "Av. Principal #123, Col. Centro",
      phone: "555-123-4567",
    },
  });

  // Create users with new roles
  const admin = await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@dyrlo.com",
      hashedPassword: hashPassword("admin123"),
      role: "ADMIN",
      locationId: location.id,
    },
  });

  const facturacion = await prisma.user.create({
    data: {
      name: "María García",
      email: "facturacion@dyrlo.com",
      hashedPassword: hashPassword("facturacion123"),
      role: "FACTURACION",
      locationId: location.id,
    },
  });

  const igualador = await prisma.user.create({
    data: {
      name: "Carlos López",
      email: "igualador@dyrlo.com",
      hashedPassword: hashPassword("igualador123"),
      role: "IGUALADOR",
      locationId: location.id,
    },
  });

  const vendedor = await prisma.user.create({
    data: {
      name: "Pedro Rodríguez",
      email: "vendedor@dyrlo.com",
      hashedPassword: hashPassword("vendedor123"),
      role: "VENDEDOR_READONLY",
      locationId: location.id,
    },
  });

  // Create color groups (sin price tiers)
  const basicos = await prisma.colorGroup.create({
    data: {
      name: "Básicos",
      description: "Blancos, negros y grises",
      sortOrder: 1,
    },
  });

  const pasteles = await prisma.colorGroup.create({
    data: {
      name: "Pasteles",
      description: "Tonos suaves y pastel",
      sortOrder: 2,
    },
  });

  const medios = await prisma.colorGroup.create({
    data: {
      name: "Medios",
      description: "Tonos medios y saturados",
      sortOrder: 3,
    },
  });

  const intensos = await prisma.colorGroup.create({
    data: {
      name: "Intensos",
      description: "Rojos, azules intensos, amarillos",
      sortOrder: 4,
    },
  });

  const especiales = await prisma.colorGroup.create({
    data: {
      name: "Especiales",
      description: "Metálicos, perlados, fluorescentes",
      sortOrder: 5,
    },
  });

  // Create igualacion lines
  const lineComex = await prisma.igualacionLine.create({
    data: {
      code: "COMEX",
      name: "Comex",
      description: "Línea de igualación Comex",
      sortOrder: 1,
    },
  });

  const lineBerel = await prisma.igualacionLine.create({
    data: {
      code: "BEREL",
      name: "Berel",
      description: "Línea de igualación Berel",
      sortOrder: 2,
    },
  });

  const lineSherwin = await prisma.igualacionLine.create({
    data: {
      code: "SHERWIN",
      name: "Sherwin Williams",
      description: "Línea de igualación Sherwin Williams",
      sortOrder: 3,
    },
  });

  // Create sample clients
  const cliente1 = await prisma.client.create({
    data: {
      name: "Juan Pérez",
      email: "juan@email.com",
      phone: "555-111-1111",
      company: "Pinturas JP",
    },
  });

  const cliente2 = await prisma.client.create({
    data: {
      name: "Ana Martínez",
      email: "ana@email.com",
      phone: "555-222-2222",
      allowCredit: true,
    },
  });

  const cliente3 = await prisma.client.create({
    data: {
      name: "Roberto Sánchez",
      phone: "555-333-3333",
      company: "Constructora RS",
    },
  });

  // Initialize folio sequence (new daily format YYMMDD)
  const now = new Date();
  const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  await prisma.folioSequence.create({
    data: { id: prefix, lastValue: 0 },
  });

  // Create sample orders (with new status values)
  const sampleOrders = [
    {
      colorName: "Blanco Hueso",
      liters: 4,
      group: basicos,
      line: lineComex,
      source: "MOSTRADOR" as const,
      status: "PENDIENTE" as const,
      queuePosition: 1,
    },
    {
      colorName: "Rosa Pastel",
      liters: 2,
      group: pasteles,
      line: lineBerel,
      source: "VENTAS" as const,
      status: "PENDIENTE" as const,
      queuePosition: 2,
    },
    {
      colorName: "Azul Cielo",
      liters: 8,
      group: medios,
      line: lineSherwin,
      source: "WHATSAPP" as const,
      status: "PENDIENTE" as const,
      queuePosition: 3,
    },
    {
      colorName: "Rojo Ferrari",
      liters: 1,
      group: intensos,
      line: lineComex,
      source: "MOSTRADOR" as const,
      status: "EN_PROCESO" as const,
      queuePosition: 4,
      igualadorId: igualador.id,
      startedAt: new Date(),
    },
    {
      colorName: "Verde Jade",
      liters: 12,
      group: medios,
      line: lineBerel,
      source: "VENTAS" as const,
      status: "LISTO" as const,
      queuePosition: 5,
      igualadorId: igualador.id,
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(),
      productionTimeMinutes: 60,
    },
    {
      colorName: "Dorado Metálico",
      liters: 3,
      group: especiales,
      line: lineSherwin,
      source: "REDES_SOCIALES" as const,
      status: "ENTREGADO" as const,
      queuePosition: 6,
      igualadorId: igualador.id,
      startedAt: new Date(Date.now() - 7200000),
      completedAt: new Date(Date.now() - 3600000),
      deliveredAt: new Date(),
      productionTimeMinutes: 90,
    },
  ];

  for (let i = 0; i < sampleOrders.length; i++) {
    const o = sampleOrders[i];
    const folio = `${prefix}-${String(i + 1).padStart(2, "0")}`;

    await prisma.order.create({
      data: {
        folio,
        clientId: [cliente1.id, cliente2.id, cliente3.id][i % 3],
        sellerId: facturacion.id,
        igualadorId: o.igualadorId,
        colorGroupId: o.group.id,
        igualacionLineId: o.line?.id,
        colorName: o.colorName,
        liters: o.liters,
        source: o.source,
        status: o.status,
        queuePosition: o.queuePosition,
        startedAt: o.startedAt,
        completedAt: o.completedAt,
        deliveredAt: o.deliveredAt,
        productionTimeMinutes: o.productionTimeMinutes,
        locationId: location.id,
      },
    });
  }

  console.log("✅ Seed completed!");
  console.log("\n📋 Usuarios creados:");
  console.log("  - admin@dyrlo.com / admin123 (ADMIN)");
  console.log("  - facturacion@dyrlo.com / facturacion123 (FACTURACION)");
  console.log("  - igualador@dyrlo.com / igualador123 (IGUALADOR)");
  console.log("  - vendedor@dyrlo.com / vendedor123 (VENDEDOR_READONLY)");
  console.log(`\n📦 ${sampleOrders.length} pedidos creados`);
  console.log(`🎨 5 grupos de color creados`);
  console.log(`🔧 3 líneas de igualación creadas`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
