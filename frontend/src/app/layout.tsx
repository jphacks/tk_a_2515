import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PeakSight",
  description: "登山に特化した 3D 地図アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <GoogleAnalytics gaId="G-11KFF6F5WS" />
      <body className={`${inter.className} bg-slate-50`}>{children}</body>
    </html>
  );
}
