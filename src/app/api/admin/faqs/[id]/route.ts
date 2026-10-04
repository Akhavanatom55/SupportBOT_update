import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { faqs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const updates: Partial<typeof faqs.$inferInsert> = {};
  if (typeof body?.question === "string") updates.question = body.question.trim();
  if (typeof body?.answer === "string") updates.answer = body.answer.trim();
  if (typeof body?.isPublished === "boolean") updates.isPublished = body.isPublished;
  if (typeof body?.sortOrder === "number") updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "داده‌ای برای بروزرسانی ارسال نشد" }, { status: 400 });
  }
  const updated = await db.update(faqs).set(updates).where(eq(faqs.id, Number(id))).returning();
  if (updated.length === 0) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json({ faq: updated[0] });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await db.delete(faqs).where(eq(faqs.id, Number(id)));
  return NextResponse.json({ ok: true });
}
