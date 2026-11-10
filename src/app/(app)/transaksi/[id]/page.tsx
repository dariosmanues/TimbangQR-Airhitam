import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import TransactionDetailActions from "@/components/TransactionDetailActions";
import { getSession, canManageTransactions } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";
import { getLpsList } from "@/lib/queries";
import { formatDateTime, formatNumber, displayPlate } from "@/lib/utils";
import type { WeighingRow } from "@/lib/types";
import type { TransactionFormVehicle } from "@/components/TransactionFormModal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketData = WeighingRow & {
  device_code?: string | null;
  vehicle_code?: string | null;
  nomor_izin?: string | null;
  wilayah_kerja?: string | null;
  kelurahan_lps?: string | null;
  kecamatan_lps?: string | null;
  nama_ketua_lps?: string | null;
  assignment_driver_name?: string | null;
  creator_name?: string | null;
};

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const canManage = canManageTransactions(user);

  const { id } = await params;
  const row = await dbOne<TicketData>(`
    SELECT 
      w.*,
      d.device_code,
      v.code AS vehicle_code,
      v.nomor_izin,
      v.wilayah_kerja,
      v.kelurahan_lps,
      v.kecamatan_lps,
      v.nama_ketua_lps,
      va.driver_name AS assignment_driver_name,
      u.name AS creator_name
    FROM weighings w
    LEFT JOIN weighbridge_devices d ON d.id = w.device_id
    LEFT JOIN vehicles v ON v.id = w.vehicle_id
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.active = TRUE AND va.is_primary = TRUE
    LEFT JOIN users u ON u.id = w.created_by
    WHERE w.id = $1
  `, [Number(id)]);

  if (!row) return notFound();

  const [lpsList, vehicles] = await Promise.all([
    getLpsList(),
    canManage
      ? dbQuery<TransactionFormVehicle>(`
          SELECT id, plate_number, code, vehicle_type, waste_type, default_tare_kg, nama_lps
          FROM vehicles
          WHERE active = TRUE
          ORDER BY plate_number ASC
        `)
      : Promise.resolve([]),
  ]);

  const effectivePlate = displayPlate(row.plate_number);
  const nowWib = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <style>{`
        @page {
          size: auto;
          margin: 8mm 12mm;
        }

        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11pt !important;
            line-height: 1.45 !important;
            overflow: visible !important;
          }

          .no-print, .sidebar, .topbar, header, nav, aside, .mobile-bottom-nav {
            display: none !important;
          }

          .app-shell, .main, .content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            background: transparent !important;
            overflow: visible !important;
          }

          .simple-ticket-card {
            max-width: 440px !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 16px 20px !important;
            border: 1.5px dashed #000000 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .ticket-divider {
            border-top: 1.5px dashed #000000 !important;
            margin: 10px 0 !important;
          }

          .ticket-divider-double {
            border-top: 2px solid #000000 !important;
            margin: 10px 0 !important;
          }

          .weight-box-total {
            border-top: 1.5px solid #000000 !important;
            border-bottom: 1.5px solid #000000 !important;
          }
        }

        .simple-ticket-card {
          max-width: 460px;
          margin: 16px auto;
          background: #ffffff;
          border: 1.5px dashed #cbd5e1;
          border-radius: 12px;
          padding: 24px 26px;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
          font-family: 'Courier New', Courier, monospace;
          color: #0f172a;
          line-height: 1.5;
        }

        .ticket-divider {
          border-top: 1.5px dashed #cbd5e1;
          margin: 12px 0;
        }

        .ticket-divider-double {
          border-top: 2px solid #0f172a;
          margin: 12px 0;
        }

        .ticket-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ticket-table td {
          padding: 4px 0;
          font-size: 13.5px;
          vertical-align: top;
        }

        .ticket-label {
          width: 135px;
          color: #475569;
          font-weight: 600;
        }

        .ticket-sep {
          width: 14px;
          text-align: center;
          font-weight: 600;
        }

        .ticket-val {
          color: #0f172a;
        }

        .ticket-weight-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ticket-weight-table td {
          padding: 5px 0;
          font-size: 14px;
        }

        .weight-label {
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .weight-val {
          text-align: right;
          font-weight: 700;
          font-size: 14.5px;
        }

        .weight-box-total {
          border-top: 1.5px solid #0f172a;
          border-bottom: 1.5px solid #0f172a;
        }

        .weight-box-total td {
          padding: 8px 0;
        }

        .weight-netto2-val {
          font-size: 18px;
          font-weight: 800;
          color: #047857;
          text-align: right;
        }
      `}</style>

      {/* Header Halaman (Tidak dicetak) */}
      <div className="page-head no-print">
        <div>
          <Link
            className="muted"
            href="/transaksi"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <ArrowLeft size={15} /> Kembali ke daftar transaksi
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Tiket Timbang #{row.ticket_number}</h1>
            <span
              className="badge"
              style={{
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #a7f3d0",
              }}
            >
              📄 Format Cetak Simpel
            </span>
            {canManage && (
              <span className="badge green" style={{ fontSize: 11 }}>
                <ShieldCheck size={12} /> AKSES EDIT & HAPUS
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Format struk ringkas: Nomor Transaksi, Nama LPS, No. Plat, Gross, Tare, Netto 1, dan Netto 2.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {canManage && (
            <TransactionDetailActions
              weighing={row}
              lpsOptions={lpsList}
              vehicleOptions={vehicles}
            />
          )}
          <PrintButton label="Cetak Tiket" />
        </div>
      </div>

      {/* LEMBAR STRUK TIKET SIMPLE (MATCH PERMINTAAN USER) */}
      <article className="simple-ticket-card">
        {/* Header Sederhana */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            TIMBANGQR AIR HITAM
          </div>
          <div style={{ fontSize: 11.5, color: "#475569", letterSpacing: 1, marginTop: 2 }}>
            BUKTI PENIMBANGAN
          </div>
        </div>

        <div className="ticket-divider-double" />

        {/* Informasi Utama */}
        <table className="ticket-table">
          <tbody>
            <tr>
              <td className="ticket-label">No. Transaksi</td>
              <td className="ticket-sep">:</td>
              <td className="ticket-val" style={{ fontWeight: 700, fontSize: 15 }}>
                {row.ticket_number}
              </td>
            </tr>
            <tr>
              <td className="ticket-label">Nama LPS</td>
              <td className="ticket-sep">:</td>
              <td className="ticket-val" style={{ fontWeight: 700 }}>
                {row.lps_name || "-"}
              </td>
            </tr>
            <tr>
              <td className="ticket-label">No. Plat</td>
              <td className="ticket-sep">:</td>
              <td className="ticket-val" style={{ fontWeight: 700 }}>
                {effectivePlate}
              </td>
            </tr>
            <tr>
              <td className="ticket-label">Waktu Timbang</td>
              <td className="ticket-sep">:</td>
              <td className="ticket-val">
                {formatDateTime(String(row.weighed_at))} WIB
              </td>
            </tr>
          </tbody>
        </table>

        <div className="ticket-divider" />

        {/* Rincian Berat: Gross, Tare, Netto 1, Netto 2 */}
        <table className="ticket-weight-table">
          <tbody>
            <tr>
              <td className="weight-label">GROSS</td>
              <td style={{ width: 14, textAlign: "center" }}>:</td>
              <td className="weight-val">{formatNumber(Number(row.gross_kg))} kg</td>
            </tr>
            <tr>
              <td className="weight-label">TARE</td>
              <td style={{ width: 14, textAlign: "center" }}>:</td>
              <td className="weight-val">{formatNumber(Number(row.tare_kg))} kg</td>
            </tr>
            <tr>
              <td className="weight-label" style={{ paddingTop: 6, color: "#1e293b" }}>
                NETTO 1
              </td>
              <td style={{ width: 14, textAlign: "center", paddingTop: 6 }}>:</td>
              <td className="weight-val" style={{ paddingTop: 6, color: "#1e293b" }}>
                {formatNumber(Number(row.netto_1_kg))} kg
              </td>
            </tr>
            <tr className="weight-box-total">
              <td className="weight-label" style={{ fontSize: 15, fontWeight: 800 }}>
                NETTO 2
              </td>
              <td style={{ width: 14, textAlign: "center", fontSize: 15, fontWeight: 800 }}>:</td>
              <td className="weight-netto2-val">
                {formatNumber(Number(row.netto_2_kg))} kg
              </td>
            </tr>
          </tbody>
        </table>

        <div className="ticket-divider" />

        {/* Catatan Kaki Sangat Sederhana */}
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#64748b",
            marginTop: 4,
          }}
        >
          Dicetak: {nowWib} WIB
        </div>
      </article>
    </>
  );
}
