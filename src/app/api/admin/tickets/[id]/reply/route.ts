import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketMessages, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendMessage } from "@/lib/bale";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ticketId = Number(id);
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const adminName = typeof body?.adminName === "string" ? body.adminName.trim() : "ادمین پنل وب";

  if (!content) return NextResponse.json({ error: "متن پاسخ الزامی است" }, { status: 400 });

  const ticketRows = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  const ticket = ticketRows[0];
  if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });
  if (ticket.status === "closed") {
    return NextResponse.json({ error: "این تیکت بسته شده است" }, { status: 400 });
  }

  const userRows = await db.select().from(users).where(eq(users.id, ticket.userId)).limit(1);
  const user = userRows[0];
  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const result = await sendMessage(user.chatId, `👨‍💻 پاسخ پشتیبانی:\n${content}`);
  if (!result.ok) {
    return NextResponse.json({ error: result.description || "ارسال پیام ناموفق بود" }, { status: 502 });
  }

  await db.insert(ticketMessages).values({
    ticketId,
    sender: "admin",
    senderLabel: adminName,
    content,
  });
  await db
    .update(tickets)
    .set({ lastMessageAt: new Date(), assignedAdminName: adminName })
    .where(eq(tickets.id, ticketId));

  return NextResponse.json({ ok: true });
}
