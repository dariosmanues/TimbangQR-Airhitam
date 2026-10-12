import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_4lPwUq1YHedR@ep-lingering-bird-azf5emxp-pooler.c-3.ap-southeast-1.aws.neon.tech/timbangqr?sslmode=require",
});

const MERGE_MAP = {
  61: 4,  // Berseri Cinta Raja -> LPS BERSERI CINTA RAJA
  57: 5,  // Industri Tenayan -> LPS INDUSTRI TENAYAN
  59: 13, // Mentangor -> LPS MENTANGOR
  56: 15, // Pematang Kapau -> LPS PEMATANG KAPAU
  60: 17, // Rejosari -> LPS REJOSARI
  58: 21, // Sialang Sakti -> LPS SIALANG SAKTI
};

async function executeMerge(dryRun = true) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log(`=== STARTING LPS MERGE (dryRun=${dryRun}) ===`);

    // 1. Update weighings
    for (const [dupIdStr, targetId] of Object.entries(MERGE_MAP)) {
      const dupId = Number(dupIdStr);
      const targetLps = (await client.query("SELECT name FROM lps WHERE id = $1", [targetId])).rows[0];
      const weighRes = await client.query(
        "UPDATE weighings SET lps_id = $1, lps_name = $2 WHERE lps_id = $3 RETURNING id, ticket_number",
        [targetId, targetLps.name, dupId]
      );
      if (weighRes.rowCount > 0) {
        console.log(`Updated ${weighRes.rowCount} weighings from LPS ${dupId} to ${targetId} (${targetLps.name}):`, weighRes.rows);
      }
    }

    // 2. Handle assignments
    for (const [dupIdStr, targetId] of Object.entries(MERGE_MAP)) {
      const dupId = Number(dupIdStr);
      const dupAssignments = (await client.query("SELECT * FROM vehicle_assignments WHERE lps_id = $1", [dupId])).rows;
      console.log(`\nProcessing ${dupAssignments.length} assignments for duplicate LPS ${dupId} -> target ${targetId}`);

      for (const da of dupAssignments) {
        // Find existing canonical assignment for this vehicle & target LPS
        const canonical = (await client.query(
          "SELECT * FROM vehicle_assignments WHERE vehicle_id = $1 AND lps_id = $2",
          [da.vehicle_id, targetId]
        )).rows[0];

        if (canonical) {
          // 1. Delete duplicate assignment first so it releases any primary lock
          await client.query("DELETE FROM vehicle_assignments WHERE id = $1", [da.id]);

          // 2. Demote any other primary assignment for this vehicle
          await client.query(
            "UPDATE vehicle_assignments SET is_primary = FALSE WHERE vehicle_id = $1 AND id <> $2",
            [da.vehicle_id, canonical.id]
          );

          // 3. Update canonical assignment with latest driver_name if present and ensure active & is_primary
          await client.query(
            "UPDATE vehicle_assignments SET active = TRUE, is_primary = TRUE, driver_name = COALESCE($1, driver_name) WHERE id = $2",
            [da.driver_name, canonical.id]
          );

          console.log(`  Vehicle ${da.vehicle_id}: merged dup assignment ${da.id} into canonical ${canonical.id} (tare: ${canonical.tare_kg})`);
        } else {
          // Demote any other primary assignment for this vehicle
          await client.query(
            "UPDATE vehicle_assignments SET is_primary = FALSE WHERE vehicle_id = $1 AND id <> $2",
            [da.vehicle_id, da.id]
          );

          // Re-point duplicate assignment to target LPS
          await client.query(
            "UPDATE vehicle_assignments SET lps_id = $1, is_primary = TRUE, active = TRUE WHERE id = $2",
            [targetId, da.id]
          );
          console.log(`  Vehicle ${da.vehicle_id}: repointed assignment ${da.id} to LPS ${targetId}`);
        }
      }
    }

    // 3. Delete duplicate LPS rows
    const dupIds = Object.keys(MERGE_MAP).map(Number);
    const delRes = await client.query("DELETE FROM lps WHERE id = ANY($1::int[]) RETURNING id, code, name", [dupIds]);
    console.log(`\nDeleted ${delRes.rowCount} duplicate LPS:`, delRes.rows);

    if (dryRun) {
      console.log("\n[DRY RUN] Rolling back transaction...");
      await client.query("ROLLBACK");
    } else {
      console.log("\n[COMMIT] Committing transaction...");
      await client.query("COMMIT");
      console.log("✓ Berhasil commit perubahan!");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error during merge:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

const isDryRun = process.argv[2] !== "--apply";
executeMerge(isDryRun).catch(console.error);
