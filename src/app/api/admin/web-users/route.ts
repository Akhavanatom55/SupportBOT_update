import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminWebUsers } from "@/db/schema";
import { asc } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const rows = await db
    .select({ id: adminWebUsers.id, username: adminWebUsers.username, createdAt: adminWebUsers.createdAt })
    .from(adminWebUsers)
    .orderBy(asc(adminWebUsers.id));
  return NextResponse.json({ users: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || password.length < 8) {
    return NextResponse.json({ error: "نام کاربری و رمز عبور حداقل ۸ کاراکتر الزامی است" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(adminWebUsers)
    .values({ username, passwordHash })
    .onConflictDoNothing()
    .returning({ id: adminWebUsers.id, username: adminWebUsers.username });

  if (inserted.length === 0) {
    return NextResponse.json({ error: "این نام کاربری قبلاً استفاده شده است" }, { status: 409 });
  }
  return NextResponse.json({ user: inserted[0] });
}
