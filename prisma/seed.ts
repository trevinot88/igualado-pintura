import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "crypto";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.label.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.folioSequence.deleteMany();
  await prisma.priceTier.deleteMany();
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

  // Create users
  const admin = await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@dyrlo.com",
      hashedPassword: hashPassword("admin123"),
      role: "ADMIN",
      locationId: location.id,
    },
  });

  const vendedor = await prisma.user.create({
    data: {
      name: "María García",
      email: "vendedor@dyrlo.com",
      hashedPassword: hashPassword("vendedor123"),
      role: "VENDEDOR",
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

  // Create color groups with price tiers
  const colorGroups = [
    {
      name: "Básicos",
      description: "Blancos, negros y grises",
      sortOrder: 1,
      tiers: [
        { minLiters: 0.5, maxLiters: 3.99, pricePerLiter: 180 },
        { minLiters: 4, maxLiters: 9.99, pricePerLiter: 160 },
        { minLiters: 10, maxLiters: 19.99, pricePerLiter: 140 },
        { minLiters: 20, maxLiters: 999, pricePerLiter: 120 },
      ],
    },
    {
      name: "Pasteles",
      description: "Tonos suaves y pastel",
      sortOrder: 2,
      tiers: [
        { minLiters: 0.5, maxLiters: 3.99, pricePerLiter: 220 },
        { minLiters: 4, maxLiters: 9.99, pricePerLiter: 200 },
        { minLiters: 10, maxLiters: 19.99, pricePerLiter: 180 },
        { minLiters: 20, maxLiters: 999, pricePerLiter: 160 },
      ],
    },
    {
      name: "Medios",
      description: "Tonos medios y saturados",
      sortOrder: 3,
      tiers: [
        { minLiters: 0.5, maxLiters: 3.99, pricePerLiter: 260 },
        { minLiters: 4, maxLiters: 9.99, pricePerLiter: 240 },
        { minLiters: 10, maxLiters: 19.99, pricePerLiter: 220 },
        { minLiters: 20, maxLiters: 999, pricePerLiter: 200 },
      ],
    },
    {
      name: "Intensos",
      description: "Rojos, azules intensos, amarillos",
      sortOrder: 4,
      tiers: [
        { minLiters: 0.5, maxLiters: 3.99, pricePerLiter: 320 },
        { minLiters: 4, maxLiters: 9.99, pricePerLiter: 290 },
        { minLiters: 10, maxLiters: 19.99, pricePerLiter: 260 },
        { minLiters: 20, maxLiters: 999, pricePerLiter: 240 },
      ],
    },
    {
      name: "Especiales",
      description: "Metálicos, perlados, fluorescentes",
      sortOrder: 5,
      tiers: [
        { minLiters: 0.5, maxLiters: 3.99, pricePerLiter: 400 },
        { minLiters: 4, maxLiters: 9.99, pricePerLiter: 360 },
        { minLiters: 10, maxLiters: 19.99, pricePerLiter: 330 },
        { minLiters: 20, maxLiters: 999, pricePerLiter: 300 },
      ],
    },
  ];

  const createdGroups = [];
  for (const group of colorGroups) {
    const { tiers, ...groupData } = group;
    const created = await prisma.colorGroup.create({
      data: {
        ...groupData,
        priceTiers: { create: tiers },
      },
    });
    createdGroups.push(created);
  }

  // Create sample clients
  const clients = await Promise.all([
    prisma.client.create({
      data: { name: "Juan Pérez", email: "juan@email.com", phone: "555-111-1111", company: "Pinturas JP" },
    }),
    prisma.client.create({
      data: { name: "Ana Martínez", email: "ana@email.com", phone: "555-222-2222", allowCredit: true },
    }),
    prisma.client.create({
      data: { name: "Roberto Sánchez", phone: "555-333-3333", company: "Constructora RS" },
    }),
  ]);

  // Create sample orders
  const sampleOrders = [
    { colorName: "Blanco Hueso", liters: 4, groupIdx: 0, source: "MOSTRADOR" as const, status: "PENDIENTE" as const },
    { colorName: "Rosa Pastel", liters: 2, groupIdx: 1, source: "VENTAS" as const, status: "PENDIENTE" as const },
    { colorName: "Azul Cielo", liters: 8, groupIdx: 2, source: "WHATSAPP" as const, status: "PENDIENTE" as const },
    { colorName: "Rojo Ferrari", liters: 1, groupIdx: 3, source: "MOSTRADOR" as const, status: "EN_PROCESO" as const },
    { colorName: "Verde Jade", liters: 12, groupIdx: 2, source: "VENTAS" as const, status: "LISTO" as const },
    { colorName: "Dorado Metálico", liters: 3, groupIdx: 4, source: "REDES_SOCIALES" as const, status: "FACTURADO" as const },
    { colorName: "Gris Perla", liters: 20, groupIdx: 0, source: "MOSTRADOR" as const, status: "PAGADO" as const },
    { colorName: "Amarillo Sol", liters: 5, groupIdx: 3, source: "VENTAS" as const, status: "ENTREGADO" as const },
    { colorName: "Negro Mate", liters: 10, groupIdx: 0, source: "MOSTRADOR" as const, status: "PENDIENTE" as const },
    { colorName: "Turquesa", liters: 6, groupIdx: 2, source: "WHATSAPP" as const, status: "PENDIENTE" as const },
  ];

  // Initialize folio sequence
  const now = new Date();
  const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.folioSequence.create({
    data: { id: prefix, lastValue: 10 },
  });

  for (let i = 0; i < sampleOrders.length; i++) {
    const o = sampleOrders[i];
    const group = createdGroups[o.groupIdx];
    const tier = colorGroups[o.groupIdx].tiers.find(
      (t) => o.liters >= t.minLiters && o.liters <= t.maxLiters
    )!;
    const totalPrice = Math.round(tier.pricePerLiter * o.liters * 100) / 100;
    const folio = `${prefix}-${String(i + 1).padStart(5, "0")}`;

    await prisma.order.create({
      data: {
        folio,
        clientId: clients[i % clients.length].id,
        sellerId: vendedor.id,
        igualadorId: o.status !== "PENDIENTE" ? igualador.id : undefined,
        colorGroupId: group.id,
        colorName: o.colorName,
        liters: o.liters,
        pricePerLiter: tier.pricePerLiter,
        totalPrice,
        source: o.source,
        status: o.status,
        queuePosition: i + 1,
        locationId: location.id,
        startedAt: o.status !== "PENDIENTE" ? new Date(Date.now() - 3600000 * (10 - i)) : undefined,
        completedAt: ["LISTO", "FACTURADO", "PAGADO", "ENTREGADO"].includes(o.status)
          ? new Date(Date.now() - 3600000 * (8 - i))
          : undefined,
        productionTimeMinutes: ["LISTO", "FACTURADO", "PAGADO", "ENTREGADO"].includes(o.status)
          ? Math.floor(Math.random() * 60) + 15
          : undefined,
      },
    });
  }

  console.log("Seed complete!");
  console.log("Users created:");
  console.log("  admin@dyrlo.com / admin123");
  console.log("  vendedor@dyrlo.com / vendedor123");
  console.log("  igualador@dyrlo.com / igualador123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
