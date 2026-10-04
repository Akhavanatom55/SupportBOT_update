import { db } from "@/db";
import { botAdmins } from "@/db/schema";
import { env } from "@/lib/env";
import { sendMessage, sleep, InlineKeyboard } from "@/lib/bale";
import { getBoolSetting, getSetting } from "@/lib/settings";

async function getAdminChatIds(): Promise<string[]> {
  const rows = await db.select().from(botAdmins);
  const ids = new Set<string>(rows.map((r) => r.baleUserId));
  for (const id of env.adminIds.split(",").map((v) => v.trim()).filter(Boolean)) {
    ids.add(id);
  }
  return Array.from(ids);
}

/** Sends a text message to every configured admin's private chat, with a small
 * delay between sends to respect Bale's per-chat/global rate limits. */
export async function notifyAdmins(text: string, replyMarkup?: InlineKeyboard) {
  const ids = await getAdminChatIds();
  for (const chatId of ids) {
    await sendMessage(chatId, text, { replyMarkup });
    await sleep(200);
  }
}

/** Sends to admins and, if a group chat is configured, to the group too. Used
 * for forwarding ticket messages so the whole support team sees them. */
export async function notifyAdminsAndGroup(text: string, replyMarkup?: InlineKeyboard) {
  await notifyAdmins(text, replyMarkup);
  const groupChatId = await getSetting("group_chat_id");
  if (groupChatId) {
    await sendMessage(groupChatId, text, { replyMarkup });
  }
}

/** Internal/operational errors (e.g. Gemini quota exhaustion) must NEVER reach
 * end-users. They are only ever sent here, to admins (and optionally the
 * group), as plain operational alerts. */
export async function notifyAdminsOfError(lines: string[]) {
  if (lines.length === 0) return;
  const text = `🛠 هشدار سیستمی (فقط ادمین‌ها می‌بینند):\n\n${lines.join("\n")}`;
  const sendToGroupToo = await getBoolSetting("send_errors_to_group");
  if (sendToGroupToo) {
    await notifyAdminsAndGroup(text);
  } else {
    await notifyAdmins(text);
  }
}

export async function isKnownAdmin(baleUserId: string): Promise<boolean> {
  if (env.adminIds.split(",").map((v) => v.trim()).includes(baleUserId)) return true;
  const rows = await db.select().from(botAdmins);
  return rows.some((r) => r.baleUserId === baleUserId);
}
