import { NextResponse } from "next/server";
import { checkGreenApiStatus } from "@/lib/notifications";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.DATABASE_URL = process.env.DATABASE_URL ? "SET (" + process.env.DATABASE_URL.substring(0, 20) + "...)" : "MISSING";
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "SET" : "MISSING";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "MISSING";
  checks.NODE_ENV = process.env.NODE_ENV ?? "MISSING";
  checks.GREEN_API_INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID ? "SET" : "MISSING";
  checks.GREEN_API_TOKEN = process.env.GREEN_API_TOKEN ? "SET" : "MISSING";

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

  // Test Green API (WhatsApp) instance state
  try {
    const status = await checkGreenApiStatus();
    if (!status.configured) {
      checks.GREEN_API = "NOT_CONFIGURED";
    } else if (status.authorized) {
      checks.GREEN_API = "OK - authorized (stateInstance=" + status.stateInstance + ")";
    } else if (status.authorized === false) {
      checks.GREEN_API = "UNAUTHORIZED (stateInstance=" + (status.stateInstance ?? "unknown") + ") — reescanear QR";
    } else {
      checks.GREEN_API = "ERROR: " + (status.error ?? "desconocido");
    }
  } catch (e: unknown) {
    checks.GREEN_API = "FAILED: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(checks);
}
