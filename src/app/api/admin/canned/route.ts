import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cannedResponses } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(cannedResponses).orderBy(asc(cannedResponses.id));
  return NextResponse.json({ canned: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const keywords = typeof body?.keywords === "string" ? body.keywords.trim() : null;
  const messageParts: string[] = Array.isArray(body?.messageParts)
    ? body.messageParts.filter((p: unknown) => typeof p === "string" && p.trim()).map((p: string) => p.trim())
    : [];
  const category = typeof body?.category === "string" ? body.category : "quick";
  const isAutoSuggest = Boolean(body?.isAutoSuggest);

  if (!title || messageParts.length === 0) {
    return NextResponse.json({ error: "عنوان و حداقل یک بخش پیام الزامی است" }, { status: 400 });
  }

  const inserted = await db
    .insert(cannedResponses)
    .values({ title, keywords, messageParts, category, isAutoSuggest })
    .returning();
  return NextResponse.json({ canned: inserted[0] });
}
