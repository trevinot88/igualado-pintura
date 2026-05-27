/**
 * Script: Elimina todos los usuarios NO-admin de la base de datos.
 * Uso: npx tsx scripts/clean-users.ts
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
  // Mostrar usuarios que se van a eliminar
  const toDelete = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (toDelete.length === 0) {
    console.log("✅ No hay usuarios no-admin que eliminar.");
    await pool.end();
    return;
  }

  console.log(`🗑️  Se eliminarán ${toDelete.length} usuario(s):`);
  for (const u of toDelete) {
    console.log(`   - ${u.name} (${u.email}) [${u.role}] active=${u.active}`);
  }

  // Eliminar registros relacionados primero (FK constraints)
  const userIds = toDelete.map((u) => u.id);

  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });

  const deleted = await prisma.user.deleteMany({
    where: { role: { not: "ADMIN" } },
  });

  console.log(`\n✅ Eliminados ${deleted.count} usuarios no-admin.`);
  console.log("   El usuario admin permanece intacto.");

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
