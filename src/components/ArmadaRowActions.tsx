"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, QrCode, ExternalLink } from "lucide-react";
import { downloadArmadaQrCard, type VehicleCardData } from "@/lib/qr-card-canvas";
import ArmadaQrModal from "@/components/ArmadaQrModal";

interface ArmadaRowActionsProps {
  vehicle: VehicleCardData;
}

export default function ArmadaRowActions({ vehicle }: ArmadaRowActionsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDirectDownload(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      setDownloading(true);
      await downloadArmadaQrCard(vehicle);
    } catch (err) {
      console.error("Gagal mengunduh kartu QR armada:", err);
      alert("Terjadi kesalahan saat mengunduh kartu QR.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          justifyContent: "flex-end",
          whiteSpace: "nowrap",
        }}
      >
        {/* Tombol Buka Modal Preview & Unduh */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setModalOpen(true)}
          title="Buka pratinjau dan menu unduh QR Armada"
          style={{ gap: 5 }}
        >
          <QrCode size={13} /> QR & Unduh
        </button>

        {/* Tombol Unduh Cepat 1-Klik PNG */}
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={handleDirectDownload}
          disabled={downloading}
          title="Download langsung Kartu Stiker QR PNG (Lengkap No. Plat & Nama LPS)"
          style={{ width: 34, height: 34, padding: 0 }}
        >
          <Download size={13} />
        </button>

        {/* Link ke Halaman Detail Armada */}
        <Link
          className="btn btn-secondary btn-sm"
          href={`/armada/${vehicle.id}`}
          title="Lihat detail lengkap & riwayat penimbangan armada"
        >
          Detail
        </Link>
      </div>

      {/* Modal Dialog QR Card */}
      <ArmadaQrModal
        vehicle={vehicle}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
