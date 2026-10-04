"use client";

import { useEffect, useState } from "react";

type Canned = {
  id: number;
  title: string;
  keywords: string | null;
  messageParts: string[];
  category: string;
  isAutoSuggest: boolean;
  isActive: boolean;
};

export default function CannedAdminPage() {
  const [items, setItems] = useState<Canned[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [parts, setParts] = useState("");
  const [isAutoSuggest, setIsAutoSuggest] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/canned").then((r) => r.json());
    setItems(res.canned || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCanned(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const messageParts = parts
      .split("\n---\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!title.trim() || messageParts.length === 0) {
      setError("عنوان و حداقل یک بخش پیام را وارد کنید.");
      return;
    }
    const res = await fetch("/api/admin/canned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        keywords: keywords.trim() || null,
        messageParts,
        isAutoSuggest,
        category: isAutoSuggest ? "auto" : "quick",
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "ثبت ناموفق بود");
      return;
    }
    setTitle("");
    setKeywords("");
    setParts("");
    load();
  }

  async function toggleActive(item: Canned) {
    await fetch(`/api/admin/canned/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    load();
  }

  async function deleteItem(id: number) {
    if (!confirm("حذف این پاسخ آماده؟")) return;
    await fetch(`/api/admin/canned/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">پاسخ‌های آماده و خودکار</h1>
      <p className="mt-1 text-sm text-slate-500">
        پاسخ‌هایی که برای درخواست‌های تکراری (مثل «پیامک نیومد») به‌صورت خودکار بر اساس کلمات کلیدی ارسال می‌شوند؛ این پاسخ‌ها
        باعث صرفه‌جویی در سهمیه Gemini هم می‌شوند. هر بخش پیام را می‌توانید در پیام‌های جداگانه (مثلاً راهنما + پیام اطمینان) با
        خط <code dir="ltr">---</code> از هم جدا کنید.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">افزودن پاسخ آماده</h2>
        {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form onSubmit={addCanned} className="mt-3 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان؛ مثلاً: مشکل پیامک"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="کلمات کلیدی با کاما جدا شوند؛ مثلاً: پیامک,کد تایید,sms"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            placeholder={"متن پیام اول...\n---\nمتن پیام دوم (اختیاری)..."}
            rows={4}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAutoSuggest} onChange={(e) => setIsAutoSuggest(e.target.checked)} />
            بر اساس کلمات کلیدی، به‌صورت خودکار برای کاربر ارسال شود
          </label>
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            ➕ افزودن
          </button>
        </form>
      </section>

      <section className="mt-6 space-y-3">
        {loading && <p className="text-slate-500">در حال بارگذاری...</p>}
        {!loading && items.length === 0 && <p className="text-slate-500">هنوز پاسخ آماده‌ای ثبت نشده است.</p>}
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{item.title}</p>
              <div className="flex gap-2">
                {item.isAutoSuggest && (
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">خودکار</span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.isActive ? "فعال" : "غیرفعال"}
                </span>
              </div>
            </div>
            {item.keywords && <p className="mt-1 text-xs text-slate-400">کلمات کلیدی: {item.keywords}</p>}
            <div className="mt-2 space-y-1">
              {item.messageParts.map((p, i) => (
                <p key={i} className="whitespace-pre-line rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                  {i + 1}) {p}
                </p>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => toggleActive(item)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold"
              >
                {item.isActive ? "غیرفعال کردن" : "فعال کردن"}
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
