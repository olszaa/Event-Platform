import type { Metadata } from "next";
import "@event-platform/ui/src/styles/design-system.css";
import "./checkin.css";

export const metadata: Metadata = {
  title: "Event Check-in | Event Platform",
  description: "ระบบเช็กอินงาน Event ด้วยการสแกน QR Code",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
