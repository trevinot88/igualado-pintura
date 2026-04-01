import pg from "pg";
import { createHash } from "crypto";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const res = await pool.query('SELECT email, role, active, "hashedPassword" FROM "User"');
console.log("Users in database:", JSON.stringify(res.rows, null, 2));

const expected = createHash("sha256").update("admin123").digest("hex");
console.log("\nExpected hash for admin123:", expected);
if (res.rows.length > 0) {
  const admin = res.rows.find(u => u.email === "admin@dyrlo.com");
  if (admin) {
    console.log("Stored hash:", admin.hashedPassword);
    console.log("Match:", admin.hashedPassword === expected);
  } else {
    console.log("admin@dyrlo.com NOT FOUND");
  }
}

await pool.end();
