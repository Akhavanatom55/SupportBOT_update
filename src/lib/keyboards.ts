import { InlineKeyboard } from "@/lib/bale";

export const mainMenuKeyboard: InlineKeyboard = {
  inline_keyboard: [
    [{ text: "📝 ثبت درخواست جدید", callback_data: "new_ticket" }],
    [{ text: "❓ سوالات متداول", callback_data: "faq_list:0" }],
    [{ text: "ℹ️ درباره ما", callback_data: "about" }],
  ],
};

export const ticketOpenKeyboard: InlineKeyboard = {
  inline_keyboard: [[{ text: "✅ بستن درخواست", callback_data: "close_ticket" }]],
};

export function faqListKeyboard(
  items: { id: number; question: string }[],
  page: number,
  hasNext: boolean,
): InlineKeyboard {
  const rows = items.map((item) => [
    { text: item.question.slice(0, 60), callback_data: `faq_item:${item.id}:${page}` },
  ]);
  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: "⬅️ قبلی", callback_data: `faq_list:${page - 1}` });
  if (hasNext) nav.push({ text: "➡️ بعدی", callback_data: `faq_list:${page + 1}` });
  if (nav.length > 0) rows.push(nav);
  rows.push([{ text: "🏠 منوی اصلی", callback_data: "main_menu" }]);
  return { inline_keyboard: rows };
}

export function faqBackKeyboard(page: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "⬅️ بازگشت به سوالات", callback_data: `faq_list:${page}` }],
      [{ text: "🏠 منوی اصلی", callback_data: "main_menu" }],
    ],
  };
}

export function adminTicketKeyboard(ticketId: number, claimed: boolean, aiPaused: boolean): InlineKeyboard {
  const rows: { text: string; callback_data: string }[][] = [
    [{ text: "✍️ پاسخ به این تیکت", callback_data: `reply:${ticketId}` }],
  ];
  rows.push([
    claimed
      ? { text: "🔁 آزاد کردن تیکت", callback_data: `unclaim:${ticketId}` }
      : { text: "🙋 تحویل گرفتن تیکت", callback_data: `claim:${ticketId}` },
    aiPaused
      ? { text: "🤖 فعال‌سازی پاسخ خودکار", callback_data: `resume_ai:${ticketId}` }
      : { text: "⏸ توقف پاسخ خودکار", callback_data: `pause_ai:${ticketId}` },
  ]);
  rows.push([{ text: "🔒 بستن تیکت", callback_data: `admin_close:${ticketId}` }]);
  return { inline_keyboard: rows };
}

export function ratingKeyboard(ticketId: number): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "😍 عالی", callback_data: `rate:${ticketId}:5` },
        { text: "🙂 خوب", callback_data: `rate:${ticketId}:3` },
        { text: "☹️ ضعیف", callback_data: `rate:${ticketId}:1` },
      ],
    ],
  };
}
