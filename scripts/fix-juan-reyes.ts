/**
 * Script TEMPORAL: Corrige el pedido de Juan Reyes (250L → 0.250L)
 *
 * Uso:
 *   1. Crea un archivo .env.local con DATABASE_URL
 *   2. npx tsx scripts/fix-juan-reyes.ts
 *   3. Elimina este script después de verificar
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── 1. BUSCAR ────────────────────────────────────────────
  console.log("\n🔍 Buscando pedido de Juan Reyes con 250 litros...\n");

  const orders = await prisma.order.findMany({
    where: {
      liters: 250,
      client: {
        name: { contains: "Juan Reyes", mode: "insensitive" },
      },
    },
    include: {
      client: { select: { name: true, phone: true } },
      colorGroup: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orders.length === 0) {
    console.log("⚠️  No se encontró ningún pedido.");
    console.log("   Buscando TODOS los pedidos de Juan Reyes para depurar...\n");

    const allJuan = await prisma.order.findMany({
      where: {
        client: {
          name: { contains: "Juan Reyes", mode: "insensitive" },
        },
      },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (allJuan.length === 0) {
      console.log("❌ No existe ningún cliente 'Juan Reyes' en la base de datos.");
    } else {
      console.log(`📋 Se encontraron ${allJuan.length} pedido(s) de Juan Reyes:\n`);
      for (const o of allJuan) {
        console.log(`   ┌─ Folio: ${o.folio}`);
        console.log(`   │  ID: ${o.id}`);
        console.log(`   │  Cliente: ${o.client.name}`);
        console.log(`   │  Color: ${o.colorName}`);
        console.log(`   │  Litros actual: ${o.liters}`);
        console.log(`   │  Estado: ${o.status}`);
        console.log(`   └─ Creado: ${o.createdAt.toISOString()}\n`);
      }
    }

    await pool.end();
    return;
  }

  // ── 2. MOSTRAR ────────────────────────────────────────────
  console.log(`📋 Se encontraron ${orders.length} pedido(s) con 250L:\n`);
  for (const o of orders) {
    console.log(`   ┌─ ID:       ${o.id}`);
    console.log(`   │  Folio:    ${o.folio}`);
    console.log(`   │  Cliente:  ${o.client.name}`);
    console.log(`   │  Teléfono: ${o.client.phone || "N/A"}`);
    console.log(`   │  Color:    ${o.colorName}`);
    console.log(`   │  Grupo:    ${o.colorGroup.name}`);
    console.log(`   │  Litros:   ${o.liters} → 0.250`);
    console.log(`   │  Estado:   ${o.status}`);
    console.log(`   │  Creado:   ${o.createdAt.toISOString()}`);
    console.log(`   └─\n`);
  }

  // ── 3. ACTUALIZAR (ESTRICTAMENTE POR ID) ─────────────────
  const targetId = orders[0].id;
  const oldLiters = orders[0].liters;

  console.log(`⏳ Actualizando pedido ${targetId}...\n`);

  await prisma.order.update({
    where: { id: targetId },
    data: { liters: 0.25 },
  });

  // ── 4. VERIFICAR ──────────────────────────────────────────
  const verified = await prisma.order.findUnique({
    where: { id: targetId },
    select: { id: true, folio: true, liters: true, updatedAt: true },
  });

  console.log(`✅ CORREGIDO:`);
  console.log(`   ID:       ${verified!.id}`);
  console.log(`   Folio:    ${verified!.folio}`);
  console.log(`   Litros:   ${oldLiters} → ${verified!.liters}`);
  console.log(`   Actualizado: ${verified!.updatedAt.toISOString()}`);

  // ── 5. REGISTRAR EN AUDIT LOG ────────────────────────────
  await prisma.auditLog.create({
    data: {
      action: "ORDER_EDITED",
      entity: "Order",
      entityId: targetId,
      oldValues: { liters: oldLiters },
      newValues: { liters: 0.25 },
      changes: { liters: { from: oldLiters, to: 0.25 } },
      metadata: {
        reason: "Corrección de captura — script temporal fix-juan-reyes.ts",
        folio: verified!.folio,
      },
    },
  });

  console.log(`\n📝 Registrado en audit log.`);
  console.log(`✅ Listo. Solo se modificó el pedido con ID ${targetId}.\n`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
