import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cannedResponses } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const updates: Partial<typeof cannedResponses.$inferInsert> = {};
  if (typeof body?.title === "string") updates.title = body.title.trim();
  if (typeof body?.keywords === "string" || body?.keywords === null) updates.keywords = body.keywords;
  if (Array.isArray(body?.messageParts)) {
    updates.messageParts = body.messageParts.filter((p: unknown) => typeof p === "string" && p.trim());
  }
  if (typeof body?.category === "string") updates.category = body.category;
  if (typeof body?.isAutoSuggest === "boolean") updates.isAutoSuggest = body.isAutoSuggest;
  if (typeof body?.isActive === "boolean") updates.isActive = body.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "داده‌ای برای بروزرسانی ارسال نشد" }, { status: 400 });
  }
  const updated = await db
    .update(cannedResponses)
    .set(updates)
    .where(eq(cannedResponses.id, Number(id)))
    .returning();
  if (updated.length === 0) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json({ canned: updated[0] });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await db.delete(cannedResponses).where(eq(cannedResponses.id, Number(id)));
  return NextResponse.json({ ok: true });
}
