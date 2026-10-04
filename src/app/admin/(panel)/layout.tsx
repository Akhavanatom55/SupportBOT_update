import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import LogoutButton from "./_components/LogoutButton";

const NAV_ITEMS = [
  { href: "/admin", label: "📊 داشبورد" },
  { href: "/admin/tickets", label: "🎫 تیکت‌ها" },
  { href: "/admin/gemini", label: "🤖 کلیدهای Gemini" },
  { href: "/admin/faq", label: "❓ سوالات متداول" },
  { href: "/admin/canned", label: "⚡ پاسخ‌های آماده" },
  { href: "/admin/admins", label: "🛡 ادمین‌ها و دسترسی‌ها" },
  { href: "/admin/settings", label: "⚙️ تنظیمات ربات" },
  { href: "/admin/backup", label: "💾 بکاپ دیتابیس" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-slate-200 bg-white p-5 md:flex">
          <div className="mb-6">
            <p className="text-lg font-bold text-indigo-700">پنل مدیریت ربات پشتیبانی</p>
            {session && <p className="mt-1 text-xs text-slate-500">خوش اومدی، {session.username}</p>}
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <p className="font-bold text-indigo-700">پنل مدیریت</p>
            <LogoutButton />
          </header>
          <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
