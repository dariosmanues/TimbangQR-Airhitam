"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Layers,
  QrCode,
  RefreshCw,
  Save,
  Scale,
  Truck,
} from "lucide-react";
import QrScanner from "./QrScanner";
import LedWeightScanner, { type LedWeightReading } from "./LedWeightScanner";
import { useUiMode } from "./UiModeProvider";

type Assignment = {
  id: number;
  lps_id: number;
  lps_name: string;
  driver_name: string | null;
  tare_kg: number | null;
  is_primary: number;
};

type Vehicle = {
  id: number;
  code: string;
  plate_number: string;
  vehicle_type: string;
  waste_type: string;
  default_tare_kg: number | null;
  qr_token: string;
};

type VehiclePayload = {
  vehicle: Vehicle;
  assignments: Assignment[];
  lpsOptions: Array<{ id: number; name: string }>;
  source?: "LPS" | "ARMADA";
  lpsVerified?: boolean;
  masterCreated?: boolean;
};

export default function WeighingWorkspace({
  initialToken = "",
  canManualInput = false,
}: {
  initialToken?: string;
  canManualInput?: boolean;
}) {
  const { isMobileMode } = useUiMode();
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [mobileWizardMode, setMobileWizardMode] = useState(true);

  const [token, setToken] = useState(initialToken);
  const [payload, setPayload] = useState<VehiclePayload | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [armadaChoices, setArmadaChoices] = useState<Array<{ no: number; plate: string; lps: string }>>([]);
  const [message, setMessage] = useState("");
  const [ocrReading, setOcrReading] = useState<LedWeightReading | null>(null);
  const [lpsId, setLpsId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [grossKg, setGrossKg] = useState("");
  const [tareKg, setTareKg] = useState("");
  const [rafaksiKg, setRafaksiKg] = useState("0");
  const [tareSource, setTareSource] = useState("DATABASE");
  const [scannedQrToken, setScannedQrToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ticketNumber: string; netto2Kg: number } | null>(null);

  const loadVehicle = useCallback(async (nextToken: string, selectedMasterNo?: number) => {
    if (!nextToken) return;
    setLoadingVehicle(true);
    setArmadaChoices([]);
    setToken(nextToken);
    setMessage("");
    setResult(null);
    try {
      const url = `/api/qr/${encodeURIComponent(nextToken)}${selectedMasterNo ? `?masterNo=${selectedMasterNo}` : ""}`;
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "QR tidak valid");
      if (data.requiresSelection && Array.isArray(data.choices)) {
        setPayload(null);
        setArmadaChoices(data.choices);
        setMessage("QR dikenali. Nomor polisi tercatat untuk lebih dari satu LPS; pilih LPS yang sedang mengirim sampah.");
        return;
      }
      const parsed = data as VehiclePayload;
      setToken(nextToken);
      setScannedQrToken(data.qrToken || nextToken);
      setPayload(parsed);
      const primary = parsed.assignments[0];
      setLpsId(primary ? String(primary.lps_id) : "");
      setDriverName(primary?.driver_name || "");
      setTareKg(String(primary?.tare_kg ?? parsed.vehicle.default_tare_kg ?? ""));
      setMessage(parsed.source === "LPS"
        ? (parsed.masterCreated
          ? "QR LPS berhasil diverifikasi. Master armada baru terdaftar; pastikan jenis armada dan isi tare sebelum menyimpan."
          : "QR LPS berhasil diverifikasi. Armada, LPS dan pengemudi tersambung.")
        : parsed.source === "ARMADA"
          ? "QR Armada Air Hitam dikenali. Nomor polisi dan LPS terhubung; lengkapi pengemudi serta tare jika belum tersedia."
          : "✓ Data armada ditemukan & valid.");
    } catch (error) {
      setPayload(null);
      setScannedQrToken("");
      setMessage(error instanceof Error ? error.message : "Gagal membaca QR");
    } finally {
      setLoadingVehicle(false);
    }
  }, []);

  useEffect(() => {
    if (initialToken) {
      const timer = setTimeout(() => void loadVehicle(initialToken), 0);
      return () => clearTimeout(timer);
    }
  }, [initialToken, loadVehicle]);

  const handleOcrReading = useCallback((reading: LedWeightReading | null) => {
    setOcrReading(reading);
    if (reading && reading.weightKg > 0) {
      if (reading.stable || !grossKg) {
        setGrossKg(String(reading.weightKg));
      }
    }
  }, [grossKg]);

  const calculated = useMemo(() => {
    const gross = Number(grossKg || 0);
    const tare = Number(tareKg || 0);
    const rafaksi = Number(rafaksiKg || 0);
    return {
      netto1: Math.max(gross - tare, 0),
      netto2: Math.max(gross - tare - rafaksi, 0),
    };
  }, [grossKg, tareKg, rafaksiKg]);

  function chooseAssignment(value: string) {
    setLpsId(value);
    const assignment = payload?.assignments.find((item) => String(item.lps_id) === value);
    if (assignment) {
      setDriverName(assignment.driver_name || "");
      if (tareSource === "DATABASE") {
        setTareKg(String(assignment.tare_kg ?? payload?.vehicle.default_tare_kg ?? ""));
      }
    } else {
      setDriverName("");
      if (tareSource === "DATABASE") {
        setTareKg(String(payload?.vehicle.default_tare_kg ?? ""));
      }
    }
  }

  async function performSave(overrideGross?: number) {
    if (!payload) {
      setMessage("Silakan pindai QR armada terlebih dahulu.");
      return;
    }
    const currentGross = overrideGross ?? Number(grossKg);
    const currentTare = Number(tareKg || 0);
    const currentRafaksi = Number(rafaksiKg || 0);
    const netto1 = currentGross - currentTare;
    const netto2 = netto1 - currentRafaksi;

    if (!currentGross || currentGross <= 0) {
      setMessage("Nilai gross timbangan belum tersedia.");
      return;
    }
    if (!lpsId) {
      setMessage("Silakan pilih LPS / Pengirim terlebih dahulu.");
      return;
    }
    if (currentGross <= currentTare) {
      setMessage("Gross harus lebih besar daripada tare.");
      return;
    }
    if (netto2 <= 0) {
      setMessage("Netto 2 harus lebih besar daripada nol.");
      return;
    }

    setSaving(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/weighings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: payload.vehicle.id,
          lpsId: Number(lpsId),
          driverName,
          grossKg: currentGross,
          tareKg: currentTare,
          rafaksiKg: currentRafaksi,
          tareSource,
          measurementSource: "OCR_LED",
          ocrStable: true,
          indicatorRaw: ocrReading?.raw || `OCR_LED:CONFIRMED:${currentGross}`,
          qrToken: scannedQrToken || token,
        }),
      });
      const data = await response.json();
      const tokenUsed = scannedQrToken || token;
      const isMaster = /^ARMADA-/i.test(tokenUsed) || !tokenUsed.toUpperCase().startsWith("LPS-");
      setResult({ ticketNumber: data.ticketNumber, netto2Kg: data.netto2Kg });
      setMessage(
        isMaster
          ? `✓ Transaksi berhasil disimpan (Tiket #${data.ticketNumber}). QR Master Armada tetap aktif & siap digunakan kembali.`
          : `✓ Transaksi berhasil disimpan (Tiket #${data.ticketNumber}). QR Code LPS sekali pakai telah selesai.`
      );
      setScannedQrToken("");
      setToken("");
      setPayload(null);
      setGrossKg("");
      setRafaksiKg("0");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaksi gagal disimpan");
    } finally {
      setSaving(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    await performSave();
  }

  const useStepView = isMobileMode && mobileWizardMode;

  return (
    <div>
      {/* MOBILE STEP WIZARD HEADER */}
      {isMobileMode && (
        <div className="mobile-scan-stepper card" style={{ marginBottom: 14, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#08784f", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              📱 Mode Timbang Mobile
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setMobileWizardMode((prev) => !prev)}
              style={{ minHeight: 28, padding: "4px 9px", fontSize: 11 }}
            >
              <Layers size={13} />
              {mobileWizardMode ? "Tampilkan Semua" : "Mode 3 Langkah"}
            </button>
          </div>

          {mobileWizardMode && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              <button
                type="button"
                onClick={() => setMobileStep(1)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: mobileStep === 1 ? "2px solid #08784f" : "1px solid #dfe8e2",
                  background: mobileStep === 1 ? "#e7f7ef" : payload ? "#f0fdf4" : "#fff",
                  color: mobileStep === 1 ? "#08784f" : "#435249",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <QrCode size={16} />
                <span>1. Scan QR {payload ? "✓" : ""}</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileStep(2)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: mobileStep === 2 ? "2px solid #08784f" : "1px solid #dfe8e2",
                  background: mobileStep === 2 ? "#e7f7ef" : Number(grossKg) > 0 ? "#f0fdf4" : "#fff",
                  color: mobileStep === 2 ? "#08784f" : "#435249",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <Camera size={16} />
                <span>2. OCR Berat {Number(grossKg) > 0 ? "✓" : ""}</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileStep(3)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: mobileStep === 3 ? "2px solid #08784f" : "1px solid #dfe8e2",
                  background: mobileStep === 3 ? "#e7f7ef" : "#fff",
                  color: mobileStep === 3 ? "#08784f" : "#435249",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                <Scale size={16} />
                <span>3. Simpan</span>
              </button>
            </div>
          )}

          {/* Quick summary strip in mobile mode */}
          {(payload || Number(grossKg) > 0) && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 10,
                background: "#f8faf9",
                border: "1px solid #dfe8e2",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>{payload ? payload.vehicle.plate_number : "Belum Scan QR"}</strong>
                {payload && <span className="muted"> · {payload.vehicle.code}</span>}
              </div>
              <div style={{ fontWeight: 800, color: "#08784f" }}>
                Gross: {new Intl.NumberFormat("id-ID").format(Number(grossKg) || 0)} kg · Netto: {new Intl.NumberFormat("id-ID").format(calculated.netto2)} kg
              </div>
            </div>
          )}
        </div>
      )}

      <div className="scan-layout">
        {/* STEP 1: QR SCANNER */}
        <div style={{ display: !useStepView || mobileStep === 1 ? "block" : "none" }}>
          <QrScanner onToken={loadVehicle} canManualInput={canManualInput} />
          {useStepView && payload && (
            <div
              className="card"
              style={{
                marginTop: 12,
                padding: 14,
                background: "#ecfdf5",
                borderColor: "#6ee7b7",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#065f46" }}>✓ ARMADA TERHUBUNG</div>
                <strong style={{ fontSize: 15, color: "#064e3b" }}>{payload.vehicle.plate_number}</strong>
                <div style={{ fontSize: 12, color: "#047857" }}>{driverName || payload.vehicle.code}</div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setMobileStep(2)}
              >
                Lanjut OCR Berat <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* STEP 2: LED WEIGHT OCR SCANNER */}
        <div style={{ display: !useStepView || mobileStep === 2 ? "block" : "none" }}>
          <LedWeightScanner
            onReading={handleOcrReading}
            onLockWeight={(weightKg) => {
              setGrossKg(String(weightKg));
              setMessage(`✓ Angka gross ${weightKg} KG dikunci dari OCR.`);
            }}
            onSaveWeight={
              payload && lpsId
                ? (weightKg) => {
                    setGrossKg(String(weightKg));
                    void performSave(weightKg);
                  }
                : undefined
            }
            isVehicleReady={Boolean(payload && lpsId)}
          />
          {useStepView && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setMobileStep(1)} style={{ flex: 1 }}>
                <ArrowLeft size={16} /> Ke Scan QR
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setMobileStep(3)} style={{ flex: 1 }}>
                Ke Form Simpan <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* STEP 3: WEIGHING DATA & SAVE CARD */}
        <div
          className="card weighing-data-card"
          style={{ display: !useStepView || mobileStep === 3 ? "block" : "none" }}
        >
          <div className="card-head">
            <div>
              <h2>3. Data dan berat armada</h2>
              <p>Nilai Gross diambil dari pembacaan OCR LED timbangan (YOLO AI) yang sudah tepat.</p>
            </div>
            {payload && <span className="badge green"><CheckCircle2 size={13} /> QR valid</span>}
          </div>
          <div className="card-body">
            <div className="weight-display">
              <div>
                <strong>{new Intl.NumberFormat("id-ID").format(Number(grossKg) || ocrReading?.weightKg || 0)}</strong>
                <span>
                  {Number(grossKg) > 0
                    ? (ocrReading?.stable ? "OCR LED STABIL · KG" : "GROSS TERKONFIRMASI · KG")
                    : "MENUNGGU ANGKA OCR TEPAT · KG"}
                </span>
              </div>
            </div>

            <div style={{ height: 16 }} />

            {!payload ? (
              <div className="empty">
                <Truck size={38} style={{ opacity: .35 }} />
                {message && (message.includes("hangus") || message.includes("gagal") || message.includes("tidak") || message.includes("Error")) ? (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#ef4444",
                    padding: "12px 16px",
                    borderRadius: 8,
                    marginTop: 12,
                    maxWidth: 500,
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontWeight: 500,
                    textAlign: "center"
                  }}>
                    ⚠️ {message}
                  </div>
                ) : (
                  <p>{loadingVehicle ? "Memuat data armada..." : message || "Pindai QR untuk membuka data armada."}</p>
                )}
                {armadaChoices.length > 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 16, width: "100%", maxWidth: 480 }}>
                    {armadaChoices.map(choice => (
                      <button key={choice.no} className="btn btn-secondary" type="button"
                        onClick={() => void loadVehicle(token, choice.no)}>
                        {choice.plate} — {choice.lps} (Izin #{choice.no})
                      </button>
                    ))}
                  </div>
                )}
                {!loadingVehicle && token && (
                  <p style={{ marginTop: 8, fontSize: 12, overflowWrap: "anywhere", opacity: .75 }}>
                    Kode yang dikirim untuk validasi: <code>{token}</code>
                  </p>
                )}
                {useStepView && (
                  <div style={{ marginTop: 14 }}>
                    <button type="button" className="btn btn-primary" onClick={() => setMobileStep(1)}>
                      <QrCode size={16} /> Buka Kamera Scan QR
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={save}>
                <div className="summary-box">
                  <div className="summary-item"><span>No. polisi</span><strong className="plate">{payload.vehicle.plate_number}</strong></div>
                  <div className="summary-item"><span>Kode armada</span><strong>{payload.vehicle.code}</strong></div>
                  <div className="summary-item"><span>Jenis</span><strong>{payload.vehicle.vehicle_type}</strong></div>
                </div>

                <div style={{ height: 16 }} />

                <div className="form-row">
                  <div className="field">
                    <label>LPS / Pengirim</label>
                    <select className="select" value={lpsId} onChange={(e) => chooseAssignment(e.target.value)} required>
                      <option value="">Pilih LPS</option>
                      {payload.lpsOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Nama pengemudi</label>
                    <input className="input" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                  </div>
                  <div className="field">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label>Gross (kg)</label>
                      {ocrReading && ocrReading.weightKg > 0 && String(ocrReading.weightKg) !== grossKg && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setGrossKg(String(ocrReading.weightKg))}
                          style={{ fontSize: 11, padding: "2px 8px", minHeight: 24 }}
                        >
                          Pakai OCR: {ocrReading.weightKg} kg
                        </button>
                      )}
                    </div>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={grossKg}
                      onChange={(e) => setGrossKg(e.target.value)}
                      required
                    />
                    <span className="help">Diisi otomatis dari OCR LED merah (dapat diedit atau disesuaikan).</span>
                  </div>
                  <div className="field">
                    <label>Sumber tare</label>
                    <select className="select" value={tareSource} onChange={(e) => setTareSource(e.target.value)}>
                      <option value="DATABASE">Tare database armada</option>
                      <option value="ACTUAL_WEIGHING">Timbang kosong aktual</option>
                      <option value="MANUAL">Input manual</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Tare (kg)</label>
                    <input className="input" type="number" min="0" value={tareKg} onChange={(e) => setTareKg(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Rafaksi (kg)</label>
                    <input className="input" type="number" min="0" value={rafaksiKg} onChange={(e) => setRafaksiKg(e.target.value)} />
                  </div>
                </div>

                <div style={{ height: 16 }} />
                <div className="summary-box">
                  <div className="summary-item"><span>Netto 1</span><strong>{new Intl.NumberFormat("id-ID").format(calculated.netto1)} kg</strong></div>
                  <div className="summary-item"><span>Rafaksi</span><strong>{new Intl.NumberFormat("id-ID").format(Number(rafaksiKg || 0))} kg</strong></div>
                  <div className="summary-item"><span>Netto 2</span><strong>{new Intl.NumberFormat("id-ID").format(calculated.netto2)} kg</strong></div>
                </div>

                {message && <p className={message.includes("berhasil") ? "success" : "error"}>{message}</p>}
                {result && (
                  <div className="badge green" style={{ padding: 12, borderRadius: 12 }}>
                    Tiket {result.ticketNumber} tersimpan · Netto 2 {new Intl.NumberFormat("id-ID").format(result.netto2Kg)} kg
                  </div>
                )}

                <div className="sticky-actions">
                  {useStepView && (
                    <button className="btn btn-secondary" type="button" onClick={() => setMobileStep(2)}>
                      <ArrowLeft size={16} /> Kamera Berat
                    </button>
                  )}
                  <button className="btn btn-secondary" type="button" onClick={() => loadVehicle(token)}>
                    <RefreshCw size={17} /> Muat ulang
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={saving || !payload || !lpsId || Number(grossKg || 0) <= 0 || calculated.netto2 <= 0}
                    type="submit"
                  >
                    <Save size={17} /> {saving ? "Menyimpan..." : "Simpan transaksi"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
