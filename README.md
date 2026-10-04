# SupportBOT — Bale + Gemini + Web Admin (Unified)

این نسخه یک پروژه واحد برای **ربات پشتیبانی بله + پنل مدیریت وب** است. ربات و سایت داخل **یک Next.js service و یک Docker container** اجرا می‌شوند و هر دو از یک دیتابیس SQLite مشترک استفاده می‌کنند.

این معماری برای Deplexo طراحی شده تا به `aiosqlite` و Threadهای اضافی Python وابسته نباشد و خطای `RuntimeError: can't start new thread` ایجاد نکند.

## امکانات اصلی

### ربات بله

- `/start` و منوی اصلی با دکمه‌های ثبت درخواست، سوالات متداول و درباره ما
- Ticket مجزا برای هر کاربر
- ارسال همزمان درخواست کاربر برای ادمین‌ها و گروه پشتیبانی
- پاسخ ادمین به کاربر از داخل چت بله
- اختصاص Ticket به ادمین، توقف/فعال‌سازی AI و بستن Ticket
- امتیازدهی کاربر پس از پایان گفتگو
- FAQ با صفحه‌بندی و شمارش بازدید
- پاسخ‌های آماده دستی و پاسخ‌های خودکار بر اساس کلمات کلیدی
- Fallback خودکار هنگام خاموش بودن AI یا خطا/Quota جمنای
- خطای فنی Gemini هیچ‌وقت برای کاربر نمایش داده نمی‌شود و فقط برای ادمین‌ها گزارش می‌شود

### Gemini

- چند API Key در دیتابیس
- اولویت‌بندی کلیدها
- سوییچ خودکار هنگام 429 / quota / rate limit
- علامت‌گذاری کلید exhausted و خارج کردن آن از چرخه تا زمان بازیابی
- استفاده از کلید بعدی برای همان درخواست
- انتخاب Model ID از پنل
- System Prompt کاملاً قابل ویرایش از پنل
- در صورت شکست همه کلیدها، کاربر فقط پیام آماده دریافت می‌کند

### پنل وب `/admin`

- Dashboard و آمار
- مدیریت Ticketها
- مدیریت چند Gemini API Key
- FAQ: ایجاد، ویرایش، انتشار و حذف
- پاسخ‌های آماده: ایجاد، ویرایش، فعال/غیرفعال و Auto-suggest
- مدیریت ادمین‌های بله
- مدیریت حساب‌های پنل وب
- تغییر نام کاربری و رمز حسابی که همین حالا وارد پنل شده
- تغییر تنظیمات و پیام‌های ربات بدون دستکاری کد
- Broadcast به کاربران
- ثبت / حذف / بررسی Webhook بله
- مشاهده و کپی لینک پنل
- دکمه **ارسال لینک پنل برای تمام ادمین‌های بله** با دکمه مستقیم «ورود به پنل مدیریت»
- Export کامل دیتابیس
- Import/Restore کامل دیتابیس
- Health endpoint

## ساختار

```text
Bale User
   │
   ▼
Bale Bot API
   │
   ▼
Next.js Webhook + Bot Logic
   ├──────────────► Gemini API pool
   │
   ├──────────────► Web Admin /admin
   │
   └──────────────► SQLite /data/support_bot.db
```

## متغیرهای محیطی — آماده Copy/Paste برای Deplexo

کل این بلوک را کپی کنید و مقدار هر مورد را وارد کنید:

```env
# =========================================================
# SupportBOT - DEPLEXO ENVIRONMENT VARIABLES
# =========================================================

BALE_BOT_TOKEN=
BOT_TOKEN=
ADMIN_IDS=123456789,987654321
GROUP_CHAT_ID=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite

DATABASE_PATH=/data/support_bot.db

ADMIN_PANEL_USERNAME=admin
ADMIN_PANEL_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
SESSION_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS

PUBLIC_BASE_URL=
WEBHOOK_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET

BOT_NAME=ربات پشتیبانی
ORGANIZATION_NAME=تیم پشتیبانی

PORT=3000
```

### توضیح متغیرهای مهم

`BALE_BOT_TOKEN` توکن اصلی ربات بله است.

`BOT_TOKEN` فقط برای سازگاری با نسخه قدیمی Python نگه داشته شده؛ در نسخه جدید مقدار `BALE_BOT_TOKEN` اولویت دارد.

`ADMIN_IDS` شناسه عددی اولیه ادمین‌های بله است و با کاما جدا می‌شود. بعد از Deploy می‌توان ادمین‌ها را از `/admin/admins` مدیریت کرد.

`GROUP_CHAT_ID` شناسه گروهی است که تیم پشتیبانی داخل آن تیکت‌ها و هشدارها را می‌بیند.

`GEMINI_API_KEY` یک کلید اولیه/پشتیبان است. روش اصلی توصیه‌شده، اضافه کردن چند کلید از `/admin/gemini` است.

`DATABASE_PATH` را روی `/data/support_bot.db` نگه دارید تا بتوانید برای `/data` یک volume پایدار در Deplexo تنظیم کنید.

`ADMIN_PANEL_USERNAME` و `ADMIN_PANEL_PASSWORD` اطلاعات ورود اولیه هستند. بعد از اولین ورود، از `/admin/admins` می‌توانید نام کاربری و رمز حساب خودتان را تغییر دهید.

`SESSION_SECRET` باید طولانی و تصادفی باشد و در Deploy ثابت بماند.

`PUBLIC_BASE_URL` آدرس عمومی Deploy است، مثلاً:

```text
https://support.example.com
```

`WEBHOOK_SECRET` در مسیر Webhook بله استفاده می‌شود. بهتر است مقدار ثابت و تصادفی باشد.

## Deploy در Deplexo

### 1. Repository

این پروژه را به GitHub Push کنید.

### 2. Docker

Deploy method را روی Dockerfile قرار دهید.

Dockerfile این پروژه یک container واحد می‌سازد و در پایان فقط Next.js را اجرا می‌کند.

### 3. Port

پورت سرویس `3000` است. اگر Deplexo مقدار `PORT` متفاوتی تزریق می‌کند، مقدار همان متغیر استفاده می‌شود.

### 4. Volume

برای جلوگیری از پاک شدن کاربران، Ticketها، FAQ، کلیدهای Gemini و تنظیمات، حتماً یک Volume پایدار برای مسیر زیر تعریف کنید:

```text
/data
```

فایل دیتابیس در این مسیر ساخته می‌شود:

```text
/data/support_bot.db
```

### 5. Environment Variables

تمام متغیرهای داخل بلوک بالا را در Environment Variables پروژه وارد کنید.

### 6. اجرای سایت

بعد از Deploy:

```text
https://YOUR-DOMAIN/admin
```

### 7. ثبت Webhook

بعد از ورود به پنل به بخش:

```text
تنظیمات ربات → اتصال وبهوک بله
```

بروید، `PUBLIC_BASE_URL` را بررسی کنید و «ثبت وبهوک» را بزنید.

Webhook به این شکل خواهد بود:

```text
https://YOUR-DOMAIN/api/bale/webhook/YOUR_WEBHOOK_SECRET
```

## لینک پنل برای ادمین‌ها

در بخش تنظیمات پنل، قسمت:

```text
🔗 لینک پنل مدیریت سایت
```

سه قابلیت دارید:

- مشاهده URL پنل
- کپی URL
- ارسال لینک برای همه ادمین‌های بله

پیام ارسالی به ادمین‌ها شامل یک دکمه مستقیم **«🔐 ورود به پنل مدیریت»** است.

## تغییر نام کاربری و رمز پنل

به:

```text
/admin/admins
```

بروید و بخش:

```text
🔐 حساب ورود ادمین فعلی
```

را باز کنید.

برای تغییر مشخصات، رمز عبور فعلی لازم است. بعد از تغییر نام کاربری، session جدید به‌صورت خودکار صادر می‌شود و ادمین بدون Logout اجباری در پنل باقی می‌ماند.

رمز جدید حداقل ۸ کاراکتر باشد.

## Backup / Restore

در:

```text
/admin/backup
```

می‌توانید از کل دیتابیس Backup بگیرید.

Backup شامل این موارد است:

- کاربران بله
- ادمین‌های بله
- Ticketها
- تمام پیام‌های Ticket
- Gemini API Keyها و وضعیت آنها
- تنظیمات ربات
- FAQ
- پاسخ‌های آماده
- حساب‌های پنل وب
- سابقه Broadcast

**Backup را عمومی یا داخل GitHub قرار ندهید.** فایل Backup شامل اطلاعات حساس است.

در Restore، اطلاعات فعلی به‌صورت کامل پاک و محتوای Backup جایگزین می‌شود.

## مهاجرت از نسخه قدیمی Python

نسخه قبلی Repository یک Bot Python با `aiosqlite` بود. نسخه جدید به‌صورت کامل به معماری Next.js + SQLite منتقل شده است.

اگر قبلاً یک دیتابیس قدیمی در مسیر `/data/support_bot.db` داشته‌اید، برنامه در اولین اجرا Layout قدیمی Python را تشخیص می‌دهد و کاربران، Ticketها و پیام‌های قابل انتقال را به ساختار جدید منتقل می‌کند.

برای محافظت بیشتر، قبل از Deploy نسخه جدید حتماً از فایل دیتابیس فعلی Backup بگیرید.

## فایل‌هایی که از Repository قدیمی باید حذف شوند

چون ZIP نمی‌تواند فایل‌های اضافه موجود در GitHub را خودکار حذف کند، اگر این فایل‌ها هنوز در Repository قدیمی وجود دارند، آنها را Delete کنید:

```text
main.py
runner.py
config.py
database.py
gemini_service.py
keyboards.py
requirements.txt
railway.toml
docker-compose.yml
```

Dockerfile جدید، `package.json` جدید و تمام پوشه `src/` نسخه جدید را نگه دارید.

## تست Health

بعد از Deploy:

```text
https://YOUR-DOMAIN/api/health
```

باید JSON شبیه زیر دریافت شود:

```json
{"ok":true}
```

## رفع خطای قبلی Deplexo

خطای قبلی:

```text
RuntimeError: can't start new thread
```

در Stack Trace داخل `aiosqlite.connect()` رخ داده بود. نسخه فعلی دیگر `aiosqlite` یا Python Bot را اجرا نمی‌کند؛ بنابراین این مسیر ایجاد Thread اضافی در سرویس اصلی حذف شده است.

## نکات امنیتی

- `ADMIN_PANEL_PASSWORD` را مقدار پیش‌فرض نگذارید.
- `SESSION_SECRET` و `WEBHOOK_SECRET` را تصادفی و طولانی قرار دهید.
- Backup دیتابیس را محرمانه نگه دارید.
- API Key جمنای را Commit نکنید.
- `.env` را وارد GitHub نکنید.
- برای `/data` از Volume پایدار استفاده کنید.
