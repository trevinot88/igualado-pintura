import { NextResponse } from "next/server";
import { checkGreenApiStatus } from "@/lib/notifications";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.DATABASE_URL = process.env.DATABASE_URL ? "SET (" + process.env.DATABASE_URL.substring(0, 20) + "...)" : "MISSING";
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "SET" : "MISSING";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "MISSING";
  checks.NODE_ENV = process.env.NODE_ENV ?? "MISSING";

  // Test DB connection
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    const result = await pool.query("SELECT COUNT(*) as count FROM \"User\"");
    checks.DB_CONNECTION = "OK - " + result.rows[0].count + " users";
    await pool.end();
  } catch (e: unknown) {
    checks.DB_CONNECTION = "FAILED: " + (e instanceof Error ? e.message : String(e));
  }

  // Test Prisma
  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.user.count();
    checks.PRISMA = "OK - " + count + " users";
  } catch (e: unknown) {
    checks.PRISMA = "FAILED: " + (e instanceof Error ? e.message : String(e));
  }

  // Test WhatsApp (Baileys) connection state
  try {
    const status = await checkGreenApiStatus();
    if (status.connected) {
      checks.WHATSAPP = "OK - connected" + (status.user ? " (" + status.user + ")" : "");
    } else if (status.hasQr) {
      checks.WHATSAPP = "WAITING_QR — escanear código QR en /api/whatsapp/qr";
    } else {
      checks.WHATSAPP = "DISCONNECTED" + (status.error ? ": " + status.error : "");
    }
  } catch (e: unknown) {
    checks.WHATSAPP = "FAILED: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(checks);
}
