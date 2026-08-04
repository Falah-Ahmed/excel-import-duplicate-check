import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel Import & Duplicate Check",
  description: "Compare Excel imports against Frappe records",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
