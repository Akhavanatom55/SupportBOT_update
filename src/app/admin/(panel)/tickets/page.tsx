"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TicketRow = {
  id: number;
  status: "open" | "closed";
  assignedAdminName: string | null;
  aiPaused: boolean;
  rating: number | null;
  createdAt: string;
  lastMessageAt: string;
  userFirstName: string | null;
  userLastName: string | null;
  userUsername: string | null;
  userBaleId: string;
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [loading, setLoading] = useState(true);

  async function load(status: "all" | "open" | "closed") {
    setLoading(true);
    const qs = status === "all" ? "" : `?status=${status}`;
    const res = await fetch(`/api/admin/tickets${qs}`).then((r) => r.json());
    setTickets(res.tickets || []);
    setLoading(false);
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">تیکت‌های پشتیبانی</h1>
      <p className="mt-1 text-sm text-slate-500">مشاهده و پاسخ به درخواست‌های کاربران، حتی از طریق همین پنل وب.</p>

      <div className="mt-4 flex gap-2">
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              filter === f ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {f === "open" ? "باز" : f === "closed" ? "بسته‌شده" : "همه"}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-right">#</th>
              <th className="px-4 py-3 text-right">کاربر</th>
              <th className="px-4 py-3 text-right">وضعیت</th>
              <th className="px-4 py-3 text-right">مسئول</th>
              <th className="px-4 py-3 text-right">آخرین پیام</th>
              <th className="px-4 py-3 text-right">رضایت</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  در حال بارگذاری...
                </td>
              </tr>
            )}
            {!loading && tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  تیکتی یافت نشد.
                </td>
              </tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono">#{t.id}</td>
                <td className="px-4 py-3">
                  {[t.userFirstName, t.userLastName].filter(Boolean).join(" ") || "کاربر"}
                  <span className="mr-1 block text-xs text-slate-400">{t.userUsername ? `@${t.userUsername}` : t.userBaleId}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      t.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.status === "open" ? "باز" : "بسته"}
                  </span>
                </td>
                <td className="px-4 py-3">{t.assignedAdminName || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.lastMessageAt).toLocaleString("fa-IR")}</td>
                <td className="px-4 py-3">{t.rating ? "⭐".repeat(Math.min(5, Math.max(1, Math.round(t.rating / 1)))) : "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/tickets/${t.id}`} className="font-semibold text-indigo-600 hover:underline">
                    مشاهده
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
