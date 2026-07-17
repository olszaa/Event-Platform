import type { Metadata } from "next";
import "@event-platform/ui/src/styles/design-system.css";

export const metadata: Metadata = {
  title: "Event Registration | Event Platform",
  description: "ลงทะเบียนเข้าร่วมงาน Event — ระบบลงทะเบียนออนไลน์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
