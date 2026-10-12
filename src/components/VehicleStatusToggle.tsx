"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Power, Loader2, Sparkles } from "lucide-react";

interface VehicleStatusToggleProps {
  vehicleId: number;
  initialActive: boolean;
  plateNumber: string;
  code?: string;
  showLabelPrompt?: boolean;
}

export default function VehicleStatusToggle({
  vehicleId,
  initialActive,
  plateNumber,
  code,
  showLabelPrompt = true,
}: VehicleStatusToggleProps) {
  const [active, setActive] = useState(initialActive);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const targetActive = !active;

    // Optional confirmation when deactivating an active vehicle
    if (!targetActive) {
      const confirmDeactivate = window.confirm(
        `Nonaktifkan armada ${plateNumber}${code ? ` (${code})` : ""}? QR tidak akan bisa ditimbang saat nonaktif.`
      );
      if (!confirmDeactivate) return;
    }

    setLoading(true);
    setToastMessage(null);

    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: targetActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah status armada");
      }

      setActive(targetActive);
      setToastMessage(targetActive ? "Berhasil diaktifkan!" : "Dinonaktifkan");

      // Clear toast after 2.5 seconds
      setTimeout(() => setToastMessage(null), 2500);

      // Refresh server-rendered counts and lists
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={
          active
            ? `Status: Aktif (Klik untuk Menonaktifkan ${plateNumber})`
            : `Status: Nonaktif (Klik untuk Mengaktifkan ${plateNumber})`
        }
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: loading ? "wait" : "pointer",
          outline: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "transform 0.16s ease, filter 0.16s ease",
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          if (!loading) e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span
          className={`badge ${active ? "green" : "red"}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: "999px",
            fontSize: 11,
            fontWeight: 800,
            boxShadow: active
              ? "0 2px 6px rgba(8,120,79,0.18)"
              : "0 2px 6px rgba(195,61,61,0.18)",
            border: active
              ? "1px solid rgba(8,120,79,0.25)"
              : "1px solid rgba(195,61,61,0.25)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span className="dot" />
              <span>{active ? "Aktif" : "Nonaktif"}</span>
              {!active && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    marginLeft: 3,
                    padding: "2px 6px",
                    background: "var(--primary, #08784f)",
                    color: "white",
                    borderRadius: "6px",
                    fontSize: 9.5,
                    fontWeight: 900,
                    letterSpacing: "0.02em",
                  }}
                >
                  <Power size={9} /> Aktifkan
                </span>
              )}
              {active && (
                <Check
                  size={11}
                  style={{ opacity: 0.8, color: "var(--primary, #08784f)" }}
                />
              )}
            </>
          )}
        </span>
      </button>

      {/* Instant visual feedback message */}
      {toastMessage && (
        <span
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: 4,
            padding: "2px 8px",
            background: active ? "#08784f" : "#c33d3d",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 6,
            whiteSpace: "nowrap",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {toastMessage}
        </span>
      )}
    </div>
  );
}
