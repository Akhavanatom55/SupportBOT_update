from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

from config import AI_MAX_OUTPUT_TOKENS, FALLBACK_SUPPORT_MESSAGE, GEMINI_API_KEY, GEMINI_MODEL


SYSTEM_PROMPT = """
تو دستیار پاسخ‌گوی پشتیبانی یک سامانه ایرانی هستی. نقش تو این است که پیام‌های کاربران را کوتاه، محترمانه، طبیعی و کاربردی پاسخ بدهی؛ طوری که پاسخ شبیه کارشناس پشتیبانی انسانی باشد.

قواعد قطعی:
1) هرگز نگو هوش مصنوعی، ربات، Gemini یا مدل زبانی هستی.
2) پاسخ را فقط به زبان فارسی بنویس.
3) از لحن رسمی اما صمیمی استفاده کن و وارد توضیحات طولانی نشو.
4) اگر مشکل کاربر مربوط به نرسیدن پیامک هنگام آزمون/ورود/تأیید است، پاسخ را در دو پیام جداگانه بساز:
   پیام اول: چند اقدام مشخص مثل بررسی پوشه Spam/هرزنامه یا پیامک‌های مسدودشده و اطمینان از آنتن و ظرفیت پیامک.
   پیام دوم: دقیقاً این جمله را به‌تنهایی ارسال کن: «به زودی پیامک جدید برای شما ارسال خواهد شد.»
   هرگز ادعا نکن پیامک همین حالا ارسال شده یا شما شخصاً آن را ارسال کرده‌اید.
5) اگر کاربر می‌گوید با رمز و شناسه/آی‌دی وارد سامانه نمی‌شود، ابتدا راهنمایی کوتاه ارائه کن و در صورت نیاز از او بخواه کد ملی، شماره تلفن و کد پرسنلی را برای پیگیری بفرستد. هرگز از کاربر نخواه رمز عبور خود را ارسال کند.
6) اگر کاربر اطلاعات هویتی یا تماسی را قبلاً داده باشد، دوباره صرفاً به خاطر قواعد شماره 5 آن را تکراراً درخواست نکن.
7) اگر پاسخ قطعی را نمی‌دانی، دقیقاً از این مضمون استفاده کن: «تیم پشتیبانی ما به زودی مشکل رو براتون حل می‌کنن و بهتون اطلاع می‌دن، تو همین ربات.»
8) هیچ لینک، تبلیغ، شماره تلفن ساختگی، زمان‌بندی ساختگی یا قول قطعی خارج از اطلاعات داده‌شده نساز.
9) پاسخ را حداکثر در دو پیام جداگانه برگردان.
10) خروجی باید JSON معتبر و فقط با این ساختار باشد:
{"messages":["پیام اول","پیام دوم"]}
اگر فقط یک پاسخ لازم است، آرایه messages فقط یک عضو داشته باشد.
""".strip()


@dataclass(slots=True)
class UserPIIFlags:
    phone: bool = False
    national_id: bool = False
    personnel_code: bool = False


def _normalize_digits(text: str) -> str:
    translation = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
    return text.translate(translation)


def _contains_phone(text: str) -> bool:
    normalized = _normalize_digits(text)
    return bool(re.search(r"(?:\+98|0098|0)?9\d{9}", normalized.replace(" ", "")))


def _contains_national_id(text: str) -> bool:
    normalized = _normalize_digits(text)
    for candidate in re.findall(r"\d{10}", normalized):
        if candidate == candidate[0] * 10:
            continue
        return True
    return False


def _contains_personnel_code(text: str) -> bool:
    normalized = _normalize_digits(text)
    return bool(re.search(r"(?:کد\s*پرسنلی|پرسنلی)\s*[:：-]?\s*\d{3,12}", normalized, re.I))


def detect_pii_flags(text: str) -> UserPIIFlags:
    return UserPIIFlags(
        phone=_contains_phone(text),
        national_id=_contains_national_id(text),
        personnel_code=_contains_personnel_code(text),
    )


def redact_sensitive_data(text: str) -> str:
    normalized = _normalize_digits(text)
    normalized = re.sub(r"(?:\+98|0098|0)?9\d{9}", "[شماره‌تلفن حذف شد]", normalized.replace(" ", ""))
    normalized = re.sub(r"\b\d{10}\b", "[کدملی حذف شد]", normalized)
    normalized = re.sub(
        r"((?:کد\s*پرسنلی|پرسنلی)\s*[:：-]?\s*)\d{3,12}",
        r"\1[کدپرسنلی حذف شد]",
        normalized,
        flags=re.I,
    )
    normalized = re.sub(r"(رمز\s*(?:عبور)?\s*[:：-]?\s*)\S+", r"\1[رمز حذف شد]", normalized, flags=re.I)
    return normalized


def _safe_json_load(text: str) -> list[str] | None:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data: Any = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    messages = data.get("messages") if isinstance(data, dict) else None
    if not isinstance(messages, list):
        return None
    result = [str(item).strip() for item in messages if str(item).strip()]
    return result[:2] if result else None


class GeminiSupportService:
    def __init__(self) -> None:
        self.client = genai.Client(api_key=GEMINI_API_KEY)

    async def generate_reply(self, user_text: str, history: list[dict]) -> list[str]:
        pii = detect_pii_flags(user_text)
        safe_current = redact_sensitive_data(user_text)

        conversation_lines: list[str] = []
        for item in history[-12:]:
            role = "کاربر" if item["role"] == "user" else "پشتیبانی"
            conversation_lines.append(f"{role}: {redact_sensitive_data(item['content'])}")

        context = "\n".join(conversation_lines) if conversation_lines else "(این اولین پیام این چت است.)"
        prompt = f"""
وضعیت داده‌های شناسایی‌شده در پیام جدید:
- شماره تلفن موجود است: {'بله' if pii.phone else 'خیر'}
- کد ملی موجود است: {'بله' if pii.national_id else 'خیر'}
- کد پرسنلی موجود است: {'بله' if pii.personnel_code else 'خیر'}

تاریخچه گفت‌وگو:
{context}

پیام جدید کاربر (نسخه بدون اطلاعات شناسایی‌کننده):
{safe_current}

اکنون فقط JSON معتبر با کلید messages برگردان.
""".strip()

        try:
            response = await self.client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.2,
                    max_output_tokens=AI_MAX_OUTPUT_TOKENS,
                    response_mime_type="application/json",
                ),
            )
            parsed = _safe_json_load(response.text or "")
            if parsed:
                return parsed
        except Exception as exc:
            print(f"Gemini error: {exc}")

        return [FALLBACK_SUPPORT_MESSAGE]


_gemini_service: GeminiSupportService | None = None


def get_gemini_service() -> GeminiSupportService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiSupportService()
    return _gemini_service
