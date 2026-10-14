"use client";

import QRCode from "qrcode";
import { displayPlate, formatNumber, normalizePlate } from "@/lib/utils";
import type { VehicleRow } from "@/lib/types";

export type VehicleCardData = Partial<VehicleRow> & {
  id: number;
  plate_number: string;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

/**
 * Menghasilkan gambar kartu identitas resmi Master Armada lengkap dengan
 * nomor plat, nama LPS, legalitas, dan QR Code High-Resolution (960 x 1320 piksel).
 */
export async function generateArmadaQrCardCanvas(
  vehicle: VehicleCardData
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const width = 960;
  const height = 1320;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gagal menginisialisasi Canvas 2D");

  const cleanPlate =
    vehicle.plate_normalized || normalizePlate(vehicle.plate_number);
  const targetToken = `ARMADA-${cleanPlate}`;
  const formattedPlate = displayPlate(vehicle.plate_number);

  // 1. Latar Belakang Kartu Putih Bersih
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // 2. Bingkai Luar Kartu dengan Sudut Melengkung
  const cardX = 24;
  const cardY = 24;
  const cardW = width - 48;
  const cardH = height - 48;
  const cardRadius = 26;

  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.clip();

  // Background dalam kartu
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // 3. Header Resmi DLHK & TPS Harapan Jaya
  const headerHeight = 175;
  const headerGrad = ctx.createLinearGradient(0, cardY, width, cardY + headerHeight);
  headerGrad.addColorStop(0, "#064e3b");
  headerGrad.addColorStop(1, "#0d8a56");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(cardX, cardY, cardW, headerHeight);

  // Garis aksen emas/hijau terang di pucuk kartu
  ctx.fillStyle = "#34d399";
  ctx.fillRect(cardX, cardY, cardW, 6);

  // Teks Header 1 (Pemerintah/DLHK)
  ctx.textAlign = "center";
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "bold 15px Inter, Arial, sans-serif";
  ctx.fillText("DINAS LINGKUNGAN HIDUP DAN KEBERSIHAN KOTA PEKANBARU", width / 2, cardY + 45);

  // Teks Header 2 (TPS Harapan Jaya)
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 32px Inter, Arial, sans-serif";
  ctx.fillText("TPS WILAYAH HARAPAN JAYA", width / 2, cardY + 86);

  // Badge Header Pill
  const pillW = 460;
  const pillH = 34;
  const pillX = (width - pillW) / 2;
  const pillY = cardY + 104;
  ctx.fillStyle = "#043224";
  roundRect(ctx, pillX, pillY, pillW, pillH, 17);
  ctx.fill();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ecfdf5";
  ctx.font = "bold 14px Inter, Arial, sans-serif";
  ctx.fillText("★ KARTU IDENTITAS RESMI MASTER ARMADA ★", width / 2, pillY + 22);

  // 4. Hero Nomor Polisi (Plat Kendaraan)
  const plateBoxY = cardY + headerHeight + 20;
  const plateBoxH = 112;
  const plateBoxW = cardW - 48;
  const plateBoxX = cardX + 24;

  ctx.fillStyle = "#f8faf9";
  roundRect(ctx, plateBoxX, plateBoxY, plateBoxW, plateBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tulisan Plat Nomor Besar
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 54px Inter, Arial, sans-serif";
  ctx.fillText(formattedPlate, width / 2, plateBoxY + 62);

  // Sub-informasi di dalam kotak plat
  ctx.font = "bold 15px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillStyle = "#047857";
  const codeText = vehicle.code || targetToken;
  ctx.fillText(codeText, width / 2 - 120, plateBoxY + 95);

  ctx.font = "bold 14px Inter, Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  const jenisText = `[ ${vehicle.vehicle_type || "ARMADA RESMI"} ]`;
  ctx.fillText(jenisText, width / 2 + 130, plateBoxY + 95);

  // 5. Kotak QR Code
  const qrBoxSize = 380;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = plateBoxY + plateBoxH + 20;

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Generate QR Code Image
  const qrDataUrl = await QRCode.toDataURL(targetToken, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 350,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });

  // Gambar QR Code di tengah kotak
  ctx.drawImage(qrImg, qrBoxX + 15, qrBoxY + 15, 350, 350);

  // Teks Token di bawah QR Code
  const textBelowQrY = qrBoxY + qrBoxSize + 22;
  ctx.fillStyle = "#065f3e";
  ctx.font = "900 18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`TOKEN: ${targetToken}`, width / 2, textBelowQrY);

  ctx.fillStyle = "#059669";
  ctx.font = "bold 13px Inter, Arial, sans-serif";
  ctx.fillText(
    "✓ QR MASTER PERMANEN · SIAP TIMBANG TANPA BATAS WAKTU",
    width / 2,
    textBelowQrY + 22
  );

  // 6. Grid Data Informasi & Legalitas LPS ("lengkap dengan nomor plat & nama LPS")
  const infoBoxY = textBelowQrY + 36;
  const infoBoxW = cardW - 48;
  const infoBoxH = 260;
  const infoBoxX = cardX + 24;

  ctx.fillStyle = "#f6faf7";
  roundRect(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = "#cde4d7";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header kecil informasi
  const infoHeadH = 36;
  ctx.fillStyle = "#e6f4ec";
  ctx.beginPath();
  ctx.moveTo(infoBoxX + 18, infoBoxY);
  ctx.lineTo(infoBoxX + infoBoxW - 18, infoBoxY);
  ctx.arcTo(infoBoxX + infoBoxW, infoBoxY, infoBoxX + infoBoxW, infoBoxY + 18, 18);
  ctx.lineTo(infoBoxX + infoBoxW, infoBoxY + infoHeadH);
  ctx.lineTo(infoBoxX, infoBoxY + infoHeadH);
  ctx.lineTo(infoBoxX, infoBoxY + 18);
  ctx.arcTo(infoBoxX, infoBoxY, infoBoxX + 18, infoBoxY, 18);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "#065f3e";
  ctx.font = "800 13px Inter, Arial, sans-serif";
  ctx.fillText("DATA LEGALITAS & PENUGASAN LPS", infoBoxX + 20, infoBoxY + 23);

  if (vehicle.no_urut) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#047857";
    ctx.font = "900 13px Inter, Arial, sans-serif";
    ctx.fillText(`NO. URUT: ${vehicle.no_urut}`, infoBoxX + infoBoxW - 20, infoBoxY + 23);
  }

  // Isi baris informasi (2 Kolom)
  const col1X = infoBoxX + 24;
  const col2X = infoBoxX + infoBoxW / 2 + 10;
  const maxColWidth = infoBoxW / 2 - 34;

  // Baris 1: Nama LPS & Tare Acuan
  const row1Y = infoBoxY + infoHeadH + 28;
  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 11px Inter, Arial, sans-serif";
  ctx.fillText("NAMA LPS / PENGELOLA", col1X, row1Y);
  ctx.fillText("TARE ACUAN KENDARAAN", col2X, row1Y);

  const lpsName = vehicle.nama_lps || vehicle.lps_names || "LPS TPS Harapan Jaya";
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 19px Inter, Arial, sans-serif";
  ctx.fillText(truncateText(ctx, lpsName, maxColWidth), col1X, row1Y + 22);

  ctx.fillStyle = "#047857";
  ctx.font = "900 19px Inter, Arial, sans-serif";
  const tareText = vehicle.default_tare_kg ? `${formatNumber(vehicle.default_tare_kg)} kg` : "-";
  ctx.fillText(tareText, col2X, row1Y + 22);

  // Baris 2: Ketua LPS & Kelurahan
  const row2Y = row1Y + 54;
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 11px Inter, Arial, sans-serif";
  ctx.fillText("KETUA LPS / PENANGGUNG JAWAB", col1X, row2Y);
  ctx.fillText("KELURAHAN / KECAMATAN", col2X, row2Y);

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 15px Inter, Arial, sans-serif";
  ctx.fillText(truncateText(ctx, vehicle.nama_ketua_lps || "-", maxColWidth), col1X, row2Y + 20);

  const kelText = `${vehicle.kelurahan_lps || "-"} / ${vehicle.kecamatan_lps || vehicle.kecamatan || "-"}`;
  ctx.fillText(truncateText(ctx, kelText, maxColWidth), col2X, row2Y + 20);

  // Baris 3: Nomor Izin & Wilayah Kerja
  const row3Y = row2Y + 52;
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 11px Inter, Arial, sans-serif";
  ctx.fillText("NOMOR IZIN OPERASIONAL", col1X, row3Y);
  ctx.fillText("WILAYAH KERJA OPERASIONAL", col2X, row3Y);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(truncateText(ctx, vehicle.nomor_izin || "-", maxColWidth), col1X, row3Y + 20);

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 14px Inter, Arial, sans-serif";
  ctx.fillText(truncateText(ctx, vehicle.wilayah_kerja || "Wilayah Harapan Jaya", maxColWidth), col2X, row3Y + 20);

  // Baris 4: Lokasi Transdepo / TPS
  const row4Y = row3Y + 48;
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 11px Inter, Arial, sans-serif";
  ctx.fillText("LOKASI TRANSDEPO / JEMBATAN TIMBANG", col1X, row4Y);

  ctx.fillStyle = "#065f3e";
  ctx.font = "bold 14px Inter, Arial, sans-serif";
  ctx.fillText(vehicle.lokasi_tps || "TPS WILAYAH HARAPAN JAYA", col1X, row4Y + 18);

  // 7. Footer Verifikasi Resmi
  const footerH = 92;
  const footerY = cardY + cardH - footerH;
  ctx.fillStyle = "#064e3b";
  ctx.fillRect(cardX, footerY, cardW, footerH);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Inter, Arial, sans-serif";
  ctx.fillText(
    "✓ TERVERIFIKASI & TERDAFTAR RESMI DI SISTEM TIMBANG DLHK KOTA PEKANBARU",
    width / 2,
    footerY + 30
  );

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "500 12px Inter, Arial, sans-serif";
  ctx.fillText(
    "Tempelkan kartu ini pada dashboard atau kaca depan armada saat memasuki jembatan timbang.",
    width / 2,
    footerY + 54
  );

  const todayStr = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(new Date());
  ctx.fillStyle = "#6ee7b7";
  ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`Dicetak: ${todayStr} · TimbangQR Harapan Jaya`, width / 2, footerY + 76);

  ctx.restore();

  // Bingkai luar border kartu
  ctx.strokeStyle = "#cde4d7";
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();

  return canvas;
}

/**
 * Download kartu QR lengkap beresolusi tinggi (format PNG)
 */
export async function downloadArmadaQrCard(
  vehicle: VehicleCardData
): Promise<void> {
  const canvas = await generateArmadaQrCardCanvas(vehicle);
  const cleanPlate =
    vehicle.plate_normalized || normalizePlate(vehicle.plate_number);
  const filename = `KARTU-QR-ARMADA-${cleanPlate}.png`;

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download QR polos resolusi tinggi (format PNG)
 */
export async function downloadRawQrPng(
  vehicle: VehicleCardData
): Promise<void> {
  const cleanPlate =
    vehicle.plate_normalized || normalizePlate(vehicle.plate_number);
  const targetToken = `ARMADA-${cleanPlate}`;
  const filename = `QR-CODE-${cleanPlate}.png`;

  const dataUrl = await QRCode.toDataURL(targetToken, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 600,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Print langsung kartu QR
 */
export async function printArmadaQrCard(
  vehicle: VehicleCardData
): Promise<void> {
  const canvas = await generateArmadaQrCardCanvas(vehicle);
  const dataUrl = canvas.toDataURL("image/png");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Pop-up browser terblokir. Izinkan pop-up untuk mencetak kartu.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cetak Kartu QR - ${vehicle.plate_number}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
            min-height: 100vh;
            font-family: Arial, sans-serif;
          }
          .card-img {
            max-width: 100%;
            max-height: 94vh;
            object-fit: contain;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            border-radius: 8px;
          }
          @media print {
            body { background: transparent; min-height: auto; }
            .card-img { max-height: 100%; box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <img class="card-img" src="${dataUrl}" alt="Kartu QR ${vehicle.plate_number}" />
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
