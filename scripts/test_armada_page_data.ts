import { listVehicles, getVehicleCounts } from "../src/lib/queries";
import { closeDatabase } from "../src/lib/db";

async function main() {
  const counts = await getVehicleCounts();
  console.log("Counts in DB:", counts);

  const activeVehicles = await listVehicles("", "active");
  console.log(`Semua aktif count: ${activeVehicles.length}`);

  const ahVehicles = await listVehicles("", "air_hitam");
  console.log(`Air Hitam count: ${ahVehicles.length}`);

  const palasVehicles = await listVehicles("", "palas");
  console.log(`Palas count: ${palasVehicles.length}`);

  console.log("\nSample 3 armada Palas:");
  for (const v of palasVehicles.slice(0, 3)) {
    console.log(`- ${v.no_urut} | ${v.code} | ${v.plate_number} | ${v.nomor_izin} | ${v.nama_lps} | TPS: ${v.lokasi_tps}`);
  }

  await closeDatabase();
}

main().catch(console.error);
