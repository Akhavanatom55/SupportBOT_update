import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { sendMessage } from "@/lib/bale";
import { getSetting } from "@/lib/settings";
import { mainMenuKeyboard } from "@/lib/keyboards";
import { notifyAdminsAndGroup } from "@/lib/notify";

/**
 * Auto-closes tickets that have had no activity for longer than the
 * configured `auto_close_hours` setting, politely informing the user so
 * threads don't stay open forever and clutter the admin dashboard.
 */
export async function autoCloseIdleTickets(): Promise<number> {
  const hoursRaw = await getSetting("auto_close_hours");
  const hours = Number(hoursRaw) || 48;
  if (hours <= 0) return 0;

  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  const idleTickets = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.status, "open"), lt(tickets.lastMessageAt, threshold)));

  for (const ticket of idleTickets) {
    await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, ticket.id));
    const userRows = await db.select().from(users).where(eq(users.id, ticket.userId)).limit(1);
    if (userRows[0]) {
      await sendMessage(
        userRows[0].chatId,
        "⏳ به‌دلیل عدم فعالیت، این درخواست به‌صورت خودکار بسته شد. اگه هنوز مشکل داری، «ثبت درخواست جدید» رو بزن.",
        { replyMarkup: mainMenuKeyboard },
      );
    }
  }

  if (idleTickets.length > 0) {
    await notifyAdminsAndGroup(`🧹 ${idleTickets.length} تیکت به‌دلیل عدم فعالیت طولانی به‌صورت خودکار بسته شدند.`);
  }

  return idleTickets.length;
}

export async function runMaintenanceTasks(): Promise<void> {
  await autoCloseIdleTickets();
}
