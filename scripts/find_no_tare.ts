import { getPool, closeDatabase } from "../src/lib/db";
import fs from "fs";

async function main() {
  const pool = getPool();

  // 1. Ambil data kendaraan dari DB
  const { rows: vehicles } = await pool.query(`
    SELECT 
      v.id,
      v.code,
      v.no_urut,
      v.plate_number,
      v.plate_normalized,
      v.vehicle_type,
      v.nama_lps,
      v.nama_ketua_lps,
      v.kelurahan_lps,
      v.kecamatan,
      v.wilayah_kerja,
      v.default_tare_kg,
      v.active,
      v.nomor_izin,
      va.tare_kg as assignment_tare_kg,
      (SELECT tare_kg FROM weighings w WHERE w.vehicle_id = v.id ORDER BY weighed_at DESC LIMIT 1) as last_tare_from_weighing,
      (SELECT count(*)::int FROM weighings w WHERE w.vehicle_id = v.id) as weighing_count
    FROM vehicles v
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.active = TRUE
    ORDER BY v.active DESC, v.no_urut ASC NULLS LAST, v.id ASC
  `);

  console.log(`Total armada di DB: ${vehicles.length}`);

  // Armada aktif yang tidak memiliki default_tare_kg
  const activeNoTare = vehicles.filter(v => v.active && (!v.default_tare_kg || v.default_tare_kg <= 0));
  console.log(`\n=== ARMADA AKTIF TANPA DATA TARE (${activeNoTare.length} Armada) ===`);
  for (const v of activeNoTare) {
    console.log(JSON.stringify({
      no_urut: v.no_urut,
      code: v.code,
      plate_number: v.plate_number,
      vehicle_type: v.vehicle_type,
      nama_lps: v.nama_lps,
      kelurahan_lps: v.kelurahan_lps,
      kecamatan: v.kecamatan,
      wilayah_kerja: v.wilayah_kerja,
      ketua_lps: v.nama_ketua_lps,
      nomor_izin: v.nomor_izin,
      assignment_tare_kg: v.assignment_tare_kg,
      last_tare_from_weighing: v.last_tare_from_weighing,
      weighing_count: v.weighing_count
    }));
  }

  // Armada non-aktif yang tidak memiliki default_tare_kg
  const inactiveNoTare = vehicles.filter(v => !v.active && (!v.default_tare_kg || v.default_tare_kg <= 0));
  console.log(`\n=== ARMADA NON-AKTIF / HISTORIS TANPA DATA TARE (${inactiveNoTare.length} Armada) ===`);
  for (const v of inactiveNoTare) {
    console.log(JSON.stringify({
      code: v.code,
      plate_number: v.plate_number,
      vehicle_type: v.vehicle_type,
      default_tare_kg: v.default_tare_kg,
      weighing_count: v.weighing_count
    }));
  }

  // Cek apakah ada data tare di seed.json untuk armada tersebut
  const seed = JSON.parse(fs.readFileSync("data/seed.json", "utf-8"));
  console.log("\n=== CEK KETERSEDIAAN TARE DI SEED.JSON ===");
  for (const v of activeNoTare) {
    const vSeed = seed.vehicles?.find((x: any) => x.plateNormalized === v.plate_normalized);
    const aSeed = seed.assignments?.find((x: any) => x.plateNormalized === v.plate_normalized);
    const txSeed = seed.transactions?.filter((x: any) => x.plateNormalized === v.plate_normalized) || [];
    console.log(`- ${v.plate_number} (${v.plate_normalized}): inSeedVehicles=${!!vSeed} tare=${vSeed?.defaultTareKg}, inSeedAssign=${!!aSeed} tare=${aSeed?.tareKg}, seedTxCount=${txSeed.length}`);
  }

  await closeDatabase();
}

main().catch(console.error);
