/**
 * Script: Corrige litros mal capturados en un pedido.
 *
 * Busca pedidos por nombre de cliente y valor de litros actual,
 * y los actualiza al valor correcto. Útil para pedidos ya entregados
 * que no se pueden editar desde la UI.
 *
 * Uso:
 *   npx tsx scripts/fix-liters.ts
 *
 * El script mostrará los pedidos que coinciden y pedirá confirmación
 * antes de actualizar.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as readline from "readline";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ═══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN — Edita estos valores según el caso a corregir
// ═══════════════════════════════════════════════════════════════
const CLIENT_NAME_SEARCH = "Juan Reyes";   // Buscar pedidos de este cliente
const CURRENT_LITERS = 250;                  // Valor incorrecto actual
const CORRECT_LITERS = 0.25;                 // Valor correcto a establecer
// ═══════════════════════════════════════════════════════════════

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n🔍 Buscando pedidos para corregir...");
  console.log(`   Cliente: "${CLIENT_NAME_SEARCH}"`);
  console.log(`   Litros actuales: ${CURRENT_LITERS}`);
  console.log(`   Litros correctos: ${CORRECT_LITERS}\n`);

  const orders = await prisma.order.findMany({
    where: {
      liters: CURRENT_LITERS,
      client: {
        name: { contains: CLIENT_NAME_SEARCH, mode: "insensitive" },
      },
    },
    include: {
      client: { select: { name: true } },
      colorGroup: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orders.length === 0) {
    console.log("⚠️  No se encontraron pedidos que coincidan con los criterios.");
    console.log("   Verifica el nombre del cliente y el valor de litros.\n");
    await pool.end();
    return;
  }

  console.log(`📋 Se encontraron ${orders.length} pedido(s):\n`);
  for (const o of orders) {
    console.log(`   ┌─ Folio: ${o.folio}`);
    console.log(`   │  Cliente: ${o.client.name}`);
    console.log(`   │  Color: ${o.colorName}`);
    console.log(`   │  Grupo: ${o.colorGroup.name}`);
    console.log(`   │  Litros: ${o.liters} → ${CORRECT_LITERS}`);
    console.log(`   │  Estado: ${o.status}`);
    console.log(`   │  Creado: ${o.createdAt.toISOString()}`);
    console.log(`   └─ ID: ${o.id}\n`);
  }

  const answer = await ask("¿Deseas corregir estos pedidos? (escribe 'SI' para confirmar): ");

  if (answer !== "SI") {
    console.log("❌ Operación cancelada.");
    await pool.end();
    return;
  }

  console.log("\n⏳ Actualizando pedidos...\n");

  for (const o of orders) {
    const oldLiters = o.liters;
    await prisma.order.update({
      where: { id: o.id },
      data: { liters: CORRECT_LITERS },
    });

    // Registrar en audit log
    await prisma.auditLog.create({
      data: {
        action: "ORDER_EDITED",
        entity: "Order",
        entityId: o.id,
        oldValues: { liters: oldLiters },
        newValues: { liters: CORRECT_LITERS },
        changes: { liters: { from: oldLiters, to: CORRECT_LITERS } },
        metadata: {
          reason: "Corrección de captura — script fix-liters.ts",
          folio: o.folio,
        },
      },
    });

    console.log(`   ✅ ${o.folio}: ${oldLiters}L → ${CORRECT_LITERS}L`);
  }

  console.log(`\n✅ ${orders.length} pedido(s) corregido(s) exitosamente.`);
  console.log("   Los cambios quedan registrados en el audit log.\n");
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});