import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { geminiKeys } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(geminiKeys).orderBy(asc(geminiKeys.priority), asc(geminiKeys.id));
  const safe = rows.map((r) => ({ ...r, apiKey: maskKey(r.apiKey) }));
  return NextResponse.json({ keys: safe });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const priority = Number(body?.priority) || 0;

  if (!label || !apiKey) {
    return NextResponse.json({ error: "عنوان و مقدار API Key الزامی است" }, { status: 400 });
  }

  const inserted = await db.insert(geminiKeys).values({ label, apiKey, priority }).returning();
  const row = inserted[0];
  return NextResponse.json({ key: { ...row, apiKey: maskKey(row.apiKey) } });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
