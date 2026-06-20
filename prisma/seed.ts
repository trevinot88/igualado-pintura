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
      hashedPassword: hashPassword("dyrlo2026"),
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
  const regular = await prisma.colorGroup.create({
    data: {
      name: "REGULAR",
      sortOrder: 1,
    },
  });

  const organico = await prisma.colorGroup.create({
    data: {
      name: "ORGANICO",
      sortOrder: 2,
    },
  });

  const organicoAperlado = await prisma.colorGroup.create({
    data: {
      name: "ORGANICO APERLADO",
      sortOrder: 3,
    },
  });

  const rojosMarrones = await prisma.colorGroup.create({
    data: {
      name: "ROJOS Y MARRONES",
      sortOrder: 4,
    },
  });

  const rojosMarronesAperlados = await prisma.colorGroup.create({
    data: {
      name: "ROJOS Y MARRONES APERLADOS",
      sortOrder: 5,
    },
  });

  // Create igualacion lines - CODIGOS REALES (266 productos)
  console.log("🎨 Cargando códigos de igualación...");
  
  const igualacionCodes = [
    { code: '42P-CUS', description: 'IMRON POLIURETANO 42P SEGUN MUESTRA 16L' },
    { code: '42P-G', description: 'IMRON 42P POLIURETANO SEGUN MUESTRA 4L' },
    { code: '80P205-CUS', description: 'PROCOR HP PU70 ESM. POL. IGUALADO 16L' },
    { code: '80P205-L', description: 'PROCOR HP PU70 ESM. POL. IGUALADO S/M 1L' },
    { code: 'BCRYL100', description: 'BIKAPA CROMACRYL REGULARES 20L' },
    { code: 'BCRYL101', description: 'BIKAPA CROMACRYL REGULARES 4L' },
    { code: 'BCRYL102', description: 'BIKAPA CROMACRYL REGULARES 1L' },
    { code: 'BCRYL103', description: 'BIKAPA CROMACRYL REGULARES .500L' },
    { code: 'BCRYL104', description: 'BIKAPA CROMACRYL REGULARES .250L' },
    { code: 'BCRYL200', description: 'BIKAPA CROMACRYL ORGANICO 20L' },
    { code: 'BCRYL201', description: 'BIKAPA CROMACRYL ORGANICO 4L' },
    { code: 'BCRYL202', description: 'BIKAPA CROMACRYL ORGANICO 1L' },
    { code: 'BCRYL203', description: 'BIKAPA CROMACRYL ORGANICO .500L' },
    { code: 'BCRYL204', description: 'BIKAPA CROMACRYL ORGANICO .250L' },
    { code: 'BCRYL205', description: 'BIKAPA CROMACRYL ORGANICO 125L' },
    { code: 'BCRYL300', description: 'BIKAPA CROMACRYL ORG. APERLADO 20L' },
    { code: 'BCRYL301', description: 'BIKAPA CROMACRYL ORG. APERLADO 4L' },
    { code: 'BCRYL302', description: 'BIKAPA CROMACRYL ORG. APERLADO 1L' },
    { code: 'BCRYL303', description: 'BIKAPA CROMACRYL ORG. APERLADO .500L' },
    { code: 'BCRYL304', description: 'BIKAPA CROMACRYL ORG. APERLADO .250L' },
    { code: 'BCRYL400', description: 'BIKAPA CROMACRYL ROJOS Y MARRONES 20L' },
    { code: 'BCRYL401', description: 'BIKAPA CROMACRYL ROJOS Y MARRONES 4L' },
    { code: 'BCRYL402', description: 'BIKAPA CROMACRYL ROJOS Y MARRONES 1L' },
    { code: 'BCRYL403', description: 'BIKAPA CROMACRYL ROJOS Y MARRONES .500L' },
    { code: 'BCRYL404', description: 'BIKAPA CROMACRYL ROJOS Y MARRONES .250L' },
    { code: 'BCRYL500', description: 'BIKAPA CROMACRYL MARRONES APERL. 20L' },
    { code: 'BCRYL501', description: 'BIKAPA CROMACRYL MARRONES APERL 4L' },
    { code: 'BCRYL502', description: 'BIKAPA CROMACRYL  MARRONES APERL. 1L' },
    { code: 'BCRYL503', description: 'BIKAPA CROMACRYL MARRONES APERL .500L' },
    { code: 'BCRYL504', description: 'BIKAPA CROMACRYL MARRONES APERL .250L' },
    { code: 'ECRYL100', description: 'ESM.CROMACRYL REGULAR 19L' },
    { code: 'ECRYL101', description: 'ESM.CROMACRYL REGULAR 4L' },
    { code: 'ECRYL102', description: 'ESM.CROMACRYL REGULAR 1L' },
    { code: 'ECRYL103', description: 'ESM.CROMACRYL REGULAR .500L' },
    { code: 'ECRYL104', description: 'ESM.CROMACRYL REGULAR .250L' },
    { code: 'ECRYL200', description: 'ESM.CROMACRYL ORGANICO 19L' },
    { code: 'ECRYL201', description: 'ESM.CROMACRYL ORGANICO 4L' },
    { code: 'ECRYL202', description: 'ESM.CROMACRYL ORGANICO 1L' },
    { code: 'ECRYL203', description: 'ESM.CROMACRYL ORGANICO .500L' },
    { code: 'ECRYL204', description: 'ESM.CROMACRYL ORGANICO .250L' },
    { code: 'ECRYL300', description: 'ESM.CROMACRYL ORG.APERLADOS 19L' },
    { code: 'ECRYL301', description: 'ESM.CROMACRYL ORG.APERLADOS 4L' },
    { code: 'ECRYL302', description: 'ESM.CROMACRYL ORG.APERLADOS 1L' },
    { code: 'ECRYL303', description: 'ESM.CROMACRYL ORG.APERLADOS .500L' },
    { code: 'ECRYL304', description: 'ESM.CROMACRYL ORG.APERLADOS .250L' },
    { code: 'ECRYL400', description: 'ESM.CROMACRYL ROJOS Y MARRONES 19L' },
    { code: 'ECRYL401', description: 'ESM.CROMACRYL ROJOS Y MARRONES 4L' },
    { code: 'ECRYL402', description: 'ESM.CROMACRYL ROJOS Y MARRONES 1L' },
    { code: 'ECRYL403', description: 'ESM.CROMACRYL ROJOS Y MARRONES .500L' },
    { code: 'ECRYL404', description: 'ESM.CROMACRYL ROJOS Y MARRONES .250L' },
    { code: 'EIMRON100', description: 'ESM POLIURETANO IMRON REGULAR 20L' },
    { code: 'EIMRON101', description: 'ESM POLIURETANO IMRON REGULAR 4L' },
    { code: 'EIMRON102', description: 'ESM POLIURETANO IMRON REGULAR 1L' },
    { code: 'EIMRON103', description: 'ESM POLIURETANO IMRON REGULAR .500L' },
    { code: 'EIMRON104', description: 'ESM POLIURETANO IMRON REGULAR .250L' },
    { code: 'EIMRON200', description: 'ESM POLIURETANO IMRON ORGANICO 20L' },
    { code: 'EIMRON201', description: 'ESM POLIURETANO IMRON ORGANICO 4L' },
    { code: 'EIMRON202', description: 'ESM POLIURETANO IMRON ORGANICO 1L' },
    { code: 'EIMRON203', description: 'ESM POLIURETANO IMRON ORGANICO .500L' },
    { code: 'EIMRON204', description: 'ESM POLIURETANO IMRON ORGANICO .250L' },
    { code: 'EIMRON300', description: 'ESM POLIURETANO IMRON ROJOS Y MARR 20L' },
    { code: 'EIMRON301', description: 'ESM POLIURETANO IMRON ROJOS Y MARR 4L' },
    { code: 'EIMRON302', description: 'ESM POLIURETANO IMRON ROJOS Y MARR 1L' },
    { code: 'EIMRON303', description: 'ESM POLIURETANO IMRON ROJOS Y MARR .500L' },
    { code: 'EIMRON304', description: 'ESM POLIURETANO IMRON ROJOS Y MARR .250L' },
    { code: 'EIMRONELT-L', description: 'ESM.IMRON ELITE 1L' },
    { code: 'EULTRA-CU', description: 'EULTRA ESM. ULTRA RAPIDO REG y ORG 19L' },
    { code: 'EULTRA-L', description: 'ESM.ULTRARAPIDO REGULAR y ORG  1L' },
    { code: 'IMLARAC100', description: 'ESM.ACRILICO IMLAR REGULARES4 L' },
    { code: 'IMLARAC101', description: 'ESM.ACRILICO IMLAR REGEGULARES 1 L' },
    { code: 'IMLARAC102', description: 'ESM.ACRILICO IMLAR REGULARES .500 L' },
    { code: 'IMLARAC103', description: 'ESM.ACRILICO IMLAR REGANICO .250 L' },
    { code: 'IMLARAC200', description: 'ESM.ACRILICO IMLAR ORGANICO 4 L' },
    { code: 'IMLARAC201', description: 'ESM.ACRILICO IMLAR ORGANICO 1 L' },
    { code: 'IMLARAC202', description: 'ESM.ACRILICO IMLAR ORGANICO .500 L' },
    { code: 'IMLARAC203', description: 'ESM.ACRILICO IMLAR ORGANICO .250 L' },
    { code: 'IMLARAC300', description: 'ESM.ACRILICO IMLAR ROJOS 4 L' },
    { code: 'IMLARAC301', description: 'ESM.ACRILICO IMLAR ROJOS 1 L' },
    { code: 'IMLARAC302', description: 'ESM.ACRILICO IMLAR ROJOS .500 L' },
    { code: 'IMLARAC303', description: 'ESM.ACRILICO IMLAR ROJOS .250 L' },
    { code: 'IMLARAC400', description: 'ESM.ACRILICO IMLAR ESP Y MARRONES 4 L' },
    { code: 'IMLARAC401', description: 'ESM.ACRILICO IMLAR ESP Y MARRONES 1 L' },
    { code: 'IMLARAC402', description: 'ESM.ACRILICO IMLAR ESP Y MARRONES .500L' },
    { code: 'IMLARAC403', description: 'ESM.ACRILICO IMLAR ESP Y MARRONES .250L' },
    { code: 'NBA002-CU', description: 'NOVOPERMO NBA B1 (IGUALADO PASTELES) 19L' },
    { code: 'NBA002-G', description: 'NOVOPERMO NBA B1 (IGUALADO PASTELES) 4L' },
    { code: 'NBA002-L', description: 'NOVOPERMO NBA B1 (IGUALADO PASTELES) 1L' },
    { code: 'NBA003-CU', description: 'NOVOPERMO NBA B2 (IGUALADO CLAROS) 19L' },
    { code: 'NBA003-G', description: 'NOVOPERMO NBA B2 (IGUALADO CLAROS) 4L' },
    { code: 'NBA003-L', description: 'NOVOPERMO NBA B2 (IGUALADO CLAROS) 1L' },
    { code: 'NBA004-CU', description: 'NOVOPERMO NBA B3 (IGUALADO OBSCUROS) 19L' },
    { code: 'NBA004-G', description: 'NOVOPERMO NBA B3 (IGUALADO OBSCUROS) 4L' },
    { code: 'NBA004-L', description: 'NOVOPERMO NBA B3 (IGUALADO OBSCUROS) 1L' },
    { code: 'PIMLAR100', description: 'ESM.IMLAR POLIURETANO REGULAR 19L' },
    { code: 'PIMLAR101', description: 'ESM.IMLAR POLIURETANO REGULAR 4 LTO' },
    { code: 'PIMLAR102', description: 'ESM.IMLAR POLIURETANO REGULAR 1L' },
    { code: 'PIMLAR103', description: 'ESM.IMLAR POLIURETANO REGULAR .500L' },
    { code: 'PIMLAR104', description: 'ESM.IMLAR POLIURETANO REGULAR.250L' },
    { code: 'PIMLAR200', description: 'ESM.IMLAR POLIURETANO ORGANICO 19L' },
    { code: 'PIMLAR201', description: 'ESM.IMLAR POLIURETANO ORGANICO 4 LTO' },
    { code: 'PIMLAR202', description: 'ESM.IMLAR POLIURETANO ORGANICO 1L' },
    { code: 'PIMLAR203', description: 'ESM.IMLAR POLIURETANO ORGANICO .500L' },
    { code: 'PIMLAR204', description: 'ESM.IMLAR POLIURET.ORGANICO.250L' },
    { code: 'PIMLAR300', description: 'ESM.IMLAR POLIURETANO R.Y MARR.20L' },
    { code: 'PIMLAR301', description: 'ESM.IMLAR POLIURETANO R.Y MARR.4 LTO' },
    { code: 'PIMLAR302', description: 'ESM.IMLAR POLIURETANO R.Y MARR.1L' },
    { code: 'PIMLAR303', description: 'ESM.IMLAR POLIURETANO R.Y MARR.500L' },
    { code: 'PIMLAR304', description: 'ESM.IMLAR POLIUR.R.Y MARR.250L' },
    { code: 'PIMLAR400', description: 'ESM.IMLAR POLIURETANO MAR Y VIO 20 L' },
    { code: 'PIMLAR401', description: 'ESM.IMLAR POLIURETANO MARR Y VIO 4 L' },
    { code: 'PIMLAR402', description: 'ESM.IMLAR POLIURETANO MARR Y VIO 1 L' },
    { code: 'PIMLAR403', description: 'ESM.IMLAR POLIURETNO MAR Y VIO .500L' },
    { code: 'PIMLAR404', description: 'ESM.IMLAR POLIURETANO MAR Y VIO .250L' },
    { code: 'SPIESB100', description: 'SPIES HECKER BC REGULAR 4L.' },
    { code: 'SPIESB101', description: 'SPIES HECKER BC REGULAR 1L' },
    { code: 'SPIESB102', description: 'SPIES HECKER BC REGULAR  .500L' },
    { code: 'SPIESB103', description: 'SPIES HECKER BC REGULAR .250L' },
    { code: 'SPIESB200', description: 'SPIES HECKER BC ORGANICO 4L' },
    { code: 'SPIESB201', description: 'SPIES HECKER BC ORGANICO 1L' },
    { code: 'SPIESB202', description: 'SPIES HECKER BC ORGANICO .500L.' },
    { code: 'SPIESB203', description: 'SPIES HECKER BC ORGANICO .250L' },
    { code: 'SPIESB300', description: 'SPIES HECKER BC ORG. APERLADOS 4L' },
    { code: 'SPIESB301', description: 'SPIES HECKER BC ORG. APERLADOS 1L' },
    { code: 'SPIESB302', description: 'SPIES HECKER BC ORG. APERLADOS .500L.' },
    { code: 'SPIESB303', description: 'SPIES HECKER BC ORG. APERLADOS.250L' },
    { code: 'SPIESB400', description: 'SPIES HECKER ROJOS Y MARR. APERL 4L' },
    { code: 'SPIESB401', description: 'SPIES HECKER ROJOS Y MARRON. APERL 1L' },
    { code: 'SPIESB402', description: 'SPIES HECKER ROJOS Y MARR. APERL .500L' },
    { code: 'SPIESB403', description: 'SPIES HECKER ROJOS Y MARR. APERL .250L' },
    { code: 'SPIESM100', description: 'SPIES HECKER MONOCAPA REGULAR 4 L' },
    { code: 'SPIESM101', description: 'SPIES HECKER MONOCAPA REGULAR  1L' },
    { code: 'SPIESM102', description: 'SPIES HECKER MONOCAPA REGULAR .500L' },
    { code: 'SPIESM103', description: 'SPIES HECKER MONOCAPA REGULAR.250L' },
    { code: 'SPIESM200', description: 'SPIES HECKER MONOCAPA ORGANICO 4 L' },
    { code: 'SPIESM201', description: 'SPIES HECKER MONOCAPA ORGANICO 1L' },
    { code: 'SPIESM202', description: 'SPIES HECKER MONOCAPA ORGANICO .500L' },
    { code: 'SPIESM203', description: 'SPIES HECKER MONOCAPA ORGANICO.250L' },
    { code: 'SPIESM300', description: 'SPIES HECKER MONOCAPA ROJOS Y MARR. 4 L' },
    { code: 'SPIESM301', description: 'SPIES HECKER MONOCAPA ROJOS Y MARR. 1L' },
    { code: 'SPIESM302', description: 'SPIES HECKER MONOCAPA ROJOS Y MARR. 500L' },
    { code: 'SPIESM303', description: 'SPIES H MONOCAPA ROJOS Y MARR.250L' },
    { code: 'SRIMLAR100', description: 'ESM.IMLAR SR REGULAR 19L' },
    { code: 'SRIMLAR101', description: 'ESM.IMLAR SR REGULAR 4L' },
    { code: 'SRIMLAR102', description: 'ESM.IMLAR SR REGULAR 1L' },
    { code: 'SRIMLAR103', description: 'ESM.IMLAR SR REGULAR .500L' },
    { code: 'SRIMLAR104', description: 'ESM.IMLAR SR REGULAR .250L' },
    { code: 'SRIMLAR200', description: 'ESM.IMLAR SR ORGANICOS 19L' },
    { code: 'SRIMLAR201', description: 'ESM.IMLAR SR ORGANICOS 4L' },
    { code: 'SRIMLAR202', description: 'ESM.IMLAR SR ORGANICOS 1L' },
    { code: 'SRIMLAR203', description: 'ESM.IMLAR SR ORGANICOS .500L' },
    { code: 'SRIMLAR204', description: 'ESM.IMLAR SR ORGANICOS .250L' },
    { code: 'SRIMLAR300', description: 'ESM.IMLAR SR ORG.APERLADO .19L' },
    { code: 'SRIMLAR301', description: 'ESM.IMLAR SR ORG.APERL. 4L' },
    { code: 'SRIMLAR302', description: 'ESM.IMLAR SR ORG.APERLADO 1L' },
    { code: 'SRIMLAR303', description: 'ESM.IMLAR SR ORG.APERLADO .500L' },
    { code: 'SRIMLAR304', description: 'ESM.IMLAR SR ORG.APERLADO .250L' },
    { code: 'SRIMLAR400', description: 'ESM.IMLAR SR ROJOS Y MARRONES 19L' },
    { code: 'SRIMLAR401', description: 'ESM.IMLAR SR ROJOS Y MARRONES 4L' },
    { code: 'SRIMLAR402', description: 'ESM.IMLAR SR ROJOS Y MARRONES 1L' },
    { code: 'SRIMLAR403', description: 'ESM.IMLAR SR ROJOS Y MARRONES .500L' },
    { code: 'SRIMLAR404', description: 'ESM.IMLAR SR ROJOS Y MARRONES .250L' },
    { code: 'SRIMLAR500', description: 'ESM.IMLAR SR MARRONES APERL. 19L' },
    { code: 'SRIMLAR501', description: 'ESM.IMLAR SR MARRONES APERL. 4L' },
    { code: 'SRIMLAR502', description: 'ESM.IMLAR SR MARRONES APERL.1L' },
    { code: 'SRIMLAR503', description: 'ESM.IMLAR SR MARRONES APERL .500L' },
    { code: 'SRIMLAR504', description: 'ESM.IMLAR SR MARRONES APERL .250L' },
    { code: 'SRNOVO100', description: 'ESM.NOVOPERMO SR REGULAR 19L' },
    { code: 'SRNOVO101', description: 'ESM.NOVOPERMO SR REGULAR 4 LTO.' },
    { code: 'SRNOVO102', description: 'ESM.NOVOPERMO SR REGULAR 1L' },
    { code: 'SRNOVO103', description: 'ESM.NOVOPERMO SR REGULAR .500L' },
    { code: 'SRNOVO104', description: 'ESM.NOVOPERMO SR REGULAR.250L' },
    { code: 'SRNOVO200', description: 'ESM.NOVOPERMO SR  IGUALADO 19L' },
    { code: 'SRNOVO201', description: 'ESM. NOVOPERMO SR  ORGANICOS  S/M 4L' },
    { code: 'SRNOVO202', description: 'ESM.NOVOPERMO SR ORG.ROJOS Y MARR.1L' },
    { code: 'SRNOVO203', description: 'ESM.NOVOPERMO SR ORG.ROJOS Y MAR.500L' },
    { code: 'SRNOVO204', description: 'ESM.NOVOPERMO SR ORG.ROJOS Y MAR.250L' },
    { code: 'VINIL100', description: 'RESINA VINIL REGULAR 4 L' },
    { code: 'VINIL101', description: 'RESINA VINIL REGULAR 1L' },
    { code: 'VINIL102', description: 'RESINA VINIL REGULAR .500L' },
    { code: 'VINIL103', description: 'RESINA VINIL REGULAR .250L' },
    { code: 'VINIL200', description: 'RESINA VINIL ORGANICO 4 L' },
    { code: 'VINIL201', description: 'RESINA VINIL ORGANICO 1L' },
    { code: 'VINIL202', description: 'RESINA VINIL ORGANICO .500L' },
    { code: 'VINIL203', description: 'RESINA VINIL ORGANICO .250L' },
    { code: 'VINIL300', description: 'RESINA VINIL ORG. APERL. Y MET. 4 L' },
    { code: 'VINIL301', description: 'RESINA VINIL ORG. APERL. Y MET. 1L' },
    { code: 'VINIL302', description: 'RESINA VINIL ORG. APERL. Y MET. 500L' },
    { code: 'VINIL303', description: 'RESINA VINIL ORG. APERL. Y MET.250L' },
    { code: 'VINIL304', description: 'RESINA VINIL ORG. APERL. Y MET. 125L' },
    { code: 'VINIL400', description: 'RESINA VINIL ROJOS Y MARRONES 4 L' },
    { code: 'VINIL401', description: 'RESINA VINIL ROJOS Y MARRONES 1L' },
    { code: 'VINIL402', description: 'RESINA VINIL ROJOS Y MARRONES .500L' },
    { code: 'VINIL403', description: 'RESINA VINIL ROJOS Y MARRONES.250L' },
    { code: 'VINIL500', description: 'RESINA VINIL MARR. APERL. Y MET. 4 L' },
    { code: 'VINIL501', description: 'RESINA VINIL MARR. APERL. Y MET. 1L' },
    { code: 'VINIL502', description: 'RESINA VINIL MARR. APERL. Y MET.500L' },
    { code: 'VINIL503', description: 'RESINA VINIL MARR. APERL. Y MET.250L' },
    { code: 'VINIL600', description: 'RESINA VINIL PLATAS Y OROS 4 L' },
    { code: 'VINIL601', description: 'RESINA VINIL PLATAS Y OROS 1L' },
    { code: 'VINIL602', description: 'RESINA VINIL PLATAS Y OROS .500L' },
    { code: 'VINIL603', description: 'RESINA VINIL PLATAS Y OROS .250L' },
    { code: 'C008-ELE', description: 'C-008-ELE MYSTERY ELEGANCE IMRON POLIURE' },
    { code: 'C007-ELE', description: 'C007-ELE COPPER PATINA ELEGANCE IMRON PO' },
    { code: 'C009-ELE', description: 'OIL RUBBED BRONZE ELEGANCE IMRON POLIURE' },
    { code: 'C010-ELE', description: 'AGED COPPER ELEGANCE IMRON POLIURETAN GL' },
    { code: 'C011-ELE', description: 'PEWTER ELEGANCE IMRON POLIURETAN GL' },
    { code: 'C001-PMM', description: 'OIL RUBBED BRONZE PREMIUM IMRON POL 4LT' },
    { code: 'C003-PMM', description: 'OXIDIZE BRONZE PREMIUM IMRON POL. GAL' },
    { code: 'C005-PMM', description: 'COPPER PATINA PREMIUM IMRON POL. GAL' },
    { code: 'C006-PMM', description: 'DARK OIL RUBBED BRONZE PREMIUM IMRON POL' },
    { code: 'C002-PMM', description: 'SAHARA NICKEL PREMIUM IMRON POLI' },
    { code: 'C004-PMM', description: 'AGED BRASS PREMIUM IMRON POL.  GAL' },
    { code: 'PU70101', description: 'PROCOR HP PU70 ESM. POLIURETANO S/M 4L' },
    { code: 'PU70100', description: 'PROCOR HP PU70 ESM. POLIURETANO S/M 16L' },
    { code: 'EPX80101', description: 'PROCOR HP EPX80 BLINDER PARA EPOXICO GAL' },
    { code: 'EPX80100', description: 'PROCOR HP EPX80 EPOXICO S/MUESTRA 18L' },
    { code: '42P101', description: 'IMRON 42P POLIURETANO SEGUN MUESTRA 4 LT' },
    { code: '42P100', description: '42P IMRON POLIURETANO SEGUN MUESTRA 16 L' },
    { code: '10P100', description: 'IMRON 10P COLORES  IGUALADOS  CUB' },
    { code: '10P101', description: 'IMRON POLIURETANO 10P S/MUESTRA 4LT' },
    { code: 'KIT-COOPER-BRZ', description: 'KIT DE COOPER BRONZE' },
    { code: '10P102-L', description: 'IMRON 10PCOLORES IGUALADOS EN LTR' },
    { code: 'EPX80102', description: 'PROCOR HP EPX80 EPOXICO S/MUESTRA' },
    { code: 'PU70102', description: 'PROCOR HP PU70 ESM. POLIURETANO S/M 1 LT' },
    { code: '613SM-CU', description: 'PRIMARIO ANTICORROSIVO VERDE OLIVO' },
    { code: '614SM-CU', description: 'REDUCTOR PARA PRIMARIO VERDE OLIVO' },
    { code: 'CENTARIFLEET201', description: 'ESM.CENTARIFLEET  ORGANICO 4L' },
    { code: 'CENTARIFLEET401', description: 'ESM.CENTARIFLEET  ROJOS Y MARRONES 4L' },
    { code: 'CENTARIFLEET100', description: 'ESM.CENTARIFLEET  REGULAR 20L' },
    { code: 'CENTARIFLEET101', description: 'ESM.CENTARIFLEET  REGULAR 4L' },
    { code: 'CENTARIFLEET102', description: 'ESM.CENTARIFLEET  REGULAR 1L' },
    { code: 'CENTARIFLEET103', description: 'ESM.CENTARIFLEET  REGULAR .500L' },
    { code: 'CENTARIFLEET104', description: 'ESM.CENTARIFLEET  REGULAR .250L' },
    { code: 'CENTARIFLEET200', description: 'ESM.CENTARIFLEET  ORGANICO 20L' },
    { code: 'CENTARIFLEET202', description: 'ESM.CENTARIFLEET  ORGANICO 1L' },
    { code: 'CENTARIFLEET203', description: 'ESM.CENTARIFLEET  ORGANICO .500L' },
    { code: 'CENTARIFLEET204', description: 'ESM.CENTARIFLEET  ORGANICO .250L' },
    { code: 'CENTARIFLEET300', description: 'ESM.CENTARIFLEET  ORG.APERLADOS 20L' },
    { code: 'CENTARIFLEET301', description: 'ESM.CENTARIFLEET  ORG.APERLADOS 4L' },
    { code: 'CENTARIFLEET302', description: 'ESM.CENTARIFLEET  ORG.APERLADOS 1L' },
    { code: 'CENTARIFLEET303', description: 'ESM.CENTARIFLEET  ORG.APERLADOS .500L' },
    { code: 'CENTARIFLEET304', description: 'ESM.CENTARIFLEET  ORG.APERLADOS .250L' },
    { code: 'CENTARIFLEET400', description: 'ESM.CENTARIFLEET  ROJOS Y MARRONES 20L' },
    { code: 'CENTARIFLEET402', description: 'ESM.CENTARIFLEET  ROJOS Y MARRONES 1L' },
    { code: 'CENTARIFLEET403', description: 'ESM.CENTARIFLEET ROJOS Y MARRONES .500L' },
    { code: 'CENTARIFLEET404', description: 'ESM.CENTARIFLEET ROJOS Y MARRONES .250L' },
    { code: 'CENTARIFLEET500', description: 'ESM.CENTARI ROJOS/MARRON PERLADOS 20L' },
    { code: 'CENTARIFLEET501', description: 'ESM.CENTARI ROJOS/MARRON PERLADOS 4L' },
    { code: 'CENTARIFLEET502', description: 'ESM.CENTARI ROJOS/MARRON PERLADOS 1L' },
    { code: 'CENTARIFLEET503', description: 'ESM.CENTARI ROJOS/MARRON PERLADOS .500L' },
    { code: 'CENTARIFLEET504', description: 'ESM.CENTARI ROJOS/MARRON PERLADOS .250L' },
    { code: 'C-GEN-101', description: 'SOLIDOS Y METALICOS GL' },
    { code: 'C-GEN-102', description: 'SOLIDOS Y METALICOS LTR' },
    { code: 'C-GEN-103', description: 'SOLIDOS Y METALICOS MED' },
    { code: 'C-GEN-104', description: 'SOLIDOS Y METALICOS QR' },
    { code: 'C-GEN-201', description: 'SOLIDOS Y METALICOS PERL GL' },
    { code: 'C-GEN-202', description: 'SOLIDOS Y METALICOS PERL LTR' },
    { code: 'C-GEN-203', description: 'SOLIDOS Y METALICOS PERL MED' },
    { code: 'C-GEN-204', description: 'SOLIDOS Y METALICOS PERL QR' },
    { code: 'EPX50100', description: 'PROCOR EPX50 EPOXICO SOBRE MUESTRA  16 l' },
    { code: 'EPX50101', description: 'PROCOR EPX50 EPOXICO SOBRE MUESTRA 4 LTS' },
    { code: 'EPX50102', description: 'PROCOR EPX50 EPOXICO SOBRE MUSTRA 1 LT' },
    { code: 'YZ098-CU', description: 'NOVOPERMO SR GRIS CLARO 19L' },
    { code: 'PUBD100', description: 'ESMALTE POLIURETANO BD S/M 19 L' },
    { code: 'PUBD102', description: 'ESMALTE POLIURETANO BD S/M 1 L' },
    { code: 'YB278-G', description: 'TRAFICO AMARILLO INSTITUCIONAL 4LT' },
    { code: 'LACAIMLAR101', description: 'LACA ACRILICA IMLAR REGULAR 4L' },
    { code: 'YC002-CU', description: 'RENZEL ANTIBATERIAL P COLORES IG CU 19 L' },
    { code: 'NOVOULTRA100', description: 'ESMALTE NOVOPERMO ULTRA REGULAR 19L' },
    { code: 'NOVOULTRA102', description: 'ESMALTE NOVOPERMO ULTRA REGULAR 1L' },
    { code: 'NOVOULTRA200', description: 'ESM.NOVOPERMO ULTRA ORGANICO Y ROJO 19L' },
    { code: 'NOVOULTRA201', description: 'ESM NOVOPRMO ULTRA ORGANICO Y ROJO  4L' },
    { code: 'NOVOULTRA300', description: 'ESM NOVOPERMO ULTRA AMARILLOS 19L' },
    { code: 'NOVOULTRA301', description: 'ESM NOVOPERMO ULTRA AMARILLOS 4L' },
    { code: 'NOVOULTRA302', description: 'ESM NOVOPERMO ULTRA AMARILLOS 1L' },
  ];

  for (let i = 0; i < igualacionCodes.length; i++) {
    await prisma.igualacionLine.create({
      data: {
        code: igualacionCodes[i].code,
        name: igualacionCodes[i].description,
        description: igualacionCodes[i].description,
        sortOrder: i + 1,
      },
    });
  }

  console.log(`✅ ${igualacionCodes.length} códigos de igualación cargados`);

  // Para compatibilidad con código antiguo, guardamos 3 referencias
  const lineComex = await prisma.igualacionLine.findUnique({ where: { code: 'BCRYL100' } });
  const lineBerel = await prisma.igualacionLine.findUnique({ where: { code: 'ECRYL100' } });
  const lineSherwin = await prisma.igualacionLine.findUnique({ where: { code: 'EIMRON100' } });

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
      group: regular,
      line: lineComex,
      source: "MOSTRADOR" as const,
      status: "PENDIENTE" as const,
      queuePosition: 1,
    },
    {
      colorName: "Rosa Pastel",
      liters: 2,
      group: organico,
      line: lineBerel,
      source: "VENTAS" as const,
      status: "PENDIENTE" as const,
      queuePosition: 2,
    },
    {
      colorName: "Azul Cielo",
      liters: 8,
      group: organicoAperlado,
      line: lineSherwin,
      source: "WHATSAPP" as const,
      status: "PENDIENTE" as const,
      queuePosition: 3,
    },
    {
      colorName: "Rojo Ferrari",
      liters: 1,
      group: rojosMarrones,
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
      group: organicoAperlado,
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
      group: rojosMarronesAperlados,
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

  // ─── Nuevo Admin: david.lopez@dyrlo.com ─────────────────
  // Usamos upsert para ser seguros en re-ejecuciones del seed
  const davidAdmin = await prisma.user.upsert({
    where: { email: "david.lopez@dyrlo.com" },
    update: {
      name: "David López",
      hashedPassword: hashPassword("dyrlo2026"),
      role: "ADMIN",
      active: true,
      locationId: location.id,
    },
    create: {
      name: "David López",
      email: "david.lopez@dyrlo.com",
      hashedPassword: hashPassword("dyrlo2026"),
      role: "ADMIN",
      active: true,
      locationId: location.id,
    },
  });

  // ─── Catálogo de Vendedores Físicos ─────────────────────
  // 6 nombres sin cuentas de sistema, usando upsert con IDs fijos
  // para evitar duplicados al re-ejecutar el seed
  const vendedoresFisicos = [
    { id: "vendedor-francis", nombre: "Francis" },
    { id: "vendedor-padilla", nombre: "Padilla" },
    { id: "vendedor-garcia",  nombre: "García" },
    { id: "vendedor-bodega",  nombre: "Bodega" },
    { id: "vendedor-eduardo", nombre: "Eduardo" },
    { id: "vendedor-tienda",  nombre: "Tienda" },
  ];

  for (const v of vendedoresFisicos) {
    await prisma.vendedor.upsert({
      where: { id: v.id },
      update: { nombre: v.nombre, activo: true },
      create: { id: v.id, nombre: v.nombre, activo: true },
    });
  }

  // Desactivar cualquier vendedor que ya no esté en el catálogo oficial
  // (no se borran para preservar referencias históricas en pedidos).
  await prisma.vendedor.updateMany({
    where: { id: { notIn: vendedoresFisicos.map((v) => v.id) } },
    data: { activo: false },
  });

  console.log("✅ Seed completed!");
  console.log("\n📋 Usuarios creados:");
  console.log("  - admin@dyrlo.com / admin123 (ADMIN)");
  console.log("  - david.lopez@dyrlo.com / dyrlo2026 (ADMIN)");
  console.log("  - facturacion@dyrlo.com / facturacion123 (FACTURACION)");
  console.log("  - igualador@dyrlo.com / dyrlo2026 (IGUALADOR)");
  console.log("  - vendedor@dyrlo.com / vendedor123 (VENDEDOR_READONLY)");
  console.log(`\n📦 ${sampleOrders.length} pedidos de ejemplo creados`);
  console.log(`🎨 5 grupos de color creados`);
  console.log(`🔧 266 códigos de igualación reales cargados`);
  console.log(`👤 1 admin adicional: david.lopez@dyrlo.com`);
  console.log(`🏪 ${vendedoresFisicos.length} vendedores físicos registrados`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
