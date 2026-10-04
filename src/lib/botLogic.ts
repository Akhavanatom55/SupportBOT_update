import { db } from "@/db";
import { botAdmins, cannedResponses, faqs, ticketMessages, tickets, users } from "@/db/schema";
import { and, desc, eq, asc } from "drizzle-orm";
import {
  answerCallbackQuery,
  BaleCallbackQuery,
  BaleMessage,
  BaleUpdate,
  fullName,
  sendMessage,
} from "@/lib/bale";
import {
  adminTicketKeyboard,
  faqBackKeyboard,
  faqListKeyboard,
  mainMenuKeyboard,
  ratingKeyboard,
  ticketOpenKeyboard,
} from "@/lib/keyboards";
import { notifyAdminsAndGroup, notifyAdminsOfError, isKnownAdmin } from "@/lib/notify";
import { generateAiReply } from "@/lib/gemini";
import { getSetting, getBoolSetting } from "@/lib/settings";

const FAQ_PAGE_SIZE = 5;

export async function handleBaleUpdate(update: BaleUpdate): Promise<void> {
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function upsertUser(message: BaleMessage) {
  const from = message.from;
  if (!from) return null;
  const baleUserId = String(from.id);
  const chatId = String(message.chat.id);
  const existing = await db.select().from(users).where(eq(users.baleUserId, baleUserId)).limit(1);
  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        chatId,
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, existing[0].id));
    return { ...existing[0], chatId };
  }
  const inserted = await db
    .insert(users)
    .values({
      baleUserId,
      chatId,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
    })
    .returning();
  return inserted[0];
}

async function getOpenTicket(userId: number) {
  const rows = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.userId, userId), eq(tickets.status, "open")))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

async function handleMessage(message: BaleMessage) {
  const from = message.from;
  if (!from) return;
  const baleUserId = String(from.id);
  const chatType = message.chat.type ?? "private";
  const text = (message.text ?? message.caption ?? "").trim();

  // Admins interact with the bot only through their private chat; group
  // messages are informational for the team and are never treated as bot
  // commands or ticket replies, to avoid hijacking normal group chatter.
  if (chatType !== "group" && chatType !== "supergroup") {
    const adminRow = await getAdminRow(baleUserId);
    if (adminRow) {
      const handledAsAdmin = await handleAdminPrivateMessage(adminRow, text, message);
      if (handledAsAdmin) return;
    }
  }

  if (chatType === "group" || chatType === "supergroup") return;

  const user = await upsertUser(message);
  if (!user) return;

  if (text === "/start" || text === "شروع") {
    await sendWelcome(user.chatId);
    return;
  }

  if (!text) {
    await sendMessage(user.chatId, "فقط پیام متنی قابل پردازش است 🙏");
    return;
  }

  const openTicket = await getOpenTicket(user.id);
  if (!openTicket) {
    const noTicketMsg = await getSetting("no_open_ticket_message");
    await sendMessage(user.chatId, noTicketMsg, { replyMarkup: mainMenuKeyboard });
    return;
  }

  await saveMessage(openTicket.id, "user", fullName(from), text);
  await db
    .update(tickets)
    .set({ lastMessageAt: new Date() })
    .where(eq(tickets.id, openTicket.id));

  // Always forward the raw message to the support team so humans can jump
  // in at any time, regardless of whether an automated reply is also sent.
  await forwardTicketMessageToAdmins(openTicket.id, user, text);

  if (openTicket.aiPaused) return; // an admin took over manually

  const canned = await matchAutoCanned(text);
  if (canned) {
    for (const part of canned.messageParts) {
      await saveMessage(openTicket.id, "bot", "پاسخ آماده", part);
      await sendMessage(user.chatId, part);
    }
    return;
  }

  await respondWithAi(openTicket.id, user.chatId, text);
}

async function respondWithAi(ticketId: number, chatId: string, latestUserText: string) {
  const aiEnabled = await getBoolSetting("ai_enabled");
  if (!aiEnabled) {
    const fallback = await getSetting("ai_quota_fallback_message");
    await sendMessage(chatId, fallback);
    await saveMessage(ticketId, "bot", "پاسخ آماده", fallback);
    return;
  }

  const systemPrompt = await getSetting("ai_system_prompt");
  const model = await getSetting("gemini_model");
  const historyLimitRaw = await getSetting("chat_history_limit");
  const historyLimit = Number(historyLimitRaw) || 12;

  const rows = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(desc(ticketMessages.createdAt))
    .limit(historyLimit);
  const ordered = rows.reverse();
  const history = ordered.map((m) => ({
    role: m.sender === "user" ? ("user" as const) : ("model" as const),
    text: m.content,
  }));
  if (history.length === 0 || history[history.length - 1].text !== latestUserText) {
    history.push({ role: "user", text: latestUserText });
  }

  const result = await generateAiReply(systemPrompt, history, model);

  if (result.ok) {
    await sendMessage(chatId, result.text);
    await saveMessage(ticketId, "bot", "پاسخ هوشمند", result.text);
    return;
  }

  // Quota/error: the end-user NEVER sees the raw error, only a friendly
  // canned fallback. Admins get the real diagnostic separately.
  const fallback = await getSetting("ai_quota_fallback_message");
  await sendMessage(chatId, fallback);
  await saveMessage(ticketId, "bot", "پاسخ آماده (fallback)", fallback);
  if (result.errorsForAdmins && result.errorsForAdmins.length > 0) {
    await notifyAdminsOfError(result.errorsForAdmins);
  }
}

async function matchAutoCanned(text: string) {
  const lower = text.toLowerCase();
  const candidates = await db
    .select()
    .from(cannedResponses)
    .where(and(eq(cannedResponses.isActive, true), eq(cannedResponses.isAutoSuggest, true)));
  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (!c.keywords) continue;
    const words = c.keywords.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    const score = words.filter((w) => lower.includes(w)).length;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

async function saveMessage(ticketId: number, sender: "user" | "admin" | "bot" | "system", label: string, content: string) {
  await db.insert(ticketMessages).values({ ticketId, sender, senderLabel: label, content });
}

async function forwardTicketMessageToAdmins(
  ticketId: number,
  user: { baleUserId: string; firstName: string | null; lastName: string | null; username: string | null },
  text: string,
) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "کاربر";
  const usernamePart = user.username ? `@${user.username}` : "بدون‌یوزرنیم";
  const ticketRow = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  const ticket = ticketRow[0];
  const header = `🎫 تیکت #${ticketId} | ${name} (${usernamePart}) | شناسه: ${user.baleUserId}`;
  const assigned = ticket?.assignedAdminName ? `\n👤 در حال بررسی توسط: ${ticket.assignedAdminName}` : "";
  const body = `${header}${assigned}\n\n💬 ${text}`;
  await notifyAdminsAndGroup(
    body,
    adminTicketKeyboard(ticketId, Boolean(ticket?.assignedAdminBaleId), Boolean(ticket?.aiPaused)),
  );
}

async function sendWelcome(chatId: string) {
  const welcome = await getSetting("welcome_message");
  await sendMessage(chatId, welcome, { replyMarkup: mainMenuKeyboard });
}

// ---------------------------------------------------------------------------
// Admin private-chat handling (claim/reply flow)
// ---------------------------------------------------------------------------

async function getAdminRow(baleUserId: string) {
  const rows = await db.select().from(botAdmins).where(eq(botAdmins.baleUserId, baleUserId)).limit(1);
  if (rows.length > 0) return rows[0];
  const isAdmin = await isKnownAdmin(baleUserId);
  if (!isAdmin) return null;
  const inserted = await db
    .insert(botAdmins)
    .values({ baleUserId, name: `ادمین ${baleUserId}`, isSuperAdmin: true })
    .returning();
  return inserted[0];
}

async function handleAdminPrivateMessage(
  adminRow: typeof botAdmins.$inferSelect,
  text: string,
  message: BaleMessage,
): Promise<boolean> {
  if (text === "/start") {
    await sendMessage(
      String(message.chat.id),
      "سلام 👋 شما به‌عنوان ادمین پشتیبانی شناسایی شدید.\nپیام‌های تیکت‌ها برای شما ارسال می‌شود. برای پاسخ به یک تیکت، روی دکمه «پاسخ به این تیکت» در پیام فوروارد شده بزنید و سپس پیام خودتان را بفرستید.\nپنل مدیریت کامل: /admin",
    );
    return true;
  }

  if (!adminRow.pendingReplyTicketId || !text) return false;

  const ticketId = adminRow.pendingReplyTicketId;
  const ticketRows = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  const ticket = ticketRows[0];
  if (!ticket) {
    await clearPendingReply(adminRow.baleUserId);
    await sendMessage(String(message.chat.id), "این تیکت دیگر در دسترس نیست.");
    return true;
  }

  const userRow = await db.select().from(users).where(eq(users.id, ticket.userId)).limit(1);
  const targetUser = userRow[0];
  await clearPendingReply(adminRow.baleUserId);

  if (!targetUser || ticket.status === "closed") {
    await sendMessage(String(message.chat.id), "این تیکت بسته شده و دیگر نمی‌توان پاسخ فرستاد.");
    return true;
  }

  await sendMessage(targetUser.chatId, `👨‍💻 پاسخ پشتیبانی:\n${text}`);
  await saveMessage(ticketId, "admin", adminRow.name || adminRow.baleUserId, text);
  await db
    .update(tickets)
    .set({
      lastMessageAt: new Date(),
      assignedAdminBaleId: adminRow.baleUserId,
      assignedAdminName: adminRow.name || adminRow.baleUserId,
    })
    .where(eq(tickets.id, ticketId));
  await sendMessage(String(message.chat.id), "✅ پاسخ شما برای کاربر ارسال شد.");
  return true;
}

async function clearPendingReply(baleUserId: string) {
  await db.update(botAdmins).set({ pendingReplyTicketId: null }).where(eq(botAdmins.baleUserId, baleUserId));
}

// ---------------------------------------------------------------------------
// Callback queries
// ---------------------------------------------------------------------------

async function handleCallbackQuery(cq: BaleCallbackQuery) {
  const data = cq.data ?? "";
  const chatId = String(cq.message?.chat.id ?? cq.from.id);
  const baleUserId = String(cq.from.id);

  try {
    if (data === "new_ticket") {
      await onNewTicket(chatId, cq);
      return;
    }
    if (data === "close_ticket") {
      await onCloseTicket(chatId, cq);
      return;
    }
    if (data === "main_menu") {
      await answerCallbackQuery(cq.id);
      await sendWelcome(chatId);
      return;
    }
    if (data === "about") {
      await answerCallbackQuery(cq.id);
      const org = await getSetting("organization_name");
      const bot = await getSetting("bot_name");
      await sendMessage(
        chatId,
        `${bot}\nارائه‌شده توسط ${org}\nما اینجاییم تا سریع‌تر و بهتر مشکلت رو حل کنیم 💙`,
        { replyMarkup: mainMenuKeyboard },
      );
      return;
    }
    if (data.startsWith("faq_list:")) {
      const page = Number(data.split(":")[1]) || 0;
      await onFaqList(chatId, cq, page);
      return;
    }
    if (data.startsWith("faq_item:")) {
      const [, idStr, pageStr] = data.split(":");
      await onFaqItem(chatId, cq, Number(idStr), Number(pageStr) || 0);
      return;
    }
    if (data.startsWith("rate:")) {
      const [, ticketIdStr, scoreStr] = data.split(":");
      await onRate(chatId, cq, Number(ticketIdStr), Number(scoreStr));
      return;
    }

    // Admin-only actions below.
    const adminRow = await getAdminRow(baleUserId);
    if (!adminRow) {
      await answerCallbackQuery(cq.id, "این بخش فقط برای ادمین‌هاست.", true);
      return;
    }

    if (data.startsWith("reply:")) {
      const ticketId = Number(data.split(":")[1]);
      await db.update(botAdmins).set({ pendingReplyTicketId: ticketId }).where(eq(botAdmins.id, adminRow.id));
      await answerCallbackQuery(cq.id, "پیام بعدی که در چت خصوصی ربات بفرستید، برای کاربر ارسال می‌شود.", true);
      return;
    }
    if (data.startsWith("claim:")) {
      const ticketId = Number(data.split(":")[1]);
      await db
        .update(tickets)
        .set({ assignedAdminBaleId: adminRow.baleUserId, assignedAdminName: adminRow.name || adminRow.baleUserId })
        .where(eq(tickets.id, ticketId));
      await answerCallbackQuery(cq.id, "تیکت به شما اختصاص داده شد ✅");
      return;
    }
    if (data.startsWith("unclaim:")) {
      const ticketId = Number(data.split(":")[1]);
      await db.update(tickets).set({ assignedAdminBaleId: null, assignedAdminName: null }).where(eq(tickets.id, ticketId));
      await answerCallbackQuery(cq.id, "تیکت آزاد شد.");
      return;
    }
    if (data.startsWith("pause_ai:")) {
      const ticketId = Number(data.split(":")[1]);
      await db.update(tickets).set({ aiPaused: true }).where(eq(tickets.id, ticketId));
      await answerCallbackQuery(cq.id, "پاسخ خودکار برای این تیکت متوقف شد.");
      return;
    }
    if (data.startsWith("resume_ai:")) {
      const ticketId = Number(data.split(":")[1]);
      await db.update(tickets).set({ aiPaused: false }).where(eq(tickets.id, ticketId));
      await answerCallbackQuery(cq.id, "پاسخ خودکار دوباره فعال شد.");
      return;
    }
    if (data.startsWith("admin_close:")) {
      const ticketId = Number(data.split(":")[1]);
      await adminCloseTicket(ticketId);
      await answerCallbackQuery(cq.id, "تیکت بسته شد.");
      return;
    }

    await answerCallbackQuery(cq.id);
  } catch (error) {
    await answerCallbackQuery(cq.id, "خطایی رخ داد، دوباره تلاش کنید.", true).catch(() => undefined);
    throw error;
  }
}

async function onNewTicket(chatId: string, cq: BaleCallbackQuery) {
  const from = cq.from;
  const baleUserId = String(from.id);
  let userRow = await db.select().from(users).where(eq(users.baleUserId, baleUserId)).limit(1);
  if (userRow.length === 0) {
    const inserted = await db
      .insert(users)
      .values({
        baleUserId,
        chatId,
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      })
      .returning();
    userRow = inserted;
  }
  const user = userRow[0];
  const existingOpen = await getOpenTicket(user.id);
  if (existingOpen) {
    await answerCallbackQuery(cq.id);
    await sendMessage(chatId, "شما همین الان یک درخواست باز دارید، پیامت رو همینجا بفرست 🙏", {
      replyMarkup: ticketOpenKeyboard,
    });
    return;
  }

  const inserted = await db.insert(tickets).values({ userId: user.id }).returning();
  const ticket = inserted[0];
  await answerCallbackQuery(cq.id, "درخواست جدید باز شد ✅");
  const openedMsg = await getSetting("ticket_opened_message");
  await sendMessage(chatId, openedMsg, { replyMarkup: ticketOpenKeyboard });

  const name = fullName(from);
  const usernamePart = from.username ? `@${from.username}` : "بدون‌یوزرنیم";
  await notifyAdminsAndGroup(
    `🆕 تیکت جدید #${ticket.id} باز شد.\n👤 ${name} (${usernamePart})\nشناسه: ${baleUserId}`,
    adminTicketKeyboard(ticket.id, false, false),
  );
}

async function onCloseTicket(chatId: string, cq: BaleCallbackQuery) {
  const baleUserId = String(cq.from.id);
  const userRow = await db.select().from(users).where(eq(users.baleUserId, baleUserId)).limit(1);
  if (userRow.length === 0) {
    await answerCallbackQuery(cq.id);
    return;
  }
  const openTicket = await getOpenTicket(userRow[0].id);
  if (!openTicket) {
    await answerCallbackQuery(cq.id, "درخواست باز فعالی ندارید.");
    return;
  }
  await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, openTicket.id));
  await answerCallbackQuery(cq.id, "درخواست بسته شد.");
  const closedMsg = await getSetting("ticket_closed_message");
  const askRating = await getBoolSetting("ask_rating_on_close");
  await sendMessage(chatId, closedMsg, {
    replyMarkup: askRating ? ratingKeyboard(openTicket.id) : mainMenuKeyboard,
  });
  await notifyAdminsAndGroup(`✅ تیکت #${openTicket.id} توسط کاربر بسته شد.`);
}

async function adminCloseTicket(ticketId: number) {
  const rows = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  const ticket = rows[0];
  if (!ticket || ticket.status === "closed") return;
  await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, ticketId));
  const userRow = await db.select().from(users).where(eq(users.id, ticket.userId)).limit(1);
  if (userRow[0]) {
    const closedMsg = await getSetting("ticket_closed_message");
    const askRating = await getBoolSetting("ask_rating_on_close");
    await sendMessage(userRow[0].chatId, closedMsg, {
      replyMarkup: askRating ? ratingKeyboard(ticketId) : mainMenuKeyboard,
    });
  }
}

async function onFaqList(chatId: string, cq: BaleCallbackQuery, page: number) {
  const items = await db
    .select()
    .from(faqs)
    .where(eq(faqs.isPublished, true))
    .orderBy(asc(faqs.sortOrder), asc(faqs.id));
  const start = page * FAQ_PAGE_SIZE;
  const pageItems = items.slice(start, start + FAQ_PAGE_SIZE);
  await answerCallbackQuery(cq.id);
  if (pageItems.length === 0) {
    await sendMessage(chatId, "فعلاً سوال متداولی ثبت نشده است.", { replyMarkup: mainMenuKeyboard });
    return;
  }
  const hasNext = start + FAQ_PAGE_SIZE < items.length;
  await sendMessage(chatId, "❓ یکی از سوالات زیر رو انتخاب کن:", {
    replyMarkup: faqListKeyboard(pageItems, page, hasNext),
  });
}

async function onFaqItem(chatId: string, cq: BaleCallbackQuery, id: number, page: number) {
  const rows = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
  await answerCallbackQuery(cq.id);
  const faq = rows[0];
  if (!faq) {
    await sendMessage(chatId, "این سوال یافت نشد.", { replyMarkup: mainMenuKeyboard });
    return;
  }
  await db.update(faqs).set({ hitCount: faq.hitCount + 1 }).where(eq(faqs.id, id));
  await sendMessage(chatId, `❓ ${faq.question}\n\n💡 ${faq.answer}`, { replyMarkup: faqBackKeyboard(page) });
}

async function onRate(chatId: string, cq: BaleCallbackQuery, ticketId: number, score: number) {
  await db.update(tickets).set({ rating: score }).where(eq(tickets.id, ticketId));
  await answerCallbackQuery(cq.id, "ممنون از نظرت 🙏");
  await sendMessage(chatId, "بازخوردت ثبت شد، ممنون که وقت گذاشتی 🙏", { replyMarkup: mainMenuKeyboard });
}


