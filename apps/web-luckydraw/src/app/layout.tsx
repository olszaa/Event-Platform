import type { Metadata } from "next";
import "@event-platform/ui/src/styles/design-system.css";
import "./luckydraw.css";

export const metadata: Metadata = {
  title: "🎰 Lucky Draw | Event Platform",
  description: "ระบบจับรางวัล Lucky Draw สำหรับแสดงผลบนจอ LED/Projector",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
