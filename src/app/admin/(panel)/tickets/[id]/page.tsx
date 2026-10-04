"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type TicketDetail = {
  id: number;
  status: "open" | "closed";
  assignedAdminName: string | null;
  aiPaused: boolean;
  rating: number | null;
  createdAt: string;
  userFirstName: string | null;
  userLastName: string | null;
  userUsername: string | null;
  userBaleId: string;
};

type Message = {
  id: number;
  sender: "user" | "admin" | "bot" | "system";
  senderLabel: string | null;
  content: string;
  createdAt: string;
};

const SENDER_STYLE: Record<Message["sender"], string> = {
  user: "bg-white border border-slate-200 self-start",
  admin: "bg-indigo-600 text-white self-end",
  bot: "bg-emerald-50 border border-emerald-200 self-end",
  system: "bg-amber-50 border border-amber-200 self-center text-xs",
};

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ticketId = params.id;
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/tickets/${ticketId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTicket(data.ticket);
    setMessages(data.messages);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/admin/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply, adminName: "ادمین پنل وب" }),
    });
    setSending(false);
    if (res.ok) {
      setReply("");
      load();
    } else {
      const data = await res.json();
      alert(data.error || "ارسال ناموفق بود");
    }
  }

  async function closeTicket() {
    if (!confirm("این تیکت بسته شود؟")) return;
    await fetch(`/api/admin/tickets/${ticketId}/close`, { method: "POST" });
    router.push("/admin/tickets");
  }

  if (loading) return <p className="text-slate-500">در حال بارگذاری...</p>;
  if (!ticket) return <p className="text-rose-600">تیکت یافت نشد.</p>;

  return (
    <div>
      <Link href="/admin/tickets" className="text-sm text-indigo-600 hover:underline">
        ⬅️ بازگشت به لیست تیکت‌ها
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">تیکت #{ticket.id}</h1>
          <p className="text-sm text-slate-500">
            {[ticket.userFirstName, ticket.userLastName].filter(Boolean).join(" ") || "کاربر"} ·{" "}
            {ticket.userUsername ? `@${ticket.userUsername}` : ticket.userBaleId}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              ticket.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {ticket.status === "open" ? "باز" : "بسته"}
          </span>
          {ticket.status === "open" && (
            <button onClick={closeTicket} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600">
              بستن تیکت
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex max-h-[55vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex max-w-[80%] flex-col rounded-2xl px-4 py-2 text-sm shadow-sm ${SENDER_STYLE[m.sender]}`}>
            <p className="mb-1 text-[10px] opacity-70">{m.senderLabel || m.sender}</p>
            <p className="whitespace-pre-line">{m.content}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-sm text-slate-400">هنوز پیامی ثبت نشده.</p>}
      </div>

      {ticket.status === "open" && (
        <div className="mt-4 flex gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="پاسخ خود را بنویسید..."
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={sendReply}
            disabled={sending}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {sending ? "در حال ارسال..." : "ارسال"}
          </button>
        </div>
      )}
    </div>
  );
}
