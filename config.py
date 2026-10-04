from __future__ import annotations

import os
import re
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _parse_admin_ids(raw_value: str | None) -> list[int]:
    if not raw_value:
        return []
    parts = re.split(r"[\s,;]+", raw_value.strip())
    values: list[int] = []
    for part in parts:
        if part and (part.isdigit() or (part.startswith("-") and part[1:].isdigit())):
            values.append(int(part))
    return list(dict.fromkeys(values))


BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_IDS = _parse_admin_ids(os.getenv("ADMIN_IDS"))
GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID", "").strip()
BOT_NAME = os.getenv("BOT_NAME", "ربات پشتیبانی بله").strip()
ORGANIZATION_NAME = os.getenv("ORGANIZATION_NAME", "شرکت فولاد مبارکه اصفهان").strip()
DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "support_bot.db")).strip()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_ENABLED = os.getenv("GEMINI_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}

CHAT_HISTORY_LIMIT = max(4, int(os.getenv("CHAT_HISTORY_LIMIT", "12")))
AI_MAX_OUTPUT_TOKENS = max(128, int(os.getenv("AI_MAX_OUTPUT_TOKENS", "450")))

FALLBACK_SUPPORT_MESSAGE = (
    "تیم پشتیبانی ما به زودی مشکل رو براتون حل می‌کنن و بهتون اطلاع می‌دن، تو همین ربات."
)


def validate_settings() -> None:
    errors: list[str] = []
    if not BOT_TOKEN:
        errors.append("BOT_TOKEN تنظیم نشده است.")
    if not ADMIN_IDS:
        errors.append("ADMIN_IDS تنظیم نشده است.")
    if GEMINI_ENABLED and not GEMINI_API_KEY:
        errors.append("GEMINI_API_KEY تنظیم نشده است. برای غیرفعال کردن پاسخ هوشمند GEMINI_ENABLED=false قرار دهید.")
    if errors:
        raise RuntimeError(" | ".join(errors))
