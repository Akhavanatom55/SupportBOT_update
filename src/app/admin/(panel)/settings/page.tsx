"use client";

import { useEffect, useState } from "react";

type Settings = Record<string, string>;

type DeploymentLinks = {
  baseUrl: string;
  panelUrl: string;
  webhookUrl: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [webhookBase, setWebhookBase] = useState("");
  const [webhookInfo, setWebhookInfo] = useState<Record<string, unknown> | null>(null);
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const [deploymentLinks, setDeploymentLinks] = useState<DeploymentLinks | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSettings(data.settings || {});
    setWebhookBase(data.settings?.public_base_url || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadWebhookInfo();
    loadDeploymentLinks();
  }, []);

  async function loadWebhookInfo() {
    const res = await fetch("/api/admin/webhook/info");
    const data = await res.json();
    if (res.ok) setWebhookInfo(data);
  }

  async function loadDeploymentLinks() {
    const res = await fetch("/api/admin/deployment/link");
    const data = await res.json();
    if (res.ok) setDeploymentLinks(data);
  }

  function set(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings || settings);
      setWebhookBase(data.settings?.public_base_url || "");
      setMessage("تنظیمات با موفقیت ذخیره شد ✅");
      await loadDeploymentLinks();
    }
  }

  async function registerWebhook() {
    setWebhookBusy(true);
    setWebhookError(null);
    const res = await fetch("/api/admin/webhook/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: webhookBase }),
    });
    const data = await res.json();
    setWebhookBusy(false);
    if (!res.ok) {
      setWebhookError(data.error || "ثبت وبهوک ناموفق بود");
      return;
    }
    await loadWebhookInfo();
    await loadDeploymentLinks();
  }

  async function removeWebhook() {
    setWebhookBusy(true);
    await fetch("/api/admin/webhook/delete", { method: "POST" });
    setWebhookBusy(false);
    await loadWebhookInfo();
  }

  async function sendPanelLink() {
    setLinkBusy(true);
    setLinkMessage(null);
    const res = await fetch("/api/admin/deployment/link", { method: "POST" });
    const data = await res.json();
    setLinkBusy(false);
    if (!res.ok) {
      setLinkMessage(data.error || "ارسال لینک ناموفق بود");
      return;
    }
    setDeploymentLinks(data);
    setLinkMessage("لینک پنل با موفقیت برای ادمین‌های بله ارسال شد ✅");
  }

  async function copyPanelLink() {
    if (!deploymentLinks?.panelUrl) return;
    try {
      await navigator.clipboard.writeText(deploymentLinks.panelUrl);
      setLinkMessage("لینک پنل کپی شد ✅");
    } catch {
      setLinkMessage("کپی خودکار در این مرورگر در دسترس نیست.");
    }
  }

  async function sendBroadcast() {
    if (!broadcastText.trim()) return;
    if (!confirm("پیام برای تمام کاربرانی که با ربات شروع کرده‌اند ارسال می‌شود. ادامه می‌دهید؟")) return;
    setBroadcastBusy(true);
    setBroadcastResult(null);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: broadcastText }),
    });
    const data = await res.json();
    setBroadcastBusy(false);
    if (res.ok) {
      setBroadcastResult(`ارسال شد: ${data.broadcast.sentCount} موفق / ${data.broadcast.failedCount} ناموفق`);
      setBroadcastText("");
    }
  }

  if (loading) return <p className="text-slate-500">در حال بارگذاری...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">تنظیمات ربات</h1>
        <p className="mt-1 text-sm text-slate-500">تمام تنظیمات اصلی ربات را بدون تغییر کد مدیریت کنید.</p>
      </div>

      <section id="panel-link" className="scroll-mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="text-lg font-bold text-indigo-900">🔗 لینک پنل مدیریت سایت</h2>
        <p className="mt-1 text-sm text-indigo-800">
          آدرس عمومی سایت دیپلوی‌شده در Deplexo از این بخش قابل مشاهده است. می‌توانید لینک را کپی کنید یا با یک کلیک برای تمام ادمین‌های بله ارسال کنید.
        </p>
        <div className="mt-4 grid gap-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              readOnly
              dir="ltr"
              value={deploymentLinks?.panelUrl || "در حال شناسایی..."}
              className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
            <button
              onClick={copyPanelLink}
              disabled={!deploymentLinks?.panelUrl}
              className="rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              📋 کپی لینک
            </button>
            <button
              onClick={sendPanelLink}
              disabled={linkBusy || !deploymentLinks?.panelUrl}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {linkBusy ? "در حال ارسال..." : "📨 ارسال لینک برای ادمین‌ها"}
            </button>
          </div>
          {deploymentLinks?.webhookUrl && (
            <p dir="ltr" className="break-all rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
              Webhook: {deploymentLinks.webhookUrl}
            </p>
          )}
          {linkMessage && <p className="rounded-xl bg-white px-3 py-2 text-sm text-indigo-800">{linkMessage}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">🔗 اتصال وبهوک بله</h2>
        <p className="mt-1 text-sm text-slate-500">
          آدرس عمومی سایت را وارد کنید تا پیام‌های بله به همین پروژه ارسال شوند.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            dir="ltr"
            value={webhookBase}
            onChange={(e) => setWebhookBase(e.target.value)}
            placeholder="https://your-domain.example.com"
            className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={registerWebhook}
            disabled={webhookBusy}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {webhookBusy ? "در حال ثبت..." : "ثبت وبهوک"}
          </button>
          <button
            onClick={removeWebhook}
            disabled={webhookBusy}
            className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            حذف وبهوک
          </button>
        </div>
        {webhookError && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{webhookError}</p>}
        {webhookInfo && (
          <pre dir="ltr" className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(webhookInfo, null, 2)}
          </pre>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">🏷 هویت و رفتار ربات</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="نام ربات" value={settings.bot_name} onChange={(v) => set("bot_name", v)} />
          <Field label="نام سازمان" value={settings.organization_name} onChange={(v) => set("organization_name", v)} />
          <Field label="شناسه گروه ادمین‌ها" value={settings.group_chat_id} onChange={(v) => set("group_chat_id", v)} />
          <Field label="ساعت بسته‌شدن خودکار تیکت بی‌فعالیت" value={settings.auto_close_hours} onChange={(v) => set("auto_close_hours", v)} />
          <Field label="مدل Gemini" value={settings.gemini_model} onChange={(v) => set("gemini_model", v)} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.send_errors_to_group === "true"}
            onChange={(e) => set("send_errors_to_group", e.target.checked ? "true" : "false")}
          />
          هشدارهای فنی Gemini علاوه بر چت خصوصی در گروه هم ارسال شود
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.ask_rating_on_close === "true"}
            onChange={(e) => set("ask_rating_on_close", e.target.checked ? "true" : "false")}
          />
          بعد از بستن تیکت از کاربر رضایت‌سنجی پرسیده شود
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.ai_enabled === "true"}
            onChange={(e) => set("ai_enabled", e.target.checked ? "true" : "false")}
          />
          پاسخگویی هوشمند Gemini فعال باشد
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">💬 متن پیام‌های آماده ربات</h2>
        <div className="mt-3 space-y-3">
          <TextField label="پیام خوش‌آمدگویی (/start)" value={settings.welcome_message} onChange={(v) => set("welcome_message", v)} />
          <TextField label="پیام باز شدن تیکت جدید" value={settings.ticket_opened_message} onChange={(v) => set("ticket_opened_message", v)} />
          <TextField label="تأیید دریافت هر پیام کاربر" value={settings.ticket_received_ack} onChange={(v) => set("ticket_received_ack", v)} />
          <TextField label="پیام بسته شدن تیکت" value={settings.ticket_closed_message} onChange={(v) => set("ticket_closed_message", v)} />
          <TextField
            label="Fallback هنگام اتمام سهمیه/خطای Gemini (کاربر فقط این پیام را می‌بیند)"
            value={settings.ai_quota_fallback_message}
            onChange={(v) => set("ai_quota_fallback_message", v)}
          />
          <TextField
            label="پیام هنگامی که کاربر بدون تیکت باز پیام می‌دهد"
            value={settings.no_open_ticket_message}
            onChange={(v) => set("no_open_ticket_message", v)}
          />
          <TextField
            label="دستورالعمل سیستمی هوش مصنوعی (System Prompt)"
            value={settings.ai_system_prompt}
            onChange={(v) => set("ai_system_prompt", v)}
            rows={10}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "در حال ذخیره..." : "ذخیره همه تنظیمات"}
        </button>
        {message && <span className="text-sm text-emerald-700">{message}</span>}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">📣 ارسال پیام همگانی</h2>
        <p className="mt-1 text-sm text-slate-500">به همه کاربرانی که با ربات شروع کرده‌اند ارسال می‌شود.</p>
        <textarea
          value={broadcastText}
          onChange={(e) => setBroadcastText(e.target.value)}
          rows={5}
          placeholder="متن پیام همگانی..."
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={sendBroadcast}
            disabled={broadcastBusy || !broadcastText.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {broadcastBusy ? "در حال ارسال..." : "📨 ارسال پیام همگانی"}
          </button>
          {broadcastResult && <span className="text-sm text-emerald-700">{broadcastResult}</span>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string | undefined; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
