import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await db.delete(botAdmins).where(eq(botAdmins.id, Number(id)));
  return NextResponse.json({ ok: true });
}
