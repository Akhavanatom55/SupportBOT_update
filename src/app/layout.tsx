import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ربات پشتیبانی هوشمند بله",
  description: "ربات پشتیبانی مشتریان با پاسخ‌دهی هوشمند Gemini برای پیام‌رسان بله، همراه با پنل مدیریت کامل.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
