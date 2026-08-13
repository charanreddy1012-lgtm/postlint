import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostLint — Preflight your social video",
  description:
    "Deterministic pre-publication media checks for short-form social video.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
