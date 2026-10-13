import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { dbOne } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const vehicle = await dbOne<{ plate_number: string; plate_normalized: string; qr_token: string }>(
    "SELECT plate_number, plate_normalized, qr_token FROM vehicles WHERE id = $1",
    [Number(id)]
  );

  if (!vehicle) return new NextResponse("Armada tidak ditemukan", { status: 404 });

  // Gunakan format QR Master ARMADA Permanen: ARMADA-{plate_normalized}
  // Format ini konsisten dengan stiker fisik armada Harapan Jaya dan tidak pernah hangus.
  const cleanPlate = vehicle.plate_normalized || vehicle.plate_number.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const target = `ARMADA-${cleanPlate}`;
  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=3600",
    },
  });
}
