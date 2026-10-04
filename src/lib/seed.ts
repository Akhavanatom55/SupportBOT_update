import { db } from "@/db";
import { adminWebUsers, botAdmins, cannedResponses, faqs } from "@/db/schema";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth";
import { ensureDefaultSettings } from "@/lib/settings";
import { eq } from "drizzle-orm";

let seeded = false;

export async function ensureSeedData(): Promise<void> {
  if (seeded) return;
  await ensureDefaultSettings();
  await ensureDefaultWebAdmin();
  await ensureEnvAdmins();
  await ensureDefaultFaqs();
  await ensureDefaultCannedResponses();
  seeded = true;
}

async function ensureDefaultWebAdmin() {
  const existing = await db.select().from(adminWebUsers).limit(1);
  if (existing.length > 0) return;
  const passwordHash = await hashPassword(env.adminPanelPassword);
  await db.insert(adminWebUsers).values({
    username: env.adminPanelUsername,
    passwordHash,
  });
}

async function ensureEnvAdmins() {
  const ids = env.adminIds
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  for (const id of ids) {
    const existing = await db.select().from(botAdmins).where(eq(botAdmins.baleUserId, id)).limit(1);
    if (existing.length === 0) {
      await db.insert(botAdmins).values({ baleUserId: id, name: `ادمین ${id}`, isSuperAdmin: true });
    }
  }
}

async function ensureDefaultFaqs() {
  const existing = await db.select().from(faqs).limit(1);
  if (existing.length > 0) return;
  await db.insert(faqs).values([
    {
      question: "چرا پیامک تایید برام ارسال نشده؟",
      answer:
        "لطفاً این موارد رو بررسی کن:\n۱) پوشه پیامک‌های اسپم/هرزنامه گوشیت رو چک کن.\n۲) گوشی رو ۳۰ ثانیه حالت پرواز بذار و بردار تا آنتن‌دهی ریست بشه.\n۳) مطمئن شو اپراتورت مسدودیت پیامکی نداره.\nاگه بازم پیامک نیومد، همینجا «ثبت درخواست جدید» رو بزن تا براتون پیگیری کنیم.",
      isPublished: true,
      sortOrder: 1,
    },
    {
      question: "چرا نمی‌تونم وارد حساب کاربری بشم؟",
      answer:
        "ابتدا مطمئن شو شماره موبایل یا نام‌کاربری رو درست وارد کردی. اگه رمز عبور یادت رفته از گزینه «فراموشی رمز عبور» استفاده کن. اگه بازم مشکل داشتی، «ثبت درخواست جدید» رو بزن و وضعیت رو برامون توضیح بده تا بررسی کنیم.",
      isPublished: true,
      sortOrder: 2,
    },
    {
      question: "چقدر طول می‌کشه تا به درخواستم رسیدگی بشه؟",
      answer:
        "تیم پشتیبانی معمولاً در کوتاه‌ترین زمان ممکن (معمولاً چند دقیقه تا چند ساعت بسته به حجم درخواست‌ها) پاسخ می‌ده. همین که پیامت رو بفرستی، در صف بررسی قرار می‌گیره.",
      isPublished: true,
      sortOrder: 3,
    },
  ]);
}

async function ensureDefaultCannedResponses() {
  const existing = await db.select().from(cannedResponses).limit(1);
  if (existing.length > 0) return;
  await db.insert(cannedResponses).values([
    {
      title: "پیامک ارسال نشده",
      keywords: "پیامک,اس ام اس,sms,کد تایید,کد فعالسازی",
      messageParts: [
        "برای مشکل پیامک لطفاً این موارد رو امتحان کن:\n۱) پوشه اسپم/هرزنامه پیامک رو چک کن.\n۲) گوشی رو حالت پرواز بذار و بردار.\n۳) آنتن‌دهی و فیلتر پیامک مزاحم اپراتور رو بررسی کن.",
        "یک پیامک جدید به‌زودی براتون ارسال می‌شه، لطفاً چند دقیقه صبر کنید 🙏",
      ],
      category: "auto",
      isAutoSuggest: true,
      isActive: true,
    },
    {
      title: "مشکل ورود به سامانه",
      keywords: "ورود,لاگین,رمز عبور,وارد نمیشم,login",
      messageParts: [
        "برای مشکل ورود، لطفاً نام‌کاربری/شماره موبایل رو دوباره چک کن و از گزینه «فراموشی رمز عبور» استفاده کن. اگه بازم مشکل داشتی همینجا بگو تا یک کارشناس بررسی کنه.",
      ],
      category: "auto",
      isAutoSuggest: true,
      isActive: true,
    },
    {
      title: "تشکر و پایان گفتگو",
      keywords: null,
      messageParts: ["خواهش می‌کنم 🙏 خوشحالیم که تونستیم کمک کنیم. اگه سوال دیگه‌ای بود در خدمتیم."],
      category: "quick",
      isAutoSuggest: false,
      isActive: true,
    },
  ]);
}
