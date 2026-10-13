import { resolveLegacyArmadaQr, parseLegacyArmadaQr } from "../src/lib/legacy-armada-qr";
import { getPool, closeDatabase } from "../src/lib/db";
import assert from "node:assert";

async function main() {
  console.log("=== Testing QR Master Armada Permanent Behavior ===");

  // 1. Test parseLegacyArmadaQr
  assert.equal(parseLegacyArmadaQr("ARMADA-BM8335QM"), "BM8335QM");
  assert.equal(parseLegacyArmadaQr("ARMADA-BM 8335 QM"), "BM8335QM");
  assert.equal(parseLegacyArmadaQr("ARMADA-BM8264QM-xyz"), "BM8264QM");
  console.log("✓ parseLegacyArmadaQr successfully parsed variants");

  // 2. Test resolveLegacyArmadaQr for BM 8335 QM
  const res8335 = await resolveLegacyArmadaQr("BM8335QM");
  assert.ok("vehicle" in res8335 || "requiresSelection" in res8335);
  console.log("✓ resolveLegacyArmadaQr for BM8335QM succeeded without rejection");

  // 3. Test resolveLegacyArmadaQr for BM 9154 TM
  const res9154 = await resolveLegacyArmadaQr("BM9154TM");
  assert.ok("vehicle" in res9154 || "requiresSelection" in res9154);
  console.log("✓ resolveLegacyArmadaQr for BM9154TM succeeded without rejection");

  // 4. Test resolveLegacyArmadaQr for a plate not in JSON master (fallback)
  const resCustom = await resolveLegacyArmadaQr("BM9999ZZ");
  assert.ok("vehicle" in resCustom);
  console.log("✓ resolveLegacyArmadaQr for unlisted plate BM9999ZZ succeeded with auto-creation/fallback");

  // 5. Test DB burned check simulation
  const pool = getPool();
  const burned = await pool.query(
    "SELECT * FROM burned_qr_tokens WHERE qr_token = 'ARMADA-BM8335QM'"
  );
  assert.equal(burned.rows.length, 0, "ARMADA-BM8335QM must NOT be burned");
  console.log("✓ burned_qr_tokens verified clean of master tokens");

  await closeDatabase();
  console.log("=== ALL PERMANENT MASTER QR TESTS PASSED ===");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
