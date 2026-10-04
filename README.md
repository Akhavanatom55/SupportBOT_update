# SupportBOT — Bale Support + Web Admin

ربات پشتیبانی کامل برای پیام‌رسان **بله** به همراه پنل مدیریت وب. ربات و پنل در یک پروژه Next.js اجرا می‌شوند و PostgreSQL برای نگهداری کاربران، تیکت‌ها، پیام‌ها، FAQ، پاسخ‌های آماده، کلیدهای Gemini و تنظیمات استفاده می‌شود.

## قابلیت‌ها

- دریافت درخواست کاربران در Bale
- ساخت Ticket برای هر درخواست
- ارسال درخواست و پیام‌های جدید برای ادمین‌ها و گروه پشتیبانی
- پاسخ مستقیم ادمین به کاربر از داخل Bale
- امکان تحویل گرفتن Ticket توسط ادمین و توقف پاسخ هوش مصنوعی
- FAQ قابل مدیریت از پنل
- پاسخ‌های آماده قابل مدیریت و پاسخ خودکار بر اساس کلمات کلیدی
- پیام‌های fallback در صورت خاموش بودن AI یا تمام شدن سهمیه Gemini
- چند Gemini API Key با چرخش خودکار هنگام Quota/429
- خطاهای Gemini فقط برای ادمین‌ها گزارش می‌شوند؛ متن خطا به کاربر نمایش داده نمی‌شود
- انتخاب مدل Gemini از پنل
- مدیریت ادمین‌های Bale
- مدیریت کاربران پنل وب
- Broadcast
- آمار Dashboard
- امتیازدهی کاربران به پشتیبانی
- Backup/Restore کامل PostgreSQL به‌صورت JSON
- ثبت و مدیریت Webhook از پنل
- Health endpoint برای مانیتورینگ
- Dockerfile آماده برای Deploy

## ساختار کلی

```text
Bale User
   │
   ▼
Bale Bot API
   │
   ▼
Next.js / Webhook ─────► Gemini API pool
   │
   ▼
PostgreSQL
   │
   └──── Web Admin (/admin)
```

## راه‌اندازی با Docker

### 1. فایل محیطی

فایل `.env.example` را به `.env` تبدیل کنید و مقادیر را وارد کنید.

```bash
cp .env.example .env
```

### 2. PostgreSQL

یک PostgreSQL در سرور/Deplexo بسازید و مقدار `DATABASE_URL` را وارد کنید.

نمونه:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

### 3. Build

```bash
docker build -t supportbot .
```

### 4. Run

```bash
docker run --env-file .env -p 3000:3000 supportbot
```

Container هنگام startup با `drizzle-kit push` ساختار دیتابیس را با schema پروژه هماهنگ می‌کند و سپس Next.js را اجرا می‌کند.

## متغیرهای محیطی

همه متغیرهای لازم در `.env.example` قرار دارند:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
BALE_BOT_TOKEN=
ADMIN_IDS=123456,789012
GROUP_CHAT_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
ADMIN_PANEL_USERNAME=admin
ADMIN_PANEL_PASSWORD=CHANGE_THIS
SESSION_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
PUBLIC_BASE_URL=https://YOUR-DOMAIN.example
WEBHOOK_SECRET=CHANGE_THIS_TO_A_RANDOM_SECRET
BOT_NAME=ربات پشتیبانی
ORGANIZATION_NAME=تیم پشتیبانی
```

`GEMINI_API_KEY` در محیط فقط نقش کلید پشتیبان اولیه دارد؛ روش اصلی، اضافه کردن چند کلید از پنل `/admin/gemini` است.

## مدل Gemini

مدل پیش‌فرض پروژه `gemini-3.5-flash-lite` است. مدل‌های پایدار پیشنهادی فعلی برای این پروژه:

- `gemini-3.5-flash-lite` — مناسب برای پاسخ‌های پرتعداد و کم‌هزینه
- `gemini-3.6-flash` — قوی‌تر برای پاسخ‌های پیچیده‌تر
- `gemini-3.1-flash-lite` — گزینه اقتصادی پایدار

> نکته: نام مدل باید دقیقاً همان Model ID رسمی Google باشد. مدل مستقلی با نام `gemini-3.6-flash-lite` وجود ندارد؛ 3.6 Flash و 3.5 Flash-Lite دو مدل جدا هستند.

## پنل مدیریت

بعد از اجرا:

```text
https://YOUR-DOMAIN/admin
```

ورود اولیه از این متغیرها انجام می‌شود:

```env
ADMIN_PANEL_USERNAME=admin
ADMIN_PANEL_PASSWORD=CHANGE_THIS
```

بعد از ورود می‌توانید موارد زیر را بدون تغییر کد مدیریت کنید:

- Gemini API Keys
- مدل Gemini
- فعال/غیرفعال کردن AI
- FAQ
- پاسخ‌های آماده
- ادمین‌ها
- کاربران وب
- Ticketها
- تنظیمات پیام‌ها
- Broadcast
- Backup/Restore
- Webhook

## اتصال Webhook بله

در پنل مدیریت قسمت Webhook را باز کنید و ثبت Webhook را انجام دهید.

ساختار endpoint:

```text
https://YOUR-DOMAIN/api/bale/webhook/YOUR_WEBHOOK_SECRET
```

اگر `WEBHOOK_SECRET` در `.env` خالی باشد، مقدار امن توسط seed اولیه تولید و در تنظیمات ذخیره می‌شود؛ با این حال برای Deploy پایدار توصیه می‌شود مقدار ثابت و تصادفی در `.env` قرار دهید.

## نکته مهم درباره Gemini Quota

ترتیب عملکرد:

1. کلید فعال با بالاترین priority امتحان می‌شود.
2. اگر 429/Quota/Rate Limit رخ دهد، کلید در دیتابیس به‌صورت موقت exhausted می‌شود.
3. ربات همان درخواست را با کلید بعدی امتحان می‌کند.
4. اگر کلید دیگری موجود باشد، کاربر هیچ خطایی مشاهده نمی‌کند.
5. اگر همه کلیدها ناموفق باشند، فقط پیام آماده به کاربر ارسال می‌شود.
6. جزئیات خطا فقط برای ادمین‌ها ارسال می‌شود.

## Backup / Restore

از پنل Backup می‌توانید یک فایل JSON کامل دریافت کنید. این فایل شامل کاربران، ادمین‌ها، Ticketها، پیام‌ها، FAQها، پاسخ‌های آماده، تنظیمات، کلیدهای Gemini و کاربران پنل است.

**فایل Backup را محرمانه نگه دارید** چون شامل داده‌های حساس سیستم است.

برای Restore، فایل Backup را از همان صفحه انتخاب کنید. قبل از Restore، دیتابیس فعلی پاک و اطلاعات Backup جایگزین می‌شود.

## Deploy در Deplexo

اگر Deplexo یک Docker deployment استاندارد ارائه می‌دهد:

1. Repository را به GitHub Push کنید.
2. پروژه را در Deplexo به GitHub متصل کنید.
3. نوع Deploy را Docker/Container انتخاب کنید.
4. Port را روی `3000` قرار دهید.
5. PostgreSQL را ایجاد کنید یا PostgreSQL خارجی متصل کنید.
6. تمام متغیرهای `.env.example` را در Environment Variables وارد کنید.
7. Deploy را اجرا کنید.
8. بعد از بالا آمدن سایت، `/admin` را باز کنید.
9. از پنل Gemini کلیدهای API را اضافه کنید.
10. از پنل Webhook را برای Bale ثبت کنید.

## تست سریع

```bash
curl https://YOUR-DOMAIN/api/health
```

باید پاسخ JSON سالم دریافت شود.

## نکات امنیتی

- `ADMIN_PANEL_PASSWORD` را عوض کنید.
- `SESSION_SECRET` طولانی و تصادفی باشد.
- `WEBHOOK_SECRET` طولانی و تصادفی باشد.
- Backup را عمومی یا داخل GitHub قرار ندهید.
- `.env` را Commit نکنید.
- API Keyهای Gemini را در کد قرار ندهید.

## GitHub

محتویات همین پوشه را در Repository قرار دهید. فایل‌های جدید این نسخه:

```text
Dockerfile
.dockerignore
docker-entrypoint.sh
README.md
```

فایل‌های هم‌نام قبلی را Replace کنید.
