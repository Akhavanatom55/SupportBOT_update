import { NextRequest, NextResponse } from "next/server";
import { ensureSeedData } from "@/lib/seed";
import { getSetting } from "@/lib/settings";
import { handleBaleUpdate } from "@/lib/botLogic";
import type { BaleUpdate } from "@/lib/bale";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ secret: string }> }) {
  try {
    await ensureSeedData();
    const { secret } = await context.params;
    const expected = await getSetting("webhook_secret");
    if (!expected || secret !== expected) {
      return NextResponse.json({ ok: false, error: "invalid secret" }, { status: 401 });
    }

    const update = (await request.json().catch(() => null)) as BaleUpdate | null;
    if (!update) {
      return NextResponse.json({ ok: true });
    }

    // Always answer the webhook fast with 200 so Bale doesn't retry; any
    // internal failure is logged but never bubbled back as an HTTP error.
    try {
      await handleBaleUpdate(update);
    } catch (error) {
      console.error("bale webhook handling error", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("bale webhook fatal error", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Bale webhook endpoint is alive." });
}
