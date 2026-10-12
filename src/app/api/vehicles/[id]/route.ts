import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";
import type { VehicleRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const vehicleId = Number(id);
  if (isNaN(vehicleId)) {
    return NextResponse.json({ error: "ID armada tidak valid." }, { status: 400 });
  }

  const vehicle = await dbOne<VehicleRow>(
    "SELECT * FROM vehicles WHERE id = $1",
    [vehicleId]
  );
  if (!vehicle) {
    return NextResponse.json({ error: "Armada tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(vehicle);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const vehicleId = Number(id);
  if (isNaN(vehicleId)) {
    return NextResponse.json({ error: "ID armada tidak valid." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Determine target active status
    let nextActive: boolean | undefined = undefined;
    if (typeof body.active === "boolean") {
      nextActive = body.active;
    } else if (body.status === "active" || body.status === "Aktif") {
      nextActive = true;
    } else if (body.status === "inactive" || body.status === "Nonaktif") {
      nextActive = false;
    }

    if (nextActive === undefined) {
      return NextResponse.json(
        { error: "Field 'active' (boolean) atau 'status' ('active'/'inactive') harus disertakan." },
        { status: 400 }
      );
    }

    const existing = await dbOne<{ id: number; code: string; plate_number: string; active: boolean }>(
      "SELECT id, code, plate_number, active FROM vehicles WHERE id = $1",
      [vehicleId]
    );

    if (!existing) {
      return NextResponse.json({ error: "Armada tidak ditemukan." }, { status: 404 });
    }

    const updated = await dbOne<{ id: number; code: string; plate_number: string; active: boolean }>(`
      UPDATE vehicles
      SET active = $1
      WHERE id = $2
      RETURNING id, code, plate_number, active
    `, [nextActive, vehicleId]);

    // Audit log
    try {
      await dbQuery(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
        VALUES ($1, $2, 'VEHICLE', $3, $4::jsonb)
      `, [
        user.id,
        nextActive ? "ACTIVATE" : "DEACTIVATE",
        vehicleId,
        JSON.stringify({
          code: existing.code,
          plate_number: existing.plate_number,
          previous_active: existing.active,
          active: nextActive,
        }),
      ]);
    } catch {
      // Non-fatal if audit log fails
    }

    return NextResponse.json({
      ok: true,
      id: updated?.id,
      code: updated?.code,
      plate_number: updated?.plate_number,
      active: updated?.active,
      message: nextActive
        ? `Armada ${updated?.plate_number} berhasil diaktifkan.`
        : `Armada ${updated?.plate_number} berhasil dinonaktifkan.`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui status armada." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}
