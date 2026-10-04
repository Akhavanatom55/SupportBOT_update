import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminWebUsers } from "@/db/schema";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "جلسه ورود منقضی شده است" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const requestedUsername = typeof body?.username === "string" ? body.username.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return NextResponse.json({ error: "رمز عبور فعلی را وارد کنید" }, { status: 400 });
  }
  if (!requestedUsername && !newPassword) {
    return NextResponse.json({ error: "نام کاربری جدید یا رمز عبور جدید را وارد کنید" }, { status: 400 });
  }
  if (requestedUsername && (requestedUsername.length < 3 || requestedUsername.length > 64)) {
    return NextResponse.json({ error: "نام کاربری باید بین ۳ تا ۶۴ کاراکتر باشد" }, { status: 400 });
  }
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد" }, { status: 400 });
  }

  const rows = await db.select().from(adminWebUsers).where(eq(adminWebUsers.id, Number(session.sub))).limit(1);
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "حساب مدیریت پیدا نشد" }, { status: 404 });

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "رمز عبور فعلی صحیح نیست" }, { status: 403 });

  const username = requestedUsername || user.username;
  if (username !== user.username) {
    const sameUsername = await db
      .select({ id: adminWebUsers.id })
      .from(adminWebUsers)
      .where(eq(adminWebUsers.username, username))
      .limit(1);
    if (sameUsername.length > 0 && sameUsername[0].id !== user.id) {
      return NextResponse.json({ error: "این نام کاربری قبلاً استفاده شده است" }, { status: 409 });
    }
  }

  const passwordHash = newPassword ? await hashPassword(newPassword) : user.passwordHash;
  await db
    .update(adminWebUsers)
    .set({ username, passwordHash })
    .where(eq(adminWebUsers.id, user.id));

  const newToken = await createSessionToken({ sub: String(user.id), username });
  const response = NextResponse.json({ ok: true, username });
  response.cookies.set(SESSION_COOKIE_NAME, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
