import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { callSerialBridge } from "@/lib/serialBridge";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["connect", "disconnect"]),
  device_code: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pengecekan ketat: Hanya user Super Admin yang berhak mengaktifkan atau memutuskan bridge
  if (!isSuperAdmin(user)) {
    return NextResponse.json({
      error: "Akses ditolak: Hanya user Super Admin yang dapat mengaktifkan atau memutuskan koneksi bridge timbangan.",
    }, { status: 403 });
  }

  try {
    const input = schema.parse(await request.json());
    const isConnect = input.action === "connect";

    // Update status active di database
    if (input.device_code) {
      await dbQuery(
        `UPDATE weighbridge_devices SET active = $1 WHERE device_code = $2`,
        [isConnect, input.device_code]
      );
    } else {
      await dbQuery(
        `UPDATE weighbridge_devices SET active = $1`,
        [isConnect]
      );
    }

    // Jika berjalan di mode bridge lokal (bukan remote/cloud), beri sinyal juga ke local bridge process
    const isVercel = Boolean((process.env.VERCEL || "").trim());
    const bridgeMode = (process.env.SERIAL_BRIDGE_MODE || "").trim().toLowerCase();
    const isLocalBridge = !isVercel && bridgeMode !== "remote";

    let localBridgeData = null;
    if (isLocalBridge) {
      try {
        const result = await callSerialBridge(`/${input.action}`, { method: "POST", body: "{}" });
        localBridgeData = result.data;
      } catch {
        // Abaikan jika service bridge lokal belum running
      }
    }

    return NextResponse.json({
      ok: true,
      active: isConnect,
      action: input.action,
      message: isConnect
        ? "Koneksi ke bridge timbangan berhasil diaktifkan secara manual oleh Super Admin."
        : "Koneksi ke bridge timbangan berhasil diputuskan oleh Super Admin.",
      localBridge: localBridgeData,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Aksi tidak valid.",
    }, { status: 400 });
  }
}
