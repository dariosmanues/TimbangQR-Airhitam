import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
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

  const effectiveDriver = row.driver_name || row.assignment_driver_name || row.nama_ketua_lps || "-";
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
          size: 9.5in 11in;
          margin: 8mm 12mm 10mm 12mm;
        }

        @media print {
          html, body {
            width: 9.5in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print, .sidebar, .topbar, header, nav, aside {
            display: none !important;
          }

          .app-shell, .main, .content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: transparent !important;
          }

          .ticket-card {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: 1.5px solid #000000 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .ticket-body {
            padding: 16px 20px !important;
          }

          .ticket-kop {
            border-bottom: 3px double #000000 !important;
          }

          .ticket-table-bordered th, 
          .ticket-table-bordered td {
            border: 1px solid #000000 !important;
          }

          .ticket-netto-box {
            border: 2px solid #000000 !important;
            background: #f1f5f9 !important;
          }

          .plate-box {
            border: 2px solid #000000 !important;
            color: #000000 !important;
            background: #ffffff !important;
          }
        }

        .ticket-card {
          max-width: 820px;
          margin: 0 auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05);
        }

        .ticket-body {
          padding: 28px 32px;
        }

        .ticket-table-bordered {
          width: 100%;
          border-collapse: collapse;
          text-align: center;
        }

        .ticket-table-bordered th {
          background: #f8fafc;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 8px 6px;
          border: 1px solid #cbd5e1;
          color: #334155;
        }

        .ticket-table-bordered td {
          padding: 8px 6px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
        }

        .ticket-info-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }

        .ticket-info-table td {
          padding: 5px 8px;
          vertical-align: top;
          border-bottom: 1px dashed #e2e8f0;
        }

        .ticket-info-table tr:last-child td {
          border-bottom: none;
        }
      `}</style>

      {/* Header Halaman (Tidak dicetak) */}
      <div className="page-head no-print">
        <div>
          <Link className="muted" href="/transaksi" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <ArrowLeft size={15} /> Kembali ke daftar transaksi
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Tiket Timbang #{row.ticket_number}</h1>
            <span className="badge" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}>
              🖨️ Kertas Printer: 9.5 x 11 Inci (Continuous Form)
            </span>
            {canManage && (
              <span className="badge green" style={{ fontSize: 11 }}>
                <ShieldCheck size={12} /> AKSES EDIT & HAPUS
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Format cetak telah disesuaikan agar pas (match) dengan kertas continuous form standar 9.5 x 11 inches.
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
          <PrintButton label='Cetak Tiket (9.5 x 11")' />
        </div>
      </div>

      {/* Lembar Tiket Siap Cetak (Match 9.5 x 11 inches) */}
      <article className="ticket-card">
        <div className="ticket-body">
          {/* KOP Resmi Jembatan Timbang */}
          <div
            className="ticket-kop"
            style={{
              textAlign: "center",
              borderBottom: "3px double #1e293b",
              paddingBottom: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#475569" }}>
              PEMERINTAH KOTA PEKANBARU
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", margin: "2px 0", color: "#0f172a" }}>
              DINAS LINGKUNGAN HIDUP DAN KEBERSIHAN (DLHK)
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#047857" }}>
              UPT PENGELOLAAN SAMPAH — JEMBATAN TIMBANG TRANSDEPO AIR HITAM
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Jl. Air Hitam, Kec. Payung Sekaki, Kota Pekanbaru, Riau — Kode Pos: 28292
            </div>
          </div>

          {/* Baris Judul Tiket & Nomor Tiket */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                SURAT BUKTI TIMBANG (WEIGHING TICKET)
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", fontFamily: "monospace", letterSpacing: 0.5 }}>
                {String(row.ticket_number)}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>Waktu Timbang (WIB)</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {formatDateTime(String(row.weighed_at))}
              </div>
            </div>
          </div>

          {/* Highlight Box: Nomor Polisi & Identitas Armada */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              padding: "12px 14px",
              backgroundColor: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Nomor Polisi (Plat)</div>
              <div
                className="plate-box"
                style={{
                  display: "inline-block",
                  fontSize: 16,
                  fontWeight: 900,
                  padding: "2px 10px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  borderRadius: 4,
                  letterSpacing: 1.5,
                  marginTop: 3,
                }}
              >
                {effectivePlate}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Kode Armada & Izin DLHK</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                {row.vehicle_code || "-"}
              </div>
              {row.nomor_izin && (
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                  {row.nomor_izin}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Jenis Kendaraan</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                {String(row.vehicle_type || "PICKUP")}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Lokasi TPS Tujuan</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#047857", marginTop: 4 }}>
                TRANSDEPO AIR HITAM
              </div>
            </div>
          </div>

          {/* Tabel Informasi Rincian Operasional & Wilayah */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
            {/* Kolom Kiri: LPS & Pengemudi */}
            <table className="ticket-info-table">
              <tbody>
                <tr>
                  <td style={{ width: 130, color: "#64748b", fontWeight: 600 }}>Pengirim / LPS</td>
                  <td><strong>{String(row.lps_name || "-")}</strong></td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 600 }}>Ketua / Pengelola</td>
                  <td>{row.nama_ketua_lps || "-"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 600 }}>Nama Pengemudi</td>
                  <td><strong>{effectiveDriver}</strong></td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 600 }}>Jenis Sampah</td>
                  <td>{String(row.waste_type || "SAMPAH RUMAH TANGGA")}</td>
                </tr>
              </tbody>
            </table>

            {/* Kolom Kanan: Wilayah & Perangkat */}
            <table className="ticket-info-table">
              <tbody>
                <tr>
                  <td style={{ width: 130, color: "#64748b", fontWeight: 600 }}>Kelurahan / Kec.</td>
                  <td>
                    {row.kelurahan_lps ? `${row.kelurahan_lps} / ${row.kecamatan_lps || "-"}` : "-"}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 600 }}>Wilayah Kerja</td>
                  <td>
                    <span style={{ fontSize: 11.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {row.wilayah_kerja || "-"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 600 }}>Metode / Sumber</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>
                      {row.source === "OCR_LED" ? "Kamera OCR LED Otomatis" : (row.source || "Aplikasi")}
                    </span>
                    {row.device_code && <span style={{ fontSize: 11, color: "#64748b" }}> ({row.device_code})</span>}
                  </td>
                </tr>
                {row.source_note && (
                  <tr>
                    <td style={{ color: "#64748b", fontWeight: 600 }}>Catatan</td>
                    <td style={{ fontSize: 11.5 }}>{row.source_note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABEL RINCIAN TONASE / TIMBANGAN (Format 5 Kolom Match 9.5 x 11 Inci) */}
          <div style={{ marginBottom: 20 }}>
            <table className="ticket-table-bordered">
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>1. GROSS (KOTOR)</th>
                  <th style={{ width: "20%" }}>2. TARE (KOSONG)</th>
                  <th style={{ width: "20%" }}>3. NETTO 1</th>
                  <th style={{ width: "15%" }}>4. RAFAKSI</th>
                  <th style={{ width: "25%", backgroundColor: "#fef3c7", color: "#92400e" }}>
                    5. NETTO 2 (BERSIH)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>{formatNumber(Number(row.gross_kg))} kg</td>
                  <td style={{ fontWeight: 700 }}>{formatNumber(Number(row.tare_kg))} kg</td>
                  <td style={{ fontWeight: 700 }}>{formatNumber(Number(row.netto_1_kg))} kg</td>
                  <td>{formatNumber(Number(row.rafaksi_kg))} kg</td>
                  <td
                    className="ticket-netto-box"
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: "#047857",
                      backgroundColor: "#f0fdf4",
                      padding: "10px 4px",
                    }}
                  >
                    {formatNumber(Number(row.netto_2_kg))} kg
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "right" }}>
              * Perhitungan: Netto 1 = (Gross - Tare) | Netto 2 = (Netto 1 - Rafaksi) | Ritasi: {row.ritasi || 1}
            </div>
          </div>

          {/* Bagian Tanda Tangan (2 Kolom Seimbang) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
              marginTop: 28,
              textAlign: "center",
              pageBreakInside: "avoid",
              breakInside: "avoid",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                Pengemudi / Sopir Armada
              </div>
              <div style={{ height: 60 }} />
              <div style={{ borderTop: "1.5px solid #000000", paddingTop: 4, fontWeight: 700, fontSize: 13 }}>
                ( {effectiveDriver !== "-" ? effectiveDriver : "..................................."} )
              </div>
              <div style={{ fontSize: 10.5, color: "#64748b" }}>Tanda tangan & Nama Jelas</div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                Petugas Jembatan Timbang
              </div>
              <div style={{ height: 60 }} />
              <div style={{ borderTop: "1.5px solid #000000", paddingTop: 4, fontWeight: 700, fontSize: 13 }}>
                ( {row.creator_name || "Petugas Timbang Air Hitam"} )
              </div>
              <div style={{ fontSize: 10.5, color: "#64748b" }}>UPT Pengelolaan Sampah DLHK</div>
            </div>
          </div>

          {/* Footer Catatan Tiket & Timestamp Cetak */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 10,
              borderTop: "1px dashed #cbd5e1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "#64748b",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <div>
              Tiket ini adalah bukti sah penimbangan sampah di TPS Air Hitam Pekanbaru.
            </div>
            <div>
              Dicetak pada: {nowWib} WIB | TimbangQR Air Hitam
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
