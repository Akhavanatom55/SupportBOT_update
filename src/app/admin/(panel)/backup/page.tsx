"use client";

import { useRef, useState } from "react";

export default function BackupPage() {
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleRestore() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("فایل بکاپ را انتخاب کنید.");
      return;
    }
    if (
      !confirm(
        "⚠️ هشدار: با بازیابی بکاپ، تمام اطلاعات فعلی (کاربران، تیکت‌ها، سوالات متداول، کلیدهای Gemini و...) پاک و با محتوای فایل جایگزین می‌شود. ادامه می‌دهید؟",
      )
    ) {
      return;
    }
    setRestoring(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/backup/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "بازیابی ناموفق بود");
        return;
      }
      setResult("بکاپ با موفقیت بازیابی شد ✅ صفحه را رفرش کنید.");
    } catch {
      setError("خطا در ارسال فایل");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">بکاپ‌گیری و بازیابی دیتابیس</h1>
      <p className="mt-1 text-sm text-slate-500">
        یک نسخه کامل از تمام اطلاعات (کاربران، تیکت‌ها، پیام‌ها، سوالات متداول، پاسخ‌های آماده، کلیدهای Gemini و تنظیمات) را
        به‌صورت فایل JSON دانلود یا بازیابی کنید.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">⬇️ دانلود بکاپ</h2>
        <p className="mt-1 text-sm text-slate-500">این فایل را در جای امنی نگه دارید (مثلاً گوگل درایو شخصی).</p>
        <a
          href="/api/admin/backup/export"
          className="mt-3 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          💾 دانلود فایل بکاپ کامل
        </a>
      </section>

      <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="text-lg font-bold text-rose-700">⬆️ بازیابی بکاپ</h2>
        <p className="mt-1 text-sm text-rose-700">
          اگر دیتابیس فعلی از بین رفت یا پروژه را دوباره دیپلوی کردید، با آپلود فایل بکاپ، همه چیز دقیقاً مثل قبل بازمی‌گردد. توجه:
          این عملیات اطلاعات فعلی را کاملاً جایگزین می‌کند.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="mt-3 block w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="mt-3 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {restoring ? "در حال بازیابی..." : "بازیابی از فایل بکاپ"}
        </button>
        {error && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-rose-700">{error}</p>}
        {result && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-emerald-700">{result}</p>}
      </section>
    </div>
  );
}
