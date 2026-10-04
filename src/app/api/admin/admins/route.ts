import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botAdmins } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(botAdmins).orderBy(asc(botAdmins.id));
  return NextResponse.json({ admins: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const baleUserId = typeof body?.baleUserId === "string" ? body.baleUserId.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;

  if (!baleUserId) {
    return NextResponse.json({ error: "شناسه بله ادمین الزامی است" }, { status: 400 });
  }

  const inserted = await db
    .insert(botAdmins)
    .values({ baleUserId, name: name || `ادمین ${baleUserId}`, isSuperAdmin: false })
    .onConflictDoNothing()
    .returning();
  return NextResponse.json({ admin: inserted[0] ?? null });
}
