import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TimbangQR Air Hitam",
  description: "Sistem jembatan timbang dan QR armada LPS Transdepo Air Hitam",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
