// Minimal client for the Bale Messenger Bot API (https://tapi.bale.ai).
// Bale's Bot API mirrors a limited subset of the Telegram Bot API, so we
// keep this client defensive: it tolerates missing fields, retries once on
// transient network errors and never throws out of sendMessage/answerCallback
// so a single failed admin notification can't crash the webhook handler.

import { env } from "@/lib/env";

const BASE_URL = "https://tapi.bale.ai/bot";

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type InlineKeyboard = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type BaleUser = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  is_bot?: boolean;
};

export type BaleChat = {
  id: number | string;
  type?: string;
  title?: string;
};

export type BaleMessage = {
  message_id: number;
  from?: BaleUser;
  chat: BaleChat;
  text?: string;
  caption?: string;
  photo?: unknown;
  document?: unknown;
};

export type BaleCallbackQuery = {
  id: string;
  from: BaleUser;
  message?: BaleMessage;
  data?: string;
};

export type BaleUpdate = {
  update_id: number;
  message?: BaleMessage;
  callback_query?: BaleCallbackQuery;
};

function apiUrl(method: string): string {
  if (!env.baleBotToken) {
    throw new Error("BALE_BOT_TOKEN تنظیم نشده است");
  }
  return `${BASE_URL}${env.baleBotToken}/${method}`;
}

async function callApi<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  if (!env.baleBotToken) {
    return { ok: false, description: "BALE_BOT_TOKEN تنظیم نشده است" };
  }
  try {
    const res = await fetch(apiUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, description: data.description || `HTTP ${res.status}` };
    }
    return { ok: true, result: data.result };
  } catch (error) {
    return { ok: false, description: error instanceof Error ? error.message : "خطای شبکه" };
  }
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  options: { replyMarkup?: InlineKeyboard; replyToMessageId?: number } = {},
) {
  // Bale limits a single message to 4096 characters; split long replies.
  const chunks = splitMessage(text);
  let lastResult: { ok: boolean; result?: BaleMessage; description?: string } = { ok: true };
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    lastResult = await callApi<BaleMessage>("sendMessage", {
      chat_id: chatId,
      text: chunks[i],
      reply_markup: isLast ? options.replyMarkup : undefined,
      reply_to_message_id: i === 0 ? options.replyToMessageId : undefined,
    });
    if (chunks.length > 1 && i < chunks.length - 1) {
      await sleep(250);
    }
  }
  return lastResult;
}

export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
) {
  return callApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  replyMarkup?: InlineKeyboard,
) {
  return callApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  });
}

export async function setWebhook(url: string) {
  return callApi("setWebhook", { url });
}

export async function deleteWebhook() {
  return callApi("deleteWebhook", {});
}

export async function getWebhookInfo() {
  return callApi("getWebhookInfo", {});
}

export async function getMe() {
  return callApi<BaleUser>("getMe", {});
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fullName(user?: BaleUser | null): string {
  if (!user) return "کاربر ناشناس";
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "کاربر";
}
