import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Sincroniza el catálogo de vendedores físicos al set oficial.
 * Idempotente: se puede correr cuantas veces se quiera, en local o en prod
 * (Render Shell), sin re-ejecutar todo el seed.
 *
 *   npx tsx prisma/sync-vendedores.ts
 *
 * - Crea/actualiza los vendedores oficiales (IDs fijos).
 * - Desactiva (activo=false) cualquier otro vendedor, sin borrarlo, para
 *   preservar las referencias históricas en pedidos antiguos.
 */
const VENDEDORES = [
  { id: "vendedor-francis", nombre: "Francis" },
  { id: "vendedor-padilla", nombre: "Padilla" },
  { id: "vendedor-garcia",  nombre: "García" },
  { id: "vendedor-bodega",  nombre: "Bodega" },
  { id: "vendedor-eduardo", nombre: "Eduardo" },
  { id: "vendedor-tienda",  nombre: "Tienda" },
];

async function main() {
  for (const v of VENDEDORES) {
    await prisma.vendedor.upsert({
      where: { id: v.id },
      update: { nombre: v.nombre, activo: true },
      create: { id: v.id, nombre: v.nombre, activo: true },
    });
  }

  const { count } = await prisma.vendedor.updateMany({
    where: { id: { notIn: VENDEDORES.map((v) => v.id) } },
    data: { activo: false },
  });

  console.log(`✅ ${VENDEDORES.length} vendedores oficiales sincronizados.`);
  console.log(`   ${count} vendedor(es) antiguo(s) desactivado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
