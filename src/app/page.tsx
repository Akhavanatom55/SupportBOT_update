import { db } from "@/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDbOk() {
  try {
    db.$client.prepare("select 1").get();
    return true;
  } catch {
    return false;
  }
}

const FEATURES = [
  { icon: "🤖", title: "پاسخ‌دهی خودکار با Gemini", desc: "پاسخ هوشمند و انسانی به پیام کاربران با قابلیت تعریف چند API Key و سوییچ خودکار هنگام اتمام سهمیه." },
  { icon: "🎫", title: "مدیریت تیکت پشتیبانی", desc: "هر درخواست کاربر یک تیکت جداست؛ ادمین‌ها می‌توانند تحویل بگیرند، پاسخ بدهند و ببندند." },
  { icon: "❓", title: "سوالات متداول پویا", desc: "ادمین‌ها می‌توانند بدون تماس با برنامه‌نویس، سوالات پرتکرار و جواب آن‌ها را اضافه کنند." },
  { icon: "⚡", title: "پاسخ‌های آماده هوشمند", desc: "تشخیص خودکار درخواست‌های تکراری (مثل پیامک نیومده) و پاسخ فوری بدون نیاز به هوش مصنوعی." },
  { icon: "👥", title: "گروه و پیام خصوصی ادمین‌ها", desc: "تمام پیام‌های کاربران هم‌زمان برای ادمین‌ها و گروه پشتیبانی ارسال می‌شود." },
  { icon: "💾", title: "بکاپ و بازیابی کامل", desc: "دانلود و آپلود بکاپ کامل دیتابیس شامل کاربران، تیکت‌ها، سوالات متداول و کلیدهای Gemini." },
];

export default async function HomePage() {
  const dbOk = await getDbOk();

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50">
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-6xl">🤖</p>
        <h1 className="mt-6 text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-tight text-slate-950">
          ربات پشتیبانی هوشمند بله
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          مدیریت حرفه‌ای درخواست‌های پشتیبانی با پاسخ‌دهی خودکار Gemini، سوالات متداول، پاسخ‌های آماده و پنل مدیریت کامل —
          مخصوص پیام‌رسان بله.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/admin"
            className="rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
          >
            ورود به پنل مدیریت
          </Link>
          <span
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              dbOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {dbOk ? "✅ اتصال دیتابیس برقرار است" : "⚠️ اتصال دیتابیس برقرار نیست"}
          </span>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-3xl">{f.icon}</p>
            <p className="mt-3 font-bold text-slate-900">{f.title}</p>
            <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        برای شروع، ابتدا متغیرهای محیطی BALE_BOT_TOKEN را تنظیم کنید و سپس از پنل مدیریت، وبهوک و کلید Gemini را ثبت کنید.
      </footer>
    </main>
  );
}
