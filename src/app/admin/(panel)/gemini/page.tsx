"use client";

import { useEffect, useState } from "react";

type GeminiKey = {
  id: number;
  label: string;
  apiKey: string;
  priority: number;
  isActive: boolean;
  isExhausted: boolean;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  successCount: number;
  errorCount: number;
};

const MODEL_OPTIONS = [
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (پیشنهادی - جدید و ارزان)" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (ارزان‌تر، نسل ۳)" },
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash (قوی‌تر)" },
];

export default function GeminiAdminPage() {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [model, setModel] = useState("gemini-3.5-flash-lite");
  const [customModel, setCustomModel] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [keysRes, settingsRes] = await Promise.all([
      fetch("/api/admin/gemini-keys").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ]);
    setKeys(keysRes.keys || []);
    const m = settingsRes.settings?.gemini_model || "gemini-3.5-flash-lite";
    if (MODEL_OPTIONS.some((o) => o.value === m)) setModel(m);
    else {
      setModel("custom");
      setCustomModel(m);
    }
    setAiEnabled(settingsRes.settings?.ai_enabled !== "false");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim() || !apiKey.trim()) {
      setError("عنوان و API Key را وارد کنید.");
      return;
    }
    const res = await fetch("/api/admin/gemini-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, apiKey, priority: keys.length }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "افزودن کلید ناموفق بود");
      return;
    }
    setLabel("");
    setApiKey("");
    setMessage("کلید جدید اضافه شد ✅");
    load();
  }

  async function deleteKey(id: number) {
    if (!confirm("از حذف این کلید مطمئن هستید؟")) return;
    await fetch(`/api/admin/gemini-keys/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(key: GeminiKey) {
    await fetch(`/api/admin/gemini-keys/${key.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !key.isActive }),
    });
    load();
  }

  async function resetExhausted(key: GeminiKey) {
    await fetch(`/api/admin/gemini-keys/${key.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isExhausted: false }),
    });
    load();
  }

  async function saveModelSettings() {
    const finalModel = model === "custom" ? customModel.trim() : model;
    if (!finalModel) {
      setError("مدل را مشخص کنید.");
      return;
    }
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gemini_model: finalModel, ai_enabled: aiEnabled ? "true" : "false" }),
    });
    setMessage("تنظیمات ذخیره شد ✅");
  }

  if (loading) return <p className="text-slate-500">در حال بارگذاری...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">تنظیمات هوش مصنوعی Gemini</h1>
      <p className="mt-1 text-sm text-slate-500">
        می‌توانید چند API Key اضافه کنید؛ اگر یکی از آن‌ها به محدودیت (Quota) بخورد، ربات به‌صورت خودکار سراغ کلید بعدی می‌رود و در
        صورت اتمام همه، به‌جای نمایش خطا به کاربر، از پاسخ‌های آماده استفاده می‌کند و فقط به ادمین‌ها اطلاع می‌دهد.
      </p>

      {message && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">مدل مورد استفاده</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="custom">مدل دیگر (دستی)...</option>
          </select>
          {model === "custom" && (
            <input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="مثلاً gemini-3.1-flash-lite"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          )}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          پاسخ‌دهی خودکار با هوش مصنوعی فعال باشد
        </label>
        <button
          onClick={saveModelSettings}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
        >
          ذخیره تنظیمات مدل
        </button>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">افزودن کلید جدید</h2>
        <form onSubmit={addKey} className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="عنوان (مثلاً کلید اصلی)"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-1"
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="GEMINI_API_KEY"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-1"
          />
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            ➕ افزودن کلید
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">کلیدهای ثبت‌شده ({keys.length})</h2>
        <div className="mt-3 space-y-3">
          {keys.length === 0 && <p className="text-sm text-slate-500">هنوز کلیدی اضافه نشده است.</p>}
          {keys.map((k) => (
            <div key={k.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{k.label}</p>
                  <p className="font-mono text-xs text-slate-500">{k.apiKey}</p>
                </div>
                <div className="flex gap-2">
                  {k.isExhausted && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                      ⛔ محدود شده (Quota)
                    </span>
                  )}
                  {!k.isActive && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">غیرفعال</span>
                  )}
                  {k.isActive && !k.isExhausted && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">فعال</span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                ✅ موفق: {k.successCount} | ❌ خطا: {k.errorCount}
              </p>
              {k.lastErrorMessage && (
                <p className="mt-1 truncate text-xs text-rose-500" title={k.lastErrorMessage}>
                  آخرین خطا: {k.lastErrorMessage}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => toggleActive(k)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                >
                  {k.isActive ? "غیرفعال کردن" : "فعال کردن"}
                </button>
                {k.isExhausted && (
                  <button
                    onClick={() => resetExhausted(k)}
                    className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    بازگرداندن به چرخه
                  </button>
                )}
                <button
                  onClick={() => deleteKey(k.id)}
                  className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
