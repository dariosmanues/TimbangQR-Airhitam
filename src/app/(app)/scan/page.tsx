import { Scale, Lock, Crown } from "lucide-react";
import WeighingWorkspace from "@/components/WeighingWorkspace";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getSession();
  const canManualInput = isSuperAdmin(user);
  const params = await searchParams;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Scan QR & penimbangan</h1>
          <p>Identifikasi armada, ambil berat indikator, dan hitung netto otomatis.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {canManualInput ? (
            <span className="badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", fontWeight: 700 }}>
              <Crown size={13} /> Hak Akses: Master ADMIN (Input Plat Manual Aktif)
            </span>
          ) : (
            <span className="badge" style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #cbd5e1" }}>
              <Lock size={13} /> Hak Akses: Administrator (Wajib Scan QR — Input Plat Dinonaktifkan)
            </span>
          )}
          <span className="badge green"><Scale size={14} /> Mode operasional</span>
        </div>
      </div>
      <WeighingWorkspace initialToken={params.token || ""} canManualInput={canManualInput} />
    </>
  );
}
