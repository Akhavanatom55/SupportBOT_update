import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendMessage } from "@/lib/bale";
import { getSetting } from "@/lib/settings";
import { mainMenuKeyboard } from "@/lib/keyboards";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ticketId = Number(id);

  const ticketRows = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  const ticket = ticketRows[0];
  if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

  await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, ticketId));

  const userRows = await db.select().from(users).where(eq(users.id, ticket.userId)).limit(1);
  if (userRows[0]) {
    const closedMsg = await getSetting("ticket_closed_message");
    await sendMessage(userRows[0].chatId, closedMsg, { replyMarkup: mainMenuKeyboard });
  }

  return NextResponse.json({ ok: true });
}
