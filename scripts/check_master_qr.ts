import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.production.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const burnedArmada = await pool.query(
    "SELECT qr_token, plate_number, ticket_number, burned_at FROM burned_qr_tokens WHERE qr_token LIKE 'ARMADA-%' OR qr_token NOT LIKE 'LPS-%'"
  );
  console.log("Non-LPS in burned_qr_tokens count:", burnedArmada.rows.length);
  console.log("Sample:", burnedArmada.rows.slice(0, 10));

  const totalVehicles = await pool.query("SELECT count(*) FROM vehicles");
  console.log("Total vehicles:", totalVehicles.rows[0].count);

  await pool.end();
}

check().catch(console.error);
