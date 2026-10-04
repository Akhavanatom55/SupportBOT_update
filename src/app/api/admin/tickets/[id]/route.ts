import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ticketMessages, tickets, users } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ticketId = Number(id);

  const ticketRows = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      subject: tickets.subject,
      assignedAdminName: tickets.assignedAdminName,
      aiPaused: tickets.aiPaused,
      rating: tickets.rating,
      createdAt: tickets.createdAt,
      lastMessageAt: tickets.lastMessageAt,
      closedAt: tickets.closedAt,
      userId: users.id,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userUsername: users.username,
      userBaleId: users.baleUserId,
      userChatId: users.chatId,
    })
    .from(tickets)
    .innerJoin(users, eq(tickets.userId, users.id))
    .where(eq(tickets.id, ticketId))
    .limit(1);

  const ticket = ticketRows[0];
  if (!ticket) return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });

  const messages = await db
    .select()
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.createdAt));

  return NextResponse.json({ ticket, messages });
}
