import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminWebUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSessionToken, verifyPassword, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export async function POST(request: NextRequest) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "نام کاربری و رمز عبور الزامی است" }, { status: 400 });
  }

  const rows = await db.select().from(adminWebUsers).where(eq(adminWebUsers.username, username)).limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  }

  const token = await createSessionToken({ sub: String(user.id), username: user.username });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
