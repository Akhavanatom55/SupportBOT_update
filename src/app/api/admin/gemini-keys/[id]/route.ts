import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { geminiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const idNum = Number(id);
  const body = await request.json().catch(() => null);
  const updates: Partial<typeof geminiKeys.$inferInsert> = {};

  if (typeof body?.label === "string") updates.label = body.label.trim();
  if (typeof body?.apiKey === "string" && body.apiKey.trim()) updates.apiKey = body.apiKey.trim();
  if (typeof body?.priority === "number") updates.priority = body.priority;
  if (typeof body?.isActive === "boolean") updates.isActive = body.isActive;
  if (typeof body?.isExhausted === "boolean") updates.isExhausted = body.isExhausted;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "داده‌ای برای بروزرسانی ارسال نشد" }, { status: 400 });
  }

  const updated = await db.update(geminiKeys).set(updates).where(eq(geminiKeys.id, idNum)).returning();
  if (updated.length === 0) {
    return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  }
  return NextResponse.json({ key: updated[0] });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await db.delete(geminiKeys).where(eq(geminiKeys.id, Number(id)));
  return NextResponse.json({ ok: true });
}
