"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle, CheckCircle2, ShieldAlert, PowerOff } from "lucide-react";
import type { VehicleRow } from "@/lib/types";
import type { VehicleCardData } from "@/lib/qr-card-canvas";

interface ArmadaDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: VehicleRow | VehicleCardData | null;
  onSuccess?: () => void;
}

export default function ArmadaDeleteModal({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}: ArmadaDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !vehicle) return null;

  async function handleDelete() {
    if (!vehicle) return;
    setLoading(true);
    setError(null);
    setHasTransactions(false);

    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.hasTransactions) {
          setHasTransactions(true);
          setTransactionCount(data.count || 0);
          setError(data.error);
          return;
        }
        throw new Error(data.error || "Gagal menghapus armada.");
      }

      setSuccessMsg(data.message || "Armada berhasil dihapus.");
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivateInstead() {
    if (!vehicle) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menonaktifkan armada.");
      }

      setSuccessMsg(`Armada ${vehicle.plate_number} berhasil dinonaktifkan.`);
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status armada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 25, 18, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45)",
          border: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff5f5",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#fed7d7",
                color: "var(--danger)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AlertTriangle size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", color: "var(--danger)" }}>
                Hapus Data Armada
              </h3>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Konfirmasi penghapusan permanen</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ width: 34, height: 34, padding: 0, borderRadius: "50%" }}
            title="Tutup Modal"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body Modal */}
        <div style={{ padding: "20px 24px", display: "grid", gap: "16px" }}>
          {successMsg ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                backgroundColor: "var(--primary-soft)",
                color: "var(--primary)",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={19} />
              <span>{successMsg}</span>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text)", lineHeight: 1.5 }}>
                Apakah Anda yakin ingin menghapus data armada berikut?
              </p>

              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span className="plate" style={{ fontSize: 16 }}>{vehicle.plate_number}</span>
                  <span className="badge" style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {vehicle.code}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", display: "grid", gap: 3 }}>
                  <div>Jenis: <strong>{vehicle.vehicle_type || "PICKUP"}</strong></div>
                  <div>LPS: <strong>{vehicle.nama_lps || vehicle.lps_names || "-"}</strong></div>
                  {vehicle.nomor_izin && <div>No. Izin: <code style={{ fontSize: 11 }}>{vehicle.nomor_izin}</code></div>}
                </div>
              </div>

              {hasTransactions ? (
                <div
                  style={{
                    background: "#fff9eb",
                    border: "1px solid #fbd38d",
                    padding: "14px",
                    borderRadius: "12px",
                    color: "#744210",
                    fontSize: "13px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 700 }}>
                    <ShieldAlert size={18} style={{ color: "#d69e2e", flexShrink: 0, marginTop: 1 }} />
                    <span>Tidak Dapat Dihapus Permanen</span>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.45 }}>
                    Armada ini telah tercatat dalam <strong>{transactionCount} transaksi penimbangan</strong>.
                    Untuk menjaga keaslian laporan dan rekapitulasi tonase jembatan timbang, data armada tidak dapat dihapus permanen.
                  </p>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    Rekomendasi: Nonaktifkan armada agar tidak lagi muncul pada penimbangan aktif.
                  </p>
                </div>
              ) : error ? (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#fff0f0",
                    color: "var(--danger)",
                    borderRadius: "10px",
                    fontSize: "13px",
                  }}
                >
                  {error}
                </div>
              ) : (
                <div
                  style={{
                    background: "#fff5f5",
                    border: "1px solid #fed7d7",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    color: "var(--danger)",
                    fontSize: "12px",
                  }}
                >
                  Tindakan ini tidak dapat dibatalkan jika armada belum memiliki riwayat transaksi penimbangan.
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 8,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>

            {hasTransactions ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDeactivateInstead}
                disabled={loading}
              >
                <PowerOff size={15} />
                {loading ? "Memproses..." : "Nonaktifkan Armada Sekarang"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={loading || Boolean(successMsg)}
                style={{ backgroundColor: "#e53e3e", color: "white" }}
              >
                <Trash2 size={15} />
                {loading ? "Menghapus..." : "Hapus Permanen"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
