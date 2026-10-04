import { db } from "@/db";
import { faqs, geminiKeys, tickets, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [openTickets] = await db.select({ count: sql<number>`count(*)` }).from(tickets).where(eq(tickets.status, "open"));
  const [closedTickets] = await db.select({ count: sql<number>`count(*)` }).from(tickets).where(eq(tickets.status, "closed"));
  const [faqCount] = await db.select({ count: sql<number>`count(*)` }).from(faqs);
  const keys = await db.select().from(geminiKeys);
  const activeKeys = keys.filter((k) => k.isActive && !k.isExhausted).length;
  const exhaustedKeys = keys.filter((k) => k.isExhausted).length;
  const [avgRatingRow] = await db
    .select({ avg: sql<number>`coalesce(avg(rating), 0)` })
    .from(tickets)
    .where(sql`${tickets.rating} is not null`);

  return {
    totalUsers: userCount?.count ?? 0,
    openTickets: openTickets?.count ?? 0,
    closedTickets: closedTickets?.count ?? 0,
    faqCount: faqCount?.count ?? 0,
    totalGeminiKeys: keys.length,
    activeKeys,
    exhaustedKeys,
    avgRating: avgRatingRow?.avg ?? 0,
  };
}

function StatCard({ title, value, icon, tone }: { title: string; value: string | number; icon: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl text-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">داشبورد مدیریت</h1>
      <p className="mt-1 text-sm text-slate-500">نمای کلی وضعیت ربات پشتیبانی</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="کاربران ثبت‌شده" value={stats.totalUsers} icon="👥" tone="bg-indigo-50" />
        <StatCard title="تیکت‌های باز" value={stats.openTickets} icon="🟢" tone="bg-emerald-50" />
        <StatCard title="تیکت‌های بسته" value={stats.closedTickets} icon="🔒" tone="bg-slate-100" />
        <StatCard title="سوالات متداول" value={stats.faqCount} icon="❓" tone="bg-amber-50" />
        <StatCard title="کلیدهای Gemini فعال" value={`${stats.activeKeys} / ${stats.totalGeminiKeys}`} icon="🤖" tone="bg-sky-50" />
        <StatCard title="کلیدهای محدودشده (Quota)" value={stats.exhaustedKeys} icon="⛔" tone="bg-rose-50" />
        <StatCard title="میانگین رضایت کاربران" value={stats.avgRating ? stats.avgRating.toFixed(1) : "—"} icon="⭐" tone="bg-yellow-50" />
      </div>

      {stats.exhaustedKeys > 0 && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          ⚠️ {stats.exhaustedKeys} کلید Gemini در حال حاضر به محدودیت خورده‌اند. برای افزودن کلید جدید به{" "}
          <Link href="/admin/gemini" className="font-bold underline">
            صفحه کلیدهای Gemini
          </Link>{" "}
          مراجعه کنید.
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/tickets"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <p className="text-lg font-bold">🎫 مدیریت تیکت‌ها</p>
          <p className="mt-1 text-sm text-slate-500">مشاهده، پاسخ و بستن درخواست‌های کاربران</p>
        </Link>
        <Link
          href="/admin/gemini"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <p className="text-lg font-bold">🤖 تنظیم کلید و مدل Gemini</p>
          <p className="mt-1 text-sm text-slate-500">افزودن چند کلید برای سوییچ خودکار هنگام اتمام سهمیه</p>
        </Link>
        <Link
          href="/admin/faq"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <p className="text-lg font-bold">❓ سوالات متداول</p>
          <p className="mt-1 text-sm text-slate-500">افزودن و ویرایش سوالات پرتکرار کاربران</p>
        </Link>
        <Link
          href="/admin/settings#panel-link"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <p className="text-lg font-bold">🔗 لینک پنل مدیریت</p>
          <p className="mt-1 text-sm text-slate-500">دریافت، کپی و ارسال لینک ورود به پنل برای ادمین‌ها</p>
        </Link>
        <Link
          href="/admin/backup"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
        >
          <p className="text-lg font-bold">💾 بکاپ‌گیری دیتابیس</p>
          <p className="mt-1 text-sm text-slate-500">دانلود یا بازیابی کامل اطلاعات ربات</p>
        </Link>
      </div>
    </div>
  );
}
