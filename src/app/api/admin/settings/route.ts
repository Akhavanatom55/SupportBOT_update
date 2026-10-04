import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSetting } from "@/lib/settings";

export async function GET() {
  const all = await getSettings();
  return NextResponse.json({ settings: all });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه نامعتبر است" }, { status: 400 });
  }
  const entries = Object.entries(body as Record<string, unknown>).filter(
    ([, v]) => typeof v === "string",
  ) as [string, string][];

  for (const [key, value] of entries) {
    await setSetting(key, value);
  }
  const all = await getSettings();
  return NextResponse.json({ settings: all });
}
