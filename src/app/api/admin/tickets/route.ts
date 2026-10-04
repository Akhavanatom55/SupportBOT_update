import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const rows = await db
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
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userUsername: users.username,
      userBaleId: users.baleUserId,
    })
    .from(tickets)
    .innerJoin(users, eq(tickets.userId, users.id))
    .where(status === "open" || status === "closed" ? eq(tickets.status, status) : undefined)
    .orderBy(desc(tickets.lastMessageAt))
    .limit(200);

  return NextResponse.json({ tickets: rows });
}
