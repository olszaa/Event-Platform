import type { Metadata } from "next";
import "@event-platform/ui/src/styles/design-system.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin Dashboard | Event Platform",
  description: "ระบบจัดการงาน Event — Dashboard สำหรับผู้ดูแลระบบ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
