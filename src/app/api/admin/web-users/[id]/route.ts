import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminWebUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });

  const { id } = await context.params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "شناسه حساب نامعتبر است" }, { status: 400 });
  }
  if (targetId === Number(session.sub)) {
    return NextResponse.json({ error: "نمی‌توانید حسابی را که اکنون با آن وارد شده‌اید حذف کنید" }, { status: 400 });
  }

  const count = await db.select({ id: adminWebUsers.id }).from(adminWebUsers);
  if (count.length <= 1) {
    return NextResponse.json({ error: "حداقل یک حساب مدیریتی باید باقی بماند" }, { status: 400 });
  }

  await db.delete(adminWebUsers).where(eq(adminWebUsers.id, targetId));
  return NextResponse.json({ ok: true });
}
