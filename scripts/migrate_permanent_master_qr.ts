import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.production.local" });

async function migrate(connStr: string, name: string) {
  console.log(`=== Migrating ${name} ===`);
  const pool = new Pool({ connectionString: connStr });

  try {
    // 1. Hapus token QR Master Armada (ARMADA-* atau nomor plat) dari burned_qr_tokens
    // agar QR Master Armada kembali bersih dan tidak dianggap hangus
    const delRes = await pool.query(`
      DELETE FROM burned_qr_tokens
      WHERE qr_token LIKE 'ARMADA-%'
         OR qr_token LIKE 'QR-ARMADA-%'
         OR qr_token NOT LIKE 'LPS-%'
    `);
    console.log(`[${name}] Dihapus ${delRes.rowCount} token Master Armada dari burned_qr_tokens.`);

    // 2. Pastikan semua armada aktif memiliki qr_token permanen unik
    // Jika ada plat yang duplikat izin, gunakan ARMADA-{plate}-{id} agar tidak melanggar unique constraint
    const vehiclesToUpdate = await pool.query<{ id: number; plate_normalized: string; qr_token: string }>(`
      SELECT id, plate_normalized, qr_token
      FROM vehicles
      WHERE active = TRUE
        AND (qr_token IS NULL OR qr_token NOT LIKE 'ARMADA-%')
      ORDER BY id
    `);

    let updatedCount = 0;
    for (const v of vehiclesToUpdate.rows) {
      const baseToken = `ARMADA-${v.plate_normalized}`;
      // Cek apakah baseToken sudah dipakai oleh kendaraan lain
      const exists = await pool.query("SELECT id FROM vehicles WHERE qr_token = $1 AND id <> $2", [baseToken, v.id]);
      const finalToken = exists.rows.length === 0 ? baseToken : `${baseToken}-${v.id}`;
      await pool.query("UPDATE vehicles SET qr_token = $1 WHERE id = $2", [finalToken, v.id]);
      updatedCount++;
    }
    console.log(`[${name}] Diperbarui ${updatedCount} vehicles dengan qr_token permanent ARMADA-{plate}.`);

    // 3. Pastikan semua armada Harapan Jaya aktif
    const activeRes = await pool.query(`
      UPDATE vehicles
      SET active = TRUE
      WHERE code LIKE 'ARM-HJ-%'
        AND active = FALSE
    `);
    console.log(`[${name}] Diaktifkan kembali ${activeRes.rowCount} kendaraan ARM-HJ yang sebelumnya nonaktif.`);
  } catch (err) {
    console.error(`[${name}] Migration error:`, err);
  } finally {
    await pool.end();
  }
}

async function main() {
  const prodUrl = process.env.DATABASE_URL;
  if (prodUrl) {
    await migrate(prodUrl, "Production Neon DB");
  }

  // Also check local database if .env exists
  const localEnv = dotenv.config({ path: ".env" });
  const localUrl = localEnv.parsed?.DATABASE_URL;
  if (localUrl && localUrl !== prodUrl) {
    try {
      await migrate(localUrl, "Local DB");
    } catch {
      console.log("Local DB not reachable or same as prod.");
    }
  }
}

main().catch(console.error);
