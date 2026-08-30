import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Pretendard — KS X 1001 subset (Hangul 2350 + Latin), self-hosted via
// next/font/local so Vercel serves it from our own origin with no layout
// shift. Airbnb-style Inter was dropped when the UI moved to the
// "차곡 / 종이 플래너" design direction.
const pretendard = localFont({
  src: [
    { path: "./fonts/Pretendard-Regular.subset.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Pretendard-Medium.subset.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Pretendard-SemiBold.subset.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Pretendard-Bold.subset.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: "차곡 — 할 일 관리",
  description: "연간 계획 - 주간 계획 - 할 일을 연결하는 할 일 관리 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
