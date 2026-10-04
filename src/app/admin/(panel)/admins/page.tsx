"use client";

import { useEffect, useState } from "react";

type BotAdmin = { id: number; baleUserId: string; name: string | null };
type WebUser = { id: number; username: string; createdAt: string | Date | null };

export default function AdminsPage() {
  const [botAdmins, setBotAdmins] = useState<BotAdmin[]>([]);
  const [webUsers, setWebUsers] = useState<WebUser[]>([]);
  const [baleUserId, setBaleUserId] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);

  async function load() {
    const [a, w, me] = await Promise.all([
      fetch("/api/admin/admins").then((r) => r.json()),
      fetch("/api/admin/web-users").then((r) => r.json()),
      fetch("/api/admin/auth/me").then((r) => r.json()),
    ]);
    setBotAdmins(a.admins || []);
    setWebUsers(w.users || []);
    setCurrentUsername(me.user?.username || "");
    setNewUsername(me.user?.username || "");
  }

  useEffect(() => {
    load();
  }, []);

  async function addBotAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!baleUserId.trim()) {
      setError("شناسه عددی ادمین در بله را وارد کنید.");
      return;
    }
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baleUserId: baleUserId.trim(), name }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "افزودن ناموفق بود");
      return;
    }
    setBaleUserId("");
    setName("");
    load();
  }

  async function removeBotAdmin(id: number) {
    if (!confirm("حذف این ادمین از لیست دریافت‌کنندگان تیکت؟")) return;
    await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
    load();
  }

  async function addWebUser(e: React.FormEvent) {
    e.preventDefault();
    setError2(null);
    if (!username.trim() || password.length < 8) {
      setError2("نام کاربری لازم است و رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    const res = await fetch("/api/admin/web-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError2(data.error || "افزودن ناموفق بود");
      return;
    }
    setUsername("");
    setPassword("");
    load();
  }

  async function removeWebUser(id: number) {
    if (!confirm("حذف این حساب پنل مدیریت؟")) return;
    const res = await fetch(`/api/admin/web-users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "حذف ناموفق بود");
    }
    load();
  }

  async function changeOwnCredentials(e: React.FormEvent) {
    e.preventDefault();
    setAccountBusy(true);
    setAccountMessage(null);
    if (!currentPassword) {
      setAccountMessage("رمز عبور فعلی را وارد کنید.");
      setAccountBusy(false);
      return;
    }
    if (!newUsername.trim() && !newPassword) {
      setAccountMessage("نام کاربری جدید یا رمز عبور جدید را وارد کنید.");
      setAccountBusy(false);
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setAccountMessage("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.");
      setAccountBusy(false);
      return;
    }

    const res = await fetch("/api/admin/auth/change-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        username: newUsername.trim(),
        newPassword,
      }),
    });
    const data = await res.json();
    setAccountBusy(false);
    if (!res.ok) {
      setAccountMessage(data.error || "تغییر اطلاعات ورود ناموفق بود");
      return;
    }
    setCurrentUsername(data.username || newUsername.trim());
    setNewUsername(data.username || newUsername.trim());
    setCurrentPassword("");
    setNewPassword("");
    setAccountMessage("اطلاعات ورود با موفقیت تغییر کرد ✅");
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">ادمین‌ها و دسترسی‌ها</h1>
      <p className="mt-1 text-sm text-slate-500">
        ادمین‌های بله تیکت‌ها و هشدارها را دریافت می‌کنند و کاربران پنل وب می‌توانند داشبورد مدیریت را ببینند.
      </p>

      <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="text-lg font-bold text-indigo-900">🔐 حساب ورود ادمین فعلی</h2>
        <p className="mt-1 text-sm text-indigo-800">
          این بخش فقط اطلاعات حسابی را که همین الان وارد پنل شده تغییر می‌دهد. برای هر تغییر، رمز عبور فعلی لازم است.
        </p>
        <form onSubmit={changeOwnCredentials} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">نام کاربری جدید</label>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={currentUsername || "نام کاربری"}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">رمز عبور جدید</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="حداقل ۸ کاراکتر"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">رمز عبور فعلی</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="برای تأیید تغییرات"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={accountBusy}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {accountBusy ? "در حال ذخیره..." : "💾 ذخیره اطلاعات ورود"}
            </button>
            <span className="text-sm text-slate-600">حساب فعلی: <strong>{currentUsername || "—"}</strong></span>
          </div>
          {accountMessage && <p className="md:col-span-2 rounded-xl bg-white px-3 py-2 text-sm text-indigo-800">{accountMessage}</p>}
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">افزودن ادمین ربات بله</h2>
        <p className="mt-1 text-xs text-slate-500">شناسه عددی ادمین را وارد کنید؛ ادمین جدید فوراً در چرخه دریافت تیکت قرار می‌گیرد.</p>
        {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form onSubmit={addBotAdmin} className="mt-3 grid gap-3 md:grid-cols-3">
          <input value={baleUserId} onChange={(e) => setBaleUserId(e.target.value)} placeholder="شناسه عددی بله" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام نمایشی (اختیاری)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">➕ افزودن</button>
        </form>
        <div className="mt-4 space-y-2">
          {botAdmins.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div><p className="font-semibold">{a.name || "بدون نام"}</p><p className="font-mono text-xs text-slate-500">{a.baleUserId}</p></div>
              <button onClick={() => removeBotAdmin(a.id)} className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600">حذف</button>
            </div>
          ))}
          {botAdmins.length === 0 && <p className="text-sm text-slate-500">هنوز ادمینی ثبت نشده است.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">کاربران پنل وب (/admin)</h2>
        {error2 && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error2}</p>}
        <form onSubmit={addWebUser} className="mt-3 grid gap-3 md:grid-cols-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور حداقل ۸ کاراکتر" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">➕ افزودن کاربر</button>
        </form>
        <div className="mt-4 space-y-2">
          {webUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <p className="font-semibold">{u.username}</p>
              <button onClick={() => removeWebUser(u.id)} className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600">حذف</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
