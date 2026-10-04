import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { broadcasts, users } from "@/db/schema";
import { sendMessage, sleep } from "@/lib/bale";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(broadcasts).orderBy(desc(broadcasts.id)).limit(20);
  return NextResponse.json({ broadcasts: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "متن پیام الزامی است" }, { status: 400 });
  }

  const allUsers = await db.select().from(users);
  let sentCount = 0;
  let failedCount = 0;

  for (const user of allUsers) {
    const result = await sendMessage(user.chatId, content);
    if (result.ok) sentCount += 1;
    else failedCount += 1;
    await sleep(120);
  }

  const inserted = await db.insert(broadcasts).values({ content, sentCount, failedCount }).returning();
  return NextResponse.json({ broadcast: inserted[0] });
}
