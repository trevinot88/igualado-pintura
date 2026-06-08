/**
 * Script: Renombra los grupos de color existentes a la nueva lista.
 * Conserva los IDs (los pedidos asociados mantienen su referencia).
 * Mapea por sortOrder; crea los que falten y desactiva los sobrantes.
 * Uso: npx tsx scripts/rename-color-groups.ts
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

const NEW_GROUPS = [
  { name: "REGULAR", sortOrder: 1 },
  { name: "ORGANICO", sortOrder: 2 },
  { name: "ORGANICO APERLADO", sortOrder: 3 },
  { name: "ROJOS Y MARRONES", sortOrder: 4 },
  { name: "ROJOS Y MARRONES APERLADOS", sortOrder: 5 },
];

async function main() {
  const existing = await prisma.colorGroup.findMany({
    orderBy: { sortOrder: "asc" },
  });

  console.log(`📋 Grupos actuales (${existing.length}):`);
  for (const g of existing) {
    console.log(`   - [${g.sortOrder}] ${g.name} (active=${g.active})`);
  }

  for (let i = 0; i < NEW_GROUPS.length; i++) {
    const target = NEW_GROUPS[i];
    const current = existing[i];

    if (current) {
      await prisma.colorGroup.update({
        where: { id: current.id },
        data: { name: target.name, sortOrder: target.sortOrder, active: true },
      });
      console.log(`   ✏️  "${current.name}" → "${target.name}"`);
    } else {
      await prisma.colorGroup.create({ data: target });
      console.log(`   ➕ Creado "${target.name}"`);
    }
  }

  // Desactivar grupos sobrantes (no se eliminan para no romper pedidos asociados)
  const surplus = existing.slice(NEW_GROUPS.length);
  for (const g of surplus) {
    await prisma.colorGroup.update({
      where: { id: g.id },
      data: { active: false },
    });
    console.log(`   🚫 Desactivado sobrante "${g.name}"`);
  }

  console.log(`\n✅ Grupos de color actualizados.`);
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
