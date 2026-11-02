"use client";

import { Printer } from "lucide-react";

export default function PrintButton({
  label = "Cetak Tiket (A4 Portrait)",
  className = "btn btn-primary no-print",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={() => window.print()}
      title="Cetak Tiket Timbangan (Format Kertas A4 Portrait)"
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <Printer size={17} /> {label}
    </button>
  );
}
