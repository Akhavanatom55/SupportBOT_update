from __future__ import annotations

from bale import InlineKeyboardButton, InlineKeyboardMarkup, MenuKeyboardButton, MenuKeyboardMarkup


# User keyboard intentionally contains only the action requested by the client.
def user_main_keyboard() -> MenuKeyboardMarkup:
    keyboard = MenuKeyboardMarkup()
    keyboard.add(MenuKeyboardButton("ثبت درخواست جدید"))
    return keyboard


def active_chat_keyboard() -> MenuKeyboardMarkup:
    keyboard = MenuKeyboardMarkup()
    keyboard.add(MenuKeyboardButton("بستن چت"))
    return keyboard


def user_cancel_keyboard() -> MenuKeyboardMarkup:
    keyboard = MenuKeyboardMarkup()
    keyboard.add(MenuKeyboardButton("بستن چت"))
    return keyboard


def admin_main_keyboard() -> MenuKeyboardMarkup:
    keyboard = MenuKeyboardMarkup()
    keyboard.add(MenuKeyboardButton("📢 ارسال پیام همگانی"))
    keyboard.add(MenuKeyboardButton("✉️ ارسال پیام به کاربر خاص"))
    keyboard.add(MenuKeyboardButton("📊 آمار ربات"))
    keyboard.add(MenuKeyboardButton("👥 لیست کاربران"))
    keyboard.add(MenuKeyboardButton("🔙 خروج از پنل مدیریت"))
    return keyboard


def admin_cancel_keyboard() -> MenuKeyboardMarkup:
    keyboard = MenuKeyboardMarkup()
    keyboard.add(MenuKeyboardButton("❌ لغو عملیات"))
    return keyboard


def confirm_broadcast_keyboard() -> InlineKeyboardMarkup:
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton("✅ تأیید و ارسال", callback_data="broadcast_confirm"))
    keyboard.add(InlineKeyboardButton("❌ انصراف", callback_data="broadcast_cancel"))
    return keyboard
