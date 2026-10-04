from __future__ import annotations

import asyncio
from typing import Any

from bale import Bot, CallbackQuery, Message

from config import (
    ADMIN_IDS,
    BOT_NAME,
    BOT_TOKEN,
    FALLBACK_SUPPORT_MESSAGE,
    GEMINI_ENABLED,
    GROUP_CHAT_ID,
    ORGANIZATION_NAME,
    validate_settings,
)
from database import (
    close_support_chat,
    create_support_chat,
    get_all_users,
    get_chat_messages,
    get_open_chat,
    get_user,
    get_user_id_by_bot_message,
    get_users_count,
    init_db,
    save_chat_message,
    save_message_link,
    upsert_user,
)
from gemini_service import get_gemini_service, redact_sensitive_data
from keyboards import (
    active_chat_keyboard,
    admin_cancel_keyboard,
    admin_main_keyboard,
    confirm_broadcast_keyboard,
    user_cancel_keyboard,
    user_main_keyboard,
)

validate_settings()

bot = Bot(token=BOT_TOKEN)

ADMIN_STATES: dict[int, dict[str, Any]] = {}


def is_admin(user_id: int) -> bool:
    return int(user_id) in ADMIN_IDS


def is_private_chat(message: Message) -> bool:
    return str(getattr(message.chat, "type", "")).lower() == "private"


def display_name(first_name: str | None, last_name: str | None = None) -> str:
    first_name = (first_name or "").strip() or "کاربر"
    last_name = (last_name or "").strip()
    return f"{first_name} {last_name}".strip() if last_name else first_name


def username_text(username: str | None) -> str:
    username = (username or "").strip()
    return f"@{username}" if username else "ندارد"


def safe_text(value: str | None, limit: int = 3500) -> str:
    text = (value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def message_kind(message: Message) -> str:
    if message.text:
        return "text"
    if message.caption:
        if getattr(message, "photos", None):
            return "photo"
        if message.video:
            return "video"
        if message.document:
            return "document"
        if message.audio:
            return "audio"
        if message.animation:
            return "animation"
        return "captioned"
    if getattr(message, "photos", None):
        return "photo"
    if message.video:
        return "video"
    if message.document:
        return "document"
    if message.audio:
        return "audio"
    if message.animation:
        return "animation"
    if message.sticker:
        return "sticker"
    if message.contact:
        return "contact"
    if message.location:
        return "location"
    return "unknown"


def build_user_message_summary(message: Message, support_chat_id: int | None = None) -> str:
    user = message.from_user
    user_id = user.id if user else 0
    name = display_name(user.first_name if user else None, user.last_name if user else None)
    uname = username_text(user.username if user else None)
    kind = message_kind(message)

    header = [
        "📨 پیام جدید از کاربر",
        "━━━━━━━━━━━━━━━━━━━━",
        f"👤 نام: {name}",
        f"🆔 آیدی کاربر: {user_id}",
        f"📎 یوزرنیم: {uname}",
        f"💬 نوع پیام: {kind}",
        f"🪪 آیدی پیام کاربر: {message.message_id}",
    ]
    if support_chat_id:
        header.append(f"🧵 شماره چت پشتیبانی: {support_chat_id}")
    header.append("")

    if message.text:
        body = f"📝 متن پیام:\n{safe_text(message.text)}"
    elif message.caption:
        body = f"📝 توضیح/کپشن:\n{safe_text(message.caption)}"
    elif message.contact:
        body = "📇 کاربر یک مخاطب ارسال کرده است."
    elif message.location:
        body = "📍 کاربر یک موقعیت مکانی ارسال کرده است."
    elif message.sticker:
        body = "🙂 کاربر یک استیکر ارسال کرده است."
    elif getattr(message, "photos", None):
        body = "🖼 کاربر یک تصویر ارسال کرده است."
    elif message.video:
        body = "🎬 کاربر یک ویدئو ارسال کرده است."
    elif message.audio:
        body = "🎵 کاربر یک فایل صوتی ارسال کرده است."
    elif message.document:
        body = "📎 کاربر یک فایل ارسال کرده است."
    elif message.animation:
        body = "✨ کاربر یک گیف/انیمیشن ارسال کرده است."
    else:
        body = "ℹ️ پیام کاربر از نوعی است که جزئیات بیشتری در دسترس نیست."

    footer = "\n\n📌 پیام اصلی کاربر نیز برای بررسی بیشتر ارسال می‌شود." if kind != "text" else ""
    return "\n".join(header) + body + footer


async def send_summary_to_recipient(
    message: Message,
    recipient_chat_id: str | int,
    support_chat_id: int | None = None,
) -> None:
    summary = build_user_message_summary(message, support_chat_id=support_chat_id)
    sent = await bot.send_message(recipient_chat_id, summary)
    await save_message_link(
        chat_id=recipient_chat_id,
        bot_message_id=sent.message_id,
        user_id=message.from_user.id,
        user_message_id=message.message_id,
        message_kind=message_kind(message),
    )

    if message_kind(message) != "text":
        try:
            forwarded = await message.forward(recipient_chat_id)
            await save_message_link(
                chat_id=recipient_chat_id,
                bot_message_id=forwarded.message_id,
                user_id=message.from_user.id,
                user_message_id=message.message_id,
                message_kind=f"forwarded_{message_kind(message)}",
            )
        except Exception:
            pass


async def fan_out_user_message(message: Message, support_chat_id: int | None = None) -> None:
    recipients: list[str | int] = [admin_id for admin_id in ADMIN_IDS]
    if GROUP_CHAT_ID:
        recipients.append(GROUP_CHAT_ID)

    for recipient in recipients:
        try:
            await send_summary_to_recipient(message, recipient, support_chat_id=support_chat_id)
        except Exception as exc:
            print(f"خطا در ارسال پیام به مقصد {recipient}: {exc}")


async def send_user_confirmation(message: Message) -> None:
    await message.reply(
        "✅ پیام شما ثبت شد.\n"
        "پشتیبانی در حال بررسی درخواست شماست و در همین چت پاسخ داده می‌شود.",
        components=active_chat_keyboard(),
    )


async def handle_user_start(message: Message) -> None:
    user = message.from_user
    await upsert_user(
        user_id=user.id,
        username=user.username or "",
        first_name=user.first_name or "",
        last_name=user.last_name or "",
    )

    name = display_name(user.first_name, user.last_name)
    text = (
        f"🌟 {BOT_NAME}\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"سلام {name} عزیز، خوش آمدید.\n\n"
        "برای ثبت درخواست پشتیبانی، روی دکمه زیر بزنید."
    )
    await message.reply(text, components=user_main_keyboard())


async def handle_user_request_prompt(message: Message) -> None:
    existing = await get_open_chat(message.from_user.id)
    if existing:
        await message.reply(
            "شما یک چت پشتیبانی باز دارید. پیام‌های بعدی‌تان را در همین چت ارسال کنید.",
            components=active_chat_keyboard(),
        )
        return

    chat_id = await create_support_chat(message.from_user.id)
    text = (
        "📩 ثبت درخواست جدید\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "کاربر گرامی، درخواستی که دارید را کامل و واضح بنویسید.\n\n"
        "حتماً در پایان متن، شماره تلفن، کد ملی و در صورت نیاز کد پرسنلی خودتان را درج کنید.\n"
        "برای امنیت بیشتر، رمز عبور خود را ارسال نکنید.\n\n"
        "پس از ارسال اولین پیام، تا هر تعداد که لازم دارید می‌توانید در همین چت پیام بفرستید.\n"
        "برای پایان درخواست، دکمه «بستن چت» را بزنید."
    )
    await message.reply(text, components=user_cancel_keyboard())
    print(f"🧵 چت جدید ایجاد شد: user={message.from_user.id}, chat={chat_id}")


async def handle_user_close_chat(message: Message) -> None:
    chat_id = await close_support_chat(message.from_user.id)
    if not chat_id:
        await message.reply("چت بازی برای شما وجود ندارد.", components=user_main_keyboard())
        return

    await message.reply(
        "✅ درخواست شما بسته شد.\n"
        "هر زمان درخواست دیگری داشتید، می‌توانید روی «ثبت درخواست جدید» بزنید.",
        components=user_main_keyboard(),
    )

    # Also inform administrators that this support conversation was closed.
    close_notice = (
        "🔒 چت پشتیبانی بسته شد\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 آیدی کاربر: {message.from_user.id}\n"
        f"🧵 شماره چت: {chat_id}"
    )
    for recipient in [*ADMIN_IDS, *([GROUP_CHAT_ID] if GROUP_CHAT_ID else [])]:
        try:
            await bot.send_message(recipient, close_notice)
        except Exception as exc:
            print(f"خطا در ارسال اعلان بسته‌شدن چت به {recipient}: {exc}")


async def handle_user_support_message(message: Message) -> bool:
    if not is_private_chat(message) or is_admin(message.from_user.id):
        return False

    chat = await get_open_chat(message.from_user.id)
    if not chat:
        return False

    raw_text = (message.content or message.text or message.caption or "").strip()
    if not raw_text:
        await fan_out_user_message(message, support_chat_id=chat["chat_id"])
        await message.reply(
            "✅ پیام شما برای پشتیبانی ارسال شد. لطفاً توضیح را به صورت متنی هم وارد کنید تا راهنمایی دقیق‌تری دریافت کنید.",
            components=active_chat_keyboard(),
        )
        return True

    await save_chat_message(chat["chat_id"], "user", redact_sensitive_data(raw_text))
    await fan_out_user_message(message, support_chat_id=chat["chat_id"])

    if not GEMINI_ENABLED:
        await message.reply(FALLBACK_SUPPORT_MESSAGE, components=active_chat_keyboard())
        await save_chat_message(chat["chat_id"], "assistant", FALLBACK_SUPPORT_MESSAGE)
        return True

    history = await get_chat_messages(chat["chat_id"], limit=12)
    replies = await get_gemini_service().generate_reply(raw_text, history[:-1])

    for reply_text in replies:
        reply_text = safe_text(reply_text, limit=3000)
        if not reply_text:
            continue
        await message.reply(reply_text, components=active_chat_keyboard())
        await save_chat_message(chat["chat_id"], "assistant", reply_text)
        await asyncio.sleep(0.35)
    return True


async def handle_admin_start(message: Message) -> None:
    admin = message.from_user
    name = display_name(admin.first_name, admin.last_name)
    text = (
        "👑 پنل مدیریت\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"خوش آمدید {name} عزیز.\n\n"
        "از منوی زیر عملیات مورد نظر را انتخاب نمایید."
    )
    await message.reply(text, components=admin_main_keyboard())


async def handle_admin_cancel(message: Message) -> None:
    ADMIN_STATES.pop(message.from_user.id, None)
    await message.reply("↩️ عملیات لغو شد و به پنل مدیریت بازگشتید.", components=admin_main_keyboard())


async def handle_admin_broadcast_prompt(message: Message) -> None:
    ADMIN_STATES[message.from_user.id] = {"state": "awaiting_broadcast"}
    text = (
        "📢 ارسال پیام همگانی\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "متن اطلاعیه را وارد نمایید.\n\n"
        "این پیام برای تمامی کاربران ثبت‌شده ارسال خواهد شد."
    )
    await message.reply(text, components=admin_cancel_keyboard())


async def handle_admin_target_prompt(message: Message) -> None:
    ADMIN_STATES[message.from_user.id] = {"state": "awaiting_target_user_id"}
    text = (
        "✉️ ارسال پیام به کاربر خاص\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        "لطفاً آیدی عددی کاربر را وارد نمایید."
    )
    await message.reply(text, components=admin_cancel_keyboard())


async def handle_admin_stats(message: Message) -> None:
    count = await get_users_count()
    await message.reply(
        "📊 آمار ربات\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"👥 تعداد کاربران ثبت‌شده: {count:,} نفر",
        components=admin_main_keyboard(),
    )


async def handle_admin_users(message: Message) -> None:
    users = await get_all_users()
    if not users:
        await message.reply("👥 هنوز هیچ کاربری ثبت نشده است.", components=admin_main_keyboard())
        return

    lines = [
        "👥 آخرین کاربران ثبت‌شده",
        "━━━━━━━━━━━━━━━━━━━━",
        f"تعداد کل: {len(users)} نفر",
        "",
    ]
    for index, user in enumerate(users[:20], start=1):
        lines.append(
            f"{index}. {display_name(user['first_name'], user['last_name'])} | "
            f"🆔 {user['user_id']} | 📎 {username_text(user['username'])}"
        )
    if len(users) > 20:
        lines.extend(["", f"و {len(users) - 20} کاربر دیگر..."])

    await message.reply("\n".join(lines), components=admin_main_keyboard())


async def handle_admin_reply(message: Message) -> bool:
    if not message.reply_to_message:
        return False

    target_user_id = await get_user_id_by_bot_message(message.chat_id, message.reply_to_message.message_id)
    if not target_user_id:
        return False

    reply_text = (message.content or message.text or message.caption or "").strip()
    if not reply_text:
        await message.reply("لطفاً متن پاسخ را وارد نمایید.", components=admin_main_keyboard())
        return True

    support_text = (
        "💬 پاسخ از پشتیبانی\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{safe_text(reply_text)}\n\n"
        "در صورت نیاز، می‌توانید دوباره پیام ارسال نمایید."
    )

    try:
        sent = await bot.send_message(target_user_id, support_text)
        await save_message_link(
            chat_id=target_user_id,
            bot_message_id=sent.message_id,
            user_id=target_user_id,
            user_message_id=message.reply_to_message.message_id,
            message_kind="support_reply",
        )
        await message.reply("✅ پاسخ با موفقیت برای کاربر ارسال شد.", components=admin_main_keyboard())
    except Exception as exc:
        await message.reply(f"❌ خطا در ارسال پاسخ: {exc}", components=admin_main_keyboard())

    return True


async def handle_admin_text(message: Message) -> bool:
    admin_id = message.from_user.id
    state_data = ADMIN_STATES.get(admin_id)
    if not state_data:
        return False

    state = state_data.get("state")
    text = (message.content or message.text or message.caption or "").strip()

    if state == "awaiting_broadcast":
        ADMIN_STATES[admin_id] = {"state": "confirm_broadcast", "data": {"text": text}}
        preview = (
            "📢 پیش‌نمایش پیام همگانی\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            f"{safe_text(text)}\n\n"
            "آیا ارسال این پیام را تأیید می‌کنید؟"
        )
        await message.reply(preview, components=confirm_broadcast_keyboard())
        return True

    if state == "awaiting_target_user_id":
        if not text.isdigit():
            await message.reply("❌ آیدی واردشده معتبر نیست. لطفاً یک عدد صحیح وارد کنید.", components=admin_cancel_keyboard())
            return True

        target_user_id = int(text)
        user = await get_user(target_user_id)
        if not user:
            await message.reply(
                f"⚠️ کاربری با آیدی {target_user_id} در پایگاه داده یافت نشد.",
                components=admin_cancel_keyboard(),
            )
            return True

        ADMIN_STATES[admin_id] = {
            "state": "awaiting_target_message",
            "data": {"target_user_id": target_user_id, "target_name": display_name(user["first_name"], user["last_name"])},
        }
        await message.reply("✉️ متن پیام را وارد نمایید:", components=admin_cancel_keyboard())
        return True

    if state == "awaiting_target_message":
        target_user_id = int(state_data["data"]["target_user_id"])
        target_name = state_data["data"]["target_name"]
        try:
            sent = await bot.send_message(
                target_user_id,
                "📬 پیام از پشتیبانی\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                f"{safe_text(text)}",
            )
            await save_message_link(
                chat_id=target_user_id,
                bot_message_id=sent.message_id,
                user_id=target_user_id,
                user_message_id=sent.message_id,
                message_kind="direct_support_message",
            )
            ADMIN_STATES.pop(admin_id, None)
            await message.reply(
                f"✅ پیام برای {target_name} با آیدی {target_user_id} ارسال شد.",
                components=admin_main_keyboard(),
            )
        except Exception as exc:
            await message.reply(f"❌ خطا در ارسال پیام: {exc}", components=admin_main_keyboard())
        return True

    return False


async def handle_callback(callback: CallbackQuery) -> None:
    data = (callback.data or "").strip()
    admin_id = int(callback.from_user.id)

    if data == "broadcast_confirm":
        state_data = ADMIN_STATES.get(admin_id)
        if not state_data or state_data.get("state") != "confirm_broadcast":
            if callback.message:
                await callback.message.reply("⚠️ این عملیات منقضی شده است.", components=admin_main_keyboard())
            return

        broadcast_text = state_data["data"]["text"]
        users = await get_all_users()
        success = 0
        failed = 0

        if callback.message:
            try:
                await callback.message.edit("⏳ در حال ارسال پیام همگانی...")
            except Exception:
                pass

        for user in users:
            try:
                sent = await bot.send_message(
                    user["user_id"],
                    "📢 اطلاعیه رسمی\n"
                    "━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"{safe_text(broadcast_text)}\n\n"
                    f"🏢 {ORGANIZATION_NAME}",
                )
                await save_message_link(
                    chat_id=user["user_id"],
                    bot_message_id=sent.message_id,
                    user_id=user["user_id"],
                    user_message_id=sent.message_id,
                    message_kind="broadcast",
                )
                success += 1
            except Exception:
                failed += 1

        ADMIN_STATES.pop(admin_id, None)
        await bot.send_message(
            admin_id,
            "📊 نتیجه ارسال پیام همگانی\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            f"✅ موفق: {success}\n"
            f"❌ ناموفق: {failed}\n"
            f"👥 کل: {len(users)}",
            components=admin_main_keyboard(),
        )
        return

    if data == "broadcast_cancel":
        ADMIN_STATES.pop(admin_id, None)
        if callback.message:
            try:
                await callback.message.edit("↩️ ارسال پیام همگانی لغو شد.")
            except Exception:
                await callback.message.reply("↩️ ارسال پیام همگانی لغو شد.", components=admin_main_keyboard())
        else:
            await bot.send_message(admin_id, "↩️ ارسال پیام همگانی لغو شد.", components=admin_main_keyboard())


@bot.event
async def on_before_ready() -> None:
    try:
        await bot.delete_webhook()
    except Exception:
        pass


@bot.event
async def on_ready() -> None:
    print("=" * 60)
    print(f"🤖 {BOT_NAME}")
    print("=" * 60)
    print("✅ پایگاه داده آماده شد.")
    print(f"👑 تعداد مدیران تعریف‌شده: {len(ADMIN_IDS)}")
    print(f"🧠 Gemini فعال: {'بله' if GEMINI_ENABLED else 'خیر'}")
    print("=" * 60)


@bot.event
async def on_message(message: Message) -> None:
    if not message.from_user:
        return

    user_id = int(message.from_user.id)
    content = (message.content or message.text or message.caption or "").strip()
    private_chat = is_private_chat(message)

    await upsert_user(
        user_id=user_id,
        username=message.from_user.username or "",
        first_name=message.from_user.first_name or "",
        last_name=message.from_user.last_name or "",
    )

    if user_id in ADMIN_IDS and message.reply_to_message:
        if await handle_admin_reply(message):
            return

    if content == "/start":
        if user_id in ADMIN_IDS:
            if private_chat:
                await handle_admin_start(message)
            else:
                await message.reply("برای استفاده از پنل مدیریت، لطفاً در گفت‌وگوی خصوصی با ربات وارد شوید.")
        else:
            if private_chat:
                await handle_user_start(message)
        return

    if content == "/admin" and user_id in ADMIN_IDS:
        if private_chat:
            await handle_admin_start(message)
        else:
            await message.reply("برای استفاده از پنل مدیریت، لطفاً در گفت‌وگوی خصوصی با ربات وارد شوید.")
        return

    if user_id in ADMIN_IDS and private_chat:
        if content == "📢 ارسال پیام همگانی":
            await handle_admin_broadcast_prompt(message)
            return
        if content == "✉️ ارسال پیام به کاربر خاص":
            await handle_admin_target_prompt(message)
            return
        if content == "📊 آمار ربات":
            await handle_admin_stats(message)
            return
        if content == "👥 لیست کاربران":
            await handle_admin_users(message)
            return
        if content == "🔙 خروج از پنل مدیریت":
            await message.reply("🔙 از پنل مدیریت خارج شدید.", components=user_main_keyboard())
            return
        if content == "❌ لغو عملیات":
            await handle_admin_cancel(message)
            return
        if await handle_admin_text(message):
            return
        await handle_admin_start(message)
        return

    if private_chat and not is_admin(user_id):
        if content == "ثبت درخواست جدید":
            await handle_user_request_prompt(message)
            return
        if content == "بستن چت":
            await handle_user_close_chat(message)
            return
        if await handle_user_support_message(message):
            return
        await message.reply(
            "برای شروع، روی «ثبت درخواست جدید» بزنید.",
            components=user_main_keyboard(),
        )


@bot.event
async def on_callback(callback: CallbackQuery) -> None:
    await handle_callback(callback)


async def bootstrap() -> None:
    await init_db()


if __name__ == "__main__":
    asyncio.run(bootstrap())
