import ExcelJS from "exceljs";
import { getPool, closeDatabase } from "../src/lib/db";
import path from "path";

async function main() {
  const pool = getPool();

  const { rows: allVehicles } = await pool.query(`
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
      va.tare_kg as assignment_tare_kg
    FROM vehicles v
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.active = TRUE
    WHERE v.active = TRUE
    ORDER BY v.no_urut ASC NULLS LAST, v.id ASC
  `);

  const noTareVehicles = allVehicles.filter(
    (v) => !v.default_tare_kg || v.default_tare_kg <= 0
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TimbangQR LPS System";
  workbook.lastModifiedBy = "TimbangQR LPS System";
  workbook.created = new Date();
  workbook.modified = new Date();

  // -------------------------------------------------------------
  // SHEET 1: ARMADA TANPA TARE (14 Armada)
  // -------------------------------------------------------------
  const ws1 = workbook.addWorksheet("Armada Tanpa TARE", {
    views: [{ showGridLines: true }],
  });

  // Judul
  ws1.mergeCells("A1:J1");
  const title1 = ws1.getCell("A1");
  title1.value = "DAFTAR ARMADA LPS BELUM MEMILIKI DATA TARE (BERAT KOSONG)";
  title1.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  title1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC00000" }, // Red header for alert/missing
  };
  title1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 32;

  // Subjudul
  ws1.mergeCells("A2:J2");
  const sub1 = ws1.getCell("A2");
  sub1.value = `Lokasi: Transdepo Harapan Jaya | Update: Oktober 2026 | Total Armada Tanpa Tare: ${noTareVehicles.length} Unit`;
  sub1.font = { name: "Calibri", size: 10, italic: true };
  sub1.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 20;

  // Header Table
  const headers1 = [
    "No",
    "No. Polisi",
    "Kode Armada",
    "Jenis Armada",
    "Nama LPS",
    "Kelurahan LPS",
    "Kecamatan",
    "Nama Ketua LPS",
    "No. Izin Operasional",
    "Wilayah Kerja",
  ];

  const headerRow1 = ws1.addRow(headers1);
  headerRow1.height = 26;
  headerRow1.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F497D" }, // Dark Navy Blue
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  });

  // Data Rows Sheet 1
  noTareVehicles.forEach((v, index) => {
    const row = ws1.addRow([
      index + 1,
      v.plate_number,
      v.code,
      v.vehicle_type,
      v.nama_lps || "-",
      v.kelurahan_lps || "-",
      v.kecamatan || "-",
      v.nama_ketua_lps || "-",
      v.nomor_izin || "-",
      v.wilayah_kerja || "-",
    ]);
    row.height = 22;

    const isZebra = index % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10 };
      if (isZebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F5F9" },
        };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };

      if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNumber === 2) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFC00000" } };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // Adjust column widths
  ws1.columns = [
    { width: 6 },  // No
    { width: 16 }, // No. Polisi
    { width: 16 }, // Kode Armada
    { width: 15 }, // Jenis Armada
    { width: 26 }, // Nama LPS
    { width: 24 }, // Kelurahan LPS
    { width: 20 }, // Kecamatan
    { width: 24 }, // Nama Ketua LPS
    { width: 28 }, // No. Izin Operasional
    { width: 45 }, // Wilayah Kerja
  ];

  // -------------------------------------------------------------
  // SHEET 2: MASTER REKAP SELURUH 68 ARMADA
  // -------------------------------------------------------------
  const ws2 = workbook.addWorksheet("Master Seluruh 68 Armada", {
    views: [{ showGridLines: true }],
  });

  ws2.mergeCells("A1:K1");
  const title2 = ws2.getCell("A1");
  title2.value = "MASTER ARMADA HARAPAN JAYA & STATUS TARE (OKTOBER 2026)";
  title2.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  title2.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F497D" },
  };
  title2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 32;

  const headers2 = [
    "No",
    "No. Polisi",
    "Kode Armada",
    "Jenis Armada",
    "Nama LPS",
    "Kelurahan LPS",
    "Kecamatan",
    "Tare (kg)",
    "Status Tare",
    "No. Izin Operasional",
    "Wilayah Kerja",
  ];

  const headerRow2 = ws2.addRow(headers2);
  headerRow2.height = 26;
  headerRow2.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF366092" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  });

  allVehicles.forEach((v, index) => {
    const hasTare = v.default_tare_kg && v.default_tare_kg > 0;
    const tareValue = hasTare ? v.default_tare_kg : "-";
    const statusTare = hasTare ? "TERSEDIA" : "BELUM ADA TARE";

    const row = ws2.addRow([
      index + 1,
      v.plate_number,
      v.code,
      v.vehicle_type,
      v.nama_lps || "-",
      v.kelurahan_lps || "-",
      v.kecamatan || "-",
      tareValue,
      statusTare,
      v.nomor_izin || "-",
      v.wilayah_kerja || "-",
    ]);
    row.height = 22;

    const isZebra = index % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10 };
      if (isZebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };

      if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNumber === 2) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Calibri", size: 10, bold: true };
      } else if (colNumber === 8) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (colNumber === 9) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (!hasTare) {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFC00000" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFEBEE" },
          };
        } else {
          cell.font = { name: "Calibri", size: 10, color: { argb: "FF2E7D32" } };
        }
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  ws2.columns = [
    { width: 6 },  // No
    { width: 16 }, // No. Polisi
    { width: 16 }, // Kode Armada
    { width: 15 }, // Jenis Armada
    { width: 26 }, // Nama LPS
    { width: 24 }, // Kelurahan LPS
    { width: 20 }, // Kecamatan
    { width: 14 }, // Tare (kg)
    { width: 18 }, // Status Tare
    { width: 28 }, // No. Izin Operasional
    { width: 45 }, // Wilayah Kerja
  ];

  const outputPath = path.resolve(process.cwd(), "data/Daftar_Armada_Tanpa_Tare_Harapan_Jaya.xlsx");
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel file generated successfully: ${outputPath}`);

  await closeDatabase();
}

main().catch(console.error);
