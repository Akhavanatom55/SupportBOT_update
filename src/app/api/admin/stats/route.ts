import { NextResponse } from "next/server";
import { db } from "@/db";
import { faqs, geminiKeys, tickets, users } from "@/db/schema";
import { eq, gte, sql } from "drizzle-orm";

export async function GET() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [openTickets] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(eq(tickets.status, "open"));
  const [closedTickets] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(eq(tickets.status, "closed"));
  const [ticketsLast24h] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(gte(tickets.createdAt, since24h));
  const [faqCount] = await db.select({ count: sql<number>`count(*)` }).from(faqs);
  const [avgRating] = await db
    .select({ avg: sql<number>`coalesce(avg(rating), 0)` })
    .from(tickets)
    .where(sql`${tickets.rating} is not null`);

  const keys = await db.select().from(geminiKeys);
  const activeKeys = keys.filter((k) => k.isActive && !k.isExhausted).length;
  const exhaustedKeys = keys.filter((k) => k.isExhausted).length;

  return NextResponse.json({
    stats: {
      totalUsers: userCount?.count ?? 0,
      openTickets: openTickets?.count ?? 0,
      closedTickets: closedTickets?.count ?? 0,
      ticketsLast24h: ticketsLast24h?.count ?? 0,
      faqCount: faqCount?.count ?? 0,
      avgRating: avgRating?.avg ?? 0,
      totalGeminiKeys: keys.length,
      activeGeminiKeys: activeKeys,
      exhaustedGeminiKeys: exhaustedKeys,
    },
  });
}
