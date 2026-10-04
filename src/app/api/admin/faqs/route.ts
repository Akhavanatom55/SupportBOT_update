import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { faqs } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.id));
  return NextResponse.json({ faqs: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  const isPublished = typeof body?.isPublished === "boolean" ? body.isPublished : true;
  const sortOrder = Number(body?.sortOrder) || 0;

  if (!question || !answer) {
    return NextResponse.json({ error: "سوال و جواب الزامی است" }, { status: 400 });
  }

  const inserted = await db.insert(faqs).values({ question, answer, isPublished, sortOrder }).returning();
  return NextResponse.json({ faq: inserted[0] });
}
