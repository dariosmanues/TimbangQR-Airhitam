import { Pool, PoolClient } from "pg";
import fs from "fs";

interface ExcelRow {
  no: number;
  no_urut: number;
  tps: string;
  code: string;
  plate: string;
  jenis: string;
  nama_lps: string;
  ketua: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  nomor_izin: string;
  tare: number | null;
  driver: string | null;
  phone: string | null;
}

const excelRows: ExcelRow[] = JSON.parse(
  fs.readFileSync("data/excel_updated_armada.json", "utf-8")
);

async function updateDatabase(connectionString: string, dbName: string) {
  console.log(`\n======================================================`);
  console.log(`Menjalankan Update pada Database: ${dbName}`);
  console.log(`======================================================`);

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Preload LPS map
    const lpsRows = (await client.query("SELECT id, code, name FROM lps")).rows;
    const lpsMap = new Map<string, number>();
    for (const l of lpsRows) {
      lpsMap.set(l.name.toUpperCase().trim(), l.id);
      lpsMap.set(l.name.toUpperCase().replace(/^LPS\s+/, "").trim(), l.id);
      lpsMap.set(l.code.toUpperCase().trim(), l.id);
    }

    let vehiclesUpdated = 0;
    let assignmentsUpdated = 0;
    let assignmentsCreated = 0;

    for (const item of excelRows) {
      const code = item.code?.trim();
      const nomorIzin = item.nomor_izin?.trim();
      const tare = item.tare;
      const driver = item.driver?.trim() || null;
      const ketua = item.ketua?.trim() || null;
      const kel = item.kelurahan?.trim() || null;
      const kec = item.kecamatan?.trim() || null;
      const namaLps = item.nama_lps?.trim() || null;

      // 1. Update Vehicles
      const updateVehicleRes = await client.query<{ id: number; nama_lps: string; kelurahan_lps: string }>(`
        UPDATE vehicles SET
          default_tare_kg = COALESCE($1::int, default_tare_kg),
          nama_ketua_lps = CASE WHEN $2::text IS NOT NULL AND $2::text <> '' THEN $2::text ELSE nama_ketua_lps END,
          kelurahan_lps = CASE WHEN $3::text IS NOT NULL AND $3::text <> '' THEN $3::text ELSE kelurahan_lps END,
          kecamatan_lps = CASE WHEN $4::text IS NOT NULL AND $4::text <> '' THEN $4::text ELSE kecamatan_lps END,
          updated_at = NOW()
        WHERE code = $5::text OR nomor_izin = $6::text
        RETURNING id, nama_lps, kelurahan_lps
      `, [tare, ketua, kel, kec, code, nomorIzin]);

      if (updateVehicleRes.rows.length === 0) {
        console.warn(`[WARN] Armada tidak ditemukan untuk kode: ${code}, izin: ${nomorIzin}`);
        continue;
      }

      vehiclesUpdated++;
      const vehicle = updateVehicleRes.rows[0];
      const vehicleId = vehicle.id;

      // 2. Resolve LPS ID
      const resolvedLpsName = (namaLps || vehicle.nama_lps || "").toUpperCase().trim();
      const resolvedKel = (kel || vehicle.kelurahan_lps || "").toUpperCase().trim();
      let lpsId =
        lpsMap.get(resolvedLpsName) ||
        lpsMap.get(`LPS ${resolvedLpsName}`) ||
        lpsMap.get(resolvedKel) ||
        lpsMap.get(`LPS ${resolvedKel}`);

      // If LPS not found, create new LPS entry
      if (!lpsId && resolvedLpsName) {
        const formalName = resolvedLpsName.startsWith("LPS ") ? resolvedLpsName : `LPS ${resolvedLpsName}`;
        const lpsCode = "LPS-" + formalName.replace(/^LPS\s+/, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
        const insLps = await client.query<{ id: number }>(`
          INSERT INTO lps (code, name) VALUES ($1, $2)
          ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [lpsCode, formalName]);
        lpsId = insLps.rows[0].id;
        lpsMap.set(resolvedLpsName, lpsId);
        lpsMap.set(formalName, lpsId);
      }

      // 3. Update or Insert vehicle_assignments
      const existingAssign = await client.query<{ id: number; driver_name: string; tare_kg: number }>(`
        SELECT id, driver_name, tare_kg
        FROM vehicle_assignments
        WHERE vehicle_id = $1
        ORDER BY is_primary DESC, id ASC
        LIMIT 1
      `, [vehicleId]);

      if (existingAssign.rows.length > 0) {
        const assignId = existingAssign.rows[0].id;
        await client.query(`
          UPDATE vehicle_assignments SET
            driver_name = CASE WHEN $1::text IS NOT NULL AND $1::text <> '' THEN $1::text ELSE driver_name END,
            tare_kg = COALESCE($2::int, tare_kg),
            lps_id = COALESCE($3::int, lps_id)
          WHERE id = $4
        `, [driver, tare, lpsId, assignId]);
        assignmentsUpdated++;
      } else if (lpsId) {
        await client.query(`
          UPDATE vehicle_assignments SET is_primary = FALSE WHERE vehicle_id = $1
        `, [vehicleId]);
        await client.query(`
          INSERT INTO vehicle_assignments (vehicle_id, lps_id, driver_name, tare_kg, is_primary, active)
          VALUES ($1, $2, $3::text, $4::int, TRUE, TRUE)
          ON CONFLICT DO NOTHING
        `, [vehicleId, lpsId, driver || ketua, tare]);
        assignmentsCreated++;
      }
    }

    await client.query("COMMIT");

    console.log(`✓ Selesai update database ${dbName}:`);
    console.log(`  - Vehicles updated       : ${vehiclesUpdated}`);
    console.log(`  - Assignments updated    : ${assignmentsUpdated}`);
    console.log(`  - Assignments created    : ${assignmentsCreated}`);

    // Verification queries
    const checkStats = await client.query(`
      SELECT 
        COUNT(DISTINCT v.id)::int as total_active,
        COUNT(DISTINCT CASE WHEN v.default_tare_kg > 0 THEN v.id END)::int as with_tare,
        COUNT(DISTINCT CASE WHEN v.default_tare_kg IS NULL OR v.default_tare_kg = 0 THEN v.id END)::int as no_tare,
        COUNT(DISTINCT CASE WHEN va.driver_name IS NOT NULL AND TRIM(va.driver_name) <> '' THEN v.id END)::int as with_driver,
        COUNT(DISTINCT CASE WHEN va.driver_name IS NULL OR TRIM(va.driver_name) = '' THEN v.id END)::int as no_driver,
        COUNT(DISTINCT CASE WHEN v.nama_ketua_lps IS NOT NULL AND TRIM(v.nama_ketua_lps) <> '' AND v.nama_ketua_lps <> '-' THEN v.id END)::int as with_ketua_lps
      FROM vehicles v
      LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.active = TRUE
      WHERE v.active = TRUE
    `);
    console.log("\nStatistik Akhir Kelengkapan Data:");
    console.table(checkStats.rows);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Gagal update database ${dbName}:`, err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function updateJsonFiles() {
  console.log(`\n======================================================`);
  console.log(`Memperbarui File Master JSON`);
  console.log(`======================================================`);

  const excelMap = new Map<string, ExcelRow>();
  for (const r of excelRows) {
    if (r.code) excelMap.set(r.code, r);
    if (r.nomor_izin) excelMap.set(r.nomor_izin, r);
  }

  // 1. Update data/master_armada_air_hitam_palas_216_okt2026.json
  const palasAhPath = "data/master_armada_air_hitam_palas_216_okt2026.json";
  if (fs.existsSync(palasAhPath)) {
    const palasAhData = JSON.parse(fs.readFileSync(palasAhPath, "utf-8"));
    let updatedCount = 0;
    for (const item of palasAhData) {
      const match = excelMap.get(item.code) || excelMap.get(item.nomor_izin);
      if (match) {
        if (match.tare) item.default_tare_kg = match.tare;
        if (match.driver) item.driver_name = match.driver;
        if (match.ketua && match.ketua !== "-") item.nama_ketua_lps = match.ketua;
        if (match.kelurahan) item.kelurahan_lps = match.kelurahan;
        if (match.kecamatan) item.kecamatan_lps = match.kecamatan;
        updatedCount++;
      }
    }
    fs.writeFileSync(palasAhPath, JSON.stringify(palasAhData, null, 2), "utf-8");
    console.log(`✓ Berhasil memperbarui ${updatedCount} entri di ${palasAhPath}`);
  }

  // 2. Update data/master_armada_pekanbaru_285_okt2026.json
  const master285Path = "data/master_armada_pekanbaru_285_okt2026.json";
  if (fs.existsSync(master285Path)) {
    const master285Data = JSON.parse(fs.readFileSync(master285Path, "utf-8"));
    let updated285Count = 0;
    for (const item of master285Data) {
      const match = excelMap.get(item.nomor_izin);
      if (match) {
        if (match.tare) item.default_tare_kg = match.tare;
        if (match.driver) item.driver_name = match.driver;
        if (match.ketua && match.ketua !== "-") item.nama_ketua_lps = match.ketua;
        if (match.kelurahan) item.kelurahan_lps = match.kelurahan;
        if (match.kecamatan) item.kecamatan_lps = match.kecamatan;
        updated285Count++;
      }
    }
    fs.writeFileSync(master285Path, JSON.stringify(master285Data, null, 2), "utf-8");
    console.log(`✓ Berhasil memperbarui ${updated285Count} entri di ${master285Path}`);
  }
}

async function main() {
  const neonUrl =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_4lPwUq1YHedR@ep-lingering-bird-azf5emxp.c-3.ap-southeast-1.aws.neon.tech/timbangqr_airhitam?sslmode=require";

  const localUrl =
    process.env.LOCAL_DATABASE_URL ||
    "postgresql://timbangqr:timbangqr_local_2026@localhost:5432/timbangqr";

  // 1. Update JSON files
  await updateJsonFiles();

  // 2. Update Neon Production DB
  await updateDatabase(neonUrl, "Neon Production (timbangqr_airhitam)");

  // 3. Update Local DB
  try {
    await updateDatabase(localUrl, "Local PostgreSQL (timbangqr)");
  } catch (err: any) {
    console.warn("[INFO] Local DB update skipped or failed:", err.message);
  }

  console.log("\n🎉 SELURUH PROSES UPDATE MASTER DATA ARMADA SELESAI!");
}

main().catch(console.error);
