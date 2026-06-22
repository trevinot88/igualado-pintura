/**
 * Script: Elimina permanentemente todos los usuarios inactivos (active=false)
 * reasignando sus órdenes al admin y limpiando referencias.
 *
 * Uso en Render Shell:
 *   cd /opt/render/project/src
 *   DATABASE_URL="$DATABASE_URL" npx tsx scripts/purge-inactive-users.ts
 *
 * O si el archivo no existe aún:
 *   Copia este contenido a un archivo temporal o usa el comando de una línea
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const inactiveUsers = await prisma.user.findMany({
    where: { active: false },
    select: { id: true, name: true, email: true, role: true },
  });

  if (inactiveUsers.length === 0) {
    console.log("✅ No hay usuarios inactivos que eliminar.");
    await pool.end();
    return;
  }

  console.log(`🗑️  Se eliminarán ${inactiveUsers.length} usuario(s) inactivo(s):`);
  for (const u of inactiveUsers) {
    console.log(`   - ${u.name} (${u.email}) [${u.role}]`);
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error("❌ No se encontró un ADMIN activo para reasignar órdenes.");
    await pool.end();
    process.exit(1);
  }
  console.log(`\n👤 Reasignando órdenes al admin: ${admin.name} (${admin.email})`);

  const userIds = inactiveUsers.map((u) => u.id);

  const sellerUpdates = await prisma.order.updateMany({
    where: { sellerId: { in: userIds } },
    data: { sellerId: admin.id },
  });
  console.log(`   → Órdenes como vendedor reasignadas: ${sellerUpdates.count}`);

  const igualadorUpdates = await prisma.order.updateMany({
    where: { igualadorId: { in: userIds } },
    data: { igualadorId: null },
  });
  console.log(`   → Referencias como igualador nullificadas: ${igualadorUpdates.count}`);

  const ayudanteUpdates = await prisma.order.updateMany({
    where: { ayudanteId: { in: userIds } },
    data: { ayudanteId: null },
  });
  console.log(`   → Referencias como ayudante nullificadas: ${ayudanteUpdates.count}`);

  const auditUpdates = await prisma.auditLog.updateMany({
    where: { userId: { in: userIds } },
    data: { userId: null },
  });
  console.log(`   → Audit logs desvinculados: ${auditUpdates.count}`);

  const deleted = await prisma.user.deleteMany({
    where: { active: false },
  });
  console.log(`\n✅ Eliminados ${deleted.count} usuarios inactivos permanentemente.`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
