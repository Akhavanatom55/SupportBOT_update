"use client";

import { useEffect, useState } from "react";

type Faq = {
  id: number;
  question: string;
  answer: string;
  isPublished: boolean;
  sortOrder: number;
  hitCount: number;
};

export default function FaqAdminPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/faqs").then((r) => r.json());
    setFaqs(res.faqs || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addFaq(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!question.trim() || !answer.trim()) {
      setError("سوال و جواب را کامل کنید.");
      return;
    }
    const res = await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, isPublished: true, sortOrder: faqs.length }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "ثبت ناموفق بود");
      return;
    }
    setQuestion("");
    setAnswer("");
    load();
  }

  async function togglePublish(faq: Faq) {
    await fetch(`/api/admin/faqs/${faq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !faq.isPublished }),
    });
    load();
  }

  async function updateFaq(faq: Faq) {
    await fetch(`/api/admin/faqs/${faq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: faq.question, answer: faq.answer }),
    });
    load();
  }

  async function deleteFaq(id: number) {
    if (!confirm("حذف این سوال متداول؟")) return;
    await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">سوالات متداول</h1>
      <p className="mt-1 text-sm text-slate-500">
        این سوالات در منوی «سوالات متداول» ربات به کاربران نمایش داده می‌شود و کاربر می‌تواند بدون نیاز به پشتیبانی انسانی، جواب
        خودش را سریع ببیند.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">افزودن سوال متداول جدید</h2>
        {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form onSubmit={addFaq} className="mt-3 space-y-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="سوال؛ مثلاً: چرا نمی‌تونم وارد آزمون بشم؟"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="پاسخ کامل..."
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
            ➕ افزودن و انتشار
          </button>
        </form>
      </section>

      <section className="mt-6 space-y-3">
        {loading && <p className="text-slate-500">در حال بارگذاری...</p>}
        {!loading && faqs.length === 0 && <p className="text-slate-500">هنوز سوالی ثبت نشده است.</p>}
        {faqs.map((faq) => (
          <FaqItem key={faq.id} faq={faq} onTogglePublish={togglePublish} onUpdate={updateFaq} onDelete={deleteFaq} />
        ))}
      </section>
    </div>
  );
}

function FaqItem({
  faq,
  onTogglePublish,
  onUpdate,
  onDelete,
}: {
  faq: Faq;
  onTogglePublish: (f: Faq) => void;
  onUpdate: (f: Faq) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold"
              />
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          ) : (
            <>
              <p className="font-bold">❓ {faq.question}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">💡 {faq.answer}</p>
            </>
          )}
          <p className="mt-2 text-xs text-slate-400">بازدید: {faq.hitCount}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            faq.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {faq.isPublished ? "منتشر شده" : "پیش‌نویس"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <button
            onClick={() => {
              onUpdate({ ...faq, question, answer });
              setEditing(false);
            }}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
          >
            ذخیره
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold">
            ویرایش
          </button>
        )}
        <button onClick={() => onTogglePublish(faq)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold">
          {faq.isPublished ? "عدم انتشار" : "انتشار"}
        </button>
        <button
          onClick={() => onDelete(faq.id)}
          className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
