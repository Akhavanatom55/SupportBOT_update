import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

export const DEFAULT_AI_SYSTEM_PROMPT = `تو دستیار پشتیبانی انسانی یک مجموعه هستی و هرگز نباید بگویی هوش مصنوعی یا ربات هستی.
لحن تو دوستانه، محترمانه و فارسیِ محاوره‌ای پشتیبانیِ حرفه‌ای است، نه رسمیِ خشک.
هرگز رمز عبور کاربر را درخواست نکن و هرگز ادعا نکن کاری را در سیستم واقعاً انجام داده‌ای مگر اینکه از بیرون توسط کارشناس تایید شده باشد.
اگر کاربر از شماره تلفن، کدملی یا کد پرسنلی صحبت کرد فقط به وجود یا نبود آن اشاره کن و هرگز عدد کامل آن را در پاسخ تکرار نکن.
اگر مشکل کاربر «ارسال نشدن پیامک» بود، پاسخ را در قالب دو پیام جدا و کوتاه بده:
پیام اول: راهنمایی برای بررسی پوشه اسپم/هرزنامه، حالت پرواز، آنتن‌دهی و فیلترهای پیامک مزاحم.
پیام دوم: این که به‌زودی پیامک جدید برای او ارسال خواهد شد و منتظر بماند.
هرگز ادعا نکن پیامک قطعاً همین الان ارسال شد.
اگر مشکل کاربر «ورود به سامانه» بود، ابتدا یک راهنمایی کوتاه بده و در صورت نیاز کد ملی، شماره تلفن یا کد پرسنلی را بخواه، ولی هرگز رمز عبور نخواه.
اگر نمی‌دانی مشکل چیست یا نمی‌توانی کمک کنی، دقیقاً همین را بگو: «تیم پشتیبانی ما به زودی مشکل رو براتون حل می‌کنن و بهتون اطلاع می‌دن، تو همین ربات.»
پاسخ‌ها را کوتاه، مفید و مرحله‌به‌مرحله بنویس.`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  bot_name: env.botName,
  organization_name: env.organizationName,
  gemini_model: env.geminiModel,
  ai_system_prompt: DEFAULT_AI_SYSTEM_PROMPT,
  ai_enabled: "true",
  group_chat_id: env.groupChatId,
  public_base_url: env.publicBaseUrl,
  webhook_secret: env.webhookSecret || cryptoRandom(),
  welcome_message:
    "سلام 👋 به ربات پشتیبانی خوش اومدی.\nبرای ثبت درخواست جدید روی دکمه «ثبت درخواست جدید» بزن تا همکارهای پشتیبانی در جریان بذاریمشون. همچنین می‌تونی از بخش «سوالات متداول» جواب خیلی از سوال‌های رایج رو همین الان ببینی.",
  ticket_opened_message:
    "✅ یک درخواست پشتیبانی جدید برات باز شد.\nهر چی مدنظرته رو بنویس، همکارهای پشتیبانی هم در جریان قرار می‌گیرن و در کنار پاسخ سریع، به محض آزاد شدن بهت رسیدگی می‌کنن.\nهر وقت مشکلت حل شد روی «بستن درخواست» بزن.",
  ticket_received_ack: "پیامت دریافت شد ✅ تیم پشتیبانی در جریانه، تا چند لحظه دیگه بررسی می‌شه.",
  ticket_closed_message: "درخواست شما بسته شد. امیدواریم مشکلتون حل شده باشه 🙏\nاگه سوال دیگه‌ای داشتی، «ثبت درخواست جدید» رو بزن.",
  ai_quota_fallback_message:
    "پیام شما برای تیم پشتیبانی ثبت و ارسال شد ✅\nهمکاران به زودی بررسی می‌کنن و در همین چت جواب می‌دن. ممنون از صبوریت 🙏",
  no_open_ticket_message:
    "برای ارسال پیام، اول باید یک درخواست جدید ثبت کنی. روی دکمه «ثبت درخواست جدید» بزن 🙏",
  auto_close_hours: "48",
  send_errors_to_group: "true",
  ask_rating_on_close: "true",
};

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const cache = new Map<string, string>();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5000;

async function loadAll(): Promise<void> {
  const rows = await db.select().from(settings);
  cache.clear();
  for (const row of rows) cache.set(row.key, row.value);
  cacheLoadedAt = Date.now();
}

export async function getSetting(key: string): Promise<string> {
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadAll();
  }
  if (cache.has(key)) return cache.get(key) as string;
  return DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettings(): Promise<Record<string, string>> {
  await loadAll();
  const merged: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const [k, v] of cache.entries()) merged[k] = v;
  return merged;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  cache.set(key, value);
}

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await db.select().from(settings);
  const existingKeys = new Set(existing.map((r) => r.key));
  const toInsert = Object.entries(DEFAULT_SETTINGS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({ key, value }));
  if (toInsert.length > 0) {
    await db.insert(settings).values(toInsert);
  }
}

export async function getBoolSetting(key: string): Promise<boolean> {
  const value = await getSetting(key);
  return value === "true" || value === "1";
}
