"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleStop,
  Cloud,
  Lock,
  PlugZap,
  RefreshCw,
  Usb,
} from "lucide-react";

type RemoteReading = {
  id?: number | string;
  device_id?: number | string;
  device_code?: string;
  weight_kg?: number;
  stable?: boolean;
  indicator_raw?: string | null;
  recorded_at?: string | null;
};

type RemoteDevice = {
  id?: number | string;
  code: string;
  device_code?: string;
  location_name?: string;
  port_name?: string | null;
  connection_type?: string;
  baud_rate?: number;
  last_seen_at?: string | null;
  active: boolean;
};

function dateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default function RemoteSerialStatusPanel({
  isSuperAdmin: initialSuperAdmin = false,
}: {
  isSuperAdmin?: boolean;
}) {
  const [reading, setReading] = useState<RemoteReading | null>(null);
  const [device, setDevice] = useState<RemoteDevice>({
    code: "TIMBANG-HJ-SERIAL-01",
    active: false, // TIDAK AKTIF OTOMATIS: HARUS MANUAL
    port_name: "COM1",
    connection_type: "RS232",
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(initialSuperAdmin);
  const [serverLastSeen, setServerLastSeen] = useState<string | null>(null);
  const [serverBridgeOnline, setServerBridgeOnline] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [now, setNow] = useState(0);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/serial/latest", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membaca data timbangan dari server.");
      setReading(data.reading || null);
      if (data.device) {
        setDevice({
          ...data.device,
          code: data.device.code || data.device.device_code || "TIMBANG-HJ-SERIAL-01",
          active: Boolean(data.device.active),
        });
      }
      setServerLastSeen(data.lastSeenAt || data.device?.last_seen_at || data.reading?.recorded_at || null);
      setServerBridgeOnline(Boolean(data.bridgeOnline));
      if (typeof data.isSuperAdmin === "boolean") {
        setIsSuperAdmin(data.isSuperAdmin);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca data timbangan dari server.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setNow(Date.now());
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh(true);
    }, 3000);
    const clock = window.setInterval(() => setNow(Date.now()), 3000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [refresh]);

  const handleControl = async (action: "connect" | "disconnect") => {
    if (!isSuperAdmin) {
      setError("Akses ditolak: Hanya user Super Admin yang berhak mengaktifkan atau memutuskan koneksi bridge.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/serial/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, device_code: device.code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Aksi kontrol bridge gagal.");
      }
      setDevice((prev) => ({ ...prev, active: action === "connect" }));
      setSuccessMessage(
        action === "connect"
          ? "Koneksi ke bridge timbangan berhasil diaktifkan secara manual oleh Super Admin."
          : "Koneksi ke bridge timbangan berhasil diputuskan oleh Super Admin."
      );
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim aksi ke server.");
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = device.active;
  const lastSeen = serverLastSeen || device.last_seen_at || reading?.recorded_at || null;
  const isFresh = useMemo(() => {
    if (!isConnected) return false;
    if (serverBridgeOnline) return true;
    if (!lastSeen) return false;
    const timestamp = Date.parse(lastSeen);
    if (Number.isNaN(timestamp)) return false;
    return now - timestamp <= 15 * 60 * 1000;
  }, [isConnected, serverBridgeOnline, lastSeen, now]);

  const weight = isConnected ? reading?.weight_kg : null;
  const raw = isConnected
    ? reading?.indicator_raw || (isFresh ? "PING_TEST (Bridge Terhubung)" : "-")
    : "Bridge Terputus (Non-Aktif)";
  const deviceCode = device.code || reading?.device_code || "TIMBANG-HJ-SERIAL-01";
  const portInfo = device.port_name
    ? `${device.port_name} (${device.connection_type || "RS232"})`
    : `COM1 (${device.connection_type || "RS232"})`;

  return (
    <div className="grid equal">
      <article className="card">
        <div className="card-head">
          <div>
            <h2>Status Bridge cloud</h2>
            <p>Status berdasarkan data terbaru yang benar-benar sudah diterima server dan tersimpan di PostgreSQL.</p>
          </div>
          {isConnected ? (
            <span className={`badge ${isFresh ? "green" : "orange"}`}>
              <span className="dot" /> {isFresh ? "Bridge online" : "Menunggu sinyal baru"}
            </span>
          ) : (
            <span className="badge red">
              <span className="dot" /> Bridge Terputus (Non-Aktif)
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="serial-status-grid">
            <div className="summary-item">
              <span>Perangkat</span>
              <strong className="small-value">{deviceCode}</strong>
            </div>
            <div className="summary-item">
              <span>Port / Mode</span>
              <strong>{portInfo}</strong>
            </div>
            <div className="summary-item">
              <span>Terakhir diterima</span>
              <strong className="small-value">{dateTime(lastSeen)}</strong>
            </div>
          </div>

          <div style={{ height: 14 }} />
          <div className="serial-note">
            <Cloud size={25} color="var(--primary)" />
            <div>
              <strong>COM dikontrol dari TimbangQR Bridge Windows</strong>
              <div className="muted">Server menerima pembacaan indikator & sinyal koneksi dari TimbangQR Bridge.</div>
              <div className="help">
                {isConnected
                  ? "Bridge saat ini AKTIF. Jika status Bridge online, jalur indikator → Bridge → Server → PostgreSQL sudah terhubung."
                  : "Bridge saat ini NON-AKTIF (tidak aktif otomatis). Pembacaan timbangan tidak akan diterima sebelum Super Admin menghubungkannya secara manual."}
              </div>
            </div>
          </div>

          {/* TOMBOL KONEKSI & DISKONEKSI MANUAL - KHUSUS SUPER ADMIN */}
          <div className="serial-actions" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {isConnected ? (
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => void handleControl("disconnect")}
                disabled={actionLoading || !isSuperAdmin}
                title={!isSuperAdmin ? "Hanya Super Admin yang dapat memutuskan koneksi bridge" : undefined}
                style={{ opacity: !isSuperAdmin ? 0.6 : 1 }}
              >
                <CircleStop size={16} /> {actionLoading ? "Memproses..." : "Putuskan Bridge"}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void handleControl("connect")}
                disabled={actionLoading || !isSuperAdmin}
                title={!isSuperAdmin ? "Hanya Super Admin yang dapat mengaktifkan koneksi bridge" : undefined}
                style={{ opacity: !isSuperAdmin ? 0.6 : 1 }}
              >
                <PlugZap size={16} /> {actionLoading ? "Memproses..." : "Koneksi ke Bridge"}
              </button>
            )}

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void refresh()}
              disabled={loading || actionLoading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} /> Perbarui sekarang
            </button>
          </div>

          {!isSuperAdmin && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#b45309",
                background: "#fef3c7",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <Lock size={14} /> Hanya user Super Admin yang dapat mengaktifkan atau memutuskan koneksi bridge.
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#15803d",
                background: "#dcfce7",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={14} /> {successMessage}
            </div>
          )}

          {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
        </div>
      </article>

      <article className="card">
        <div className="card-head">
          <div><h2>Pembacaan dari Vercel</h2><p>Nilai terbaru dari tabel device_readings.</p></div>
          <Usb size={21} />
        </div>
        <div className="card-body">
          <div className="weight-display compact-weight">
            <div>
              <strong>
                {!isConnected ? "—" : weight == null ? "—" : new Intl.NumberFormat("id-ID").format(weight)}
              </strong>
              <span>
                {!isConnected
                  ? "BRIDGE NON-AKTIF · KG"
                  : reading?.stable
                  ? "BERAT STABIL · KG"
                  : weight == null
                  ? "MENUNGGU DATA · KG"
                  : "BERAT BELUM STABIL · KG"}
              </span>
            </div>
          </div>
          <div className="field">
            <label>String mentah indikator</label>
            <div className="code serial-raw">{raw}</div>
          </div>
          <div className="help">
            Timestamp pembacaan: {dateTime(lastSeen)}
            {!isConnected && " (Bridge sedang diputus secara manual)"}
          </div>
        </div>
      </article>
    </div>
  );
}
