import { NextResponse } from "next/server";
import { getWebhookInfo, getMe } from "@/lib/bale";
import { env } from "@/lib/env";

export async function GET() {
  if (!env.baleBotToken) {
    return NextResponse.json({ error: "BALE_BOT_TOKEN تنظیم نشده است" }, { status: 400 });
  }
  const [info, me] = await Promise.all([getWebhookInfo(), getMe()]);
  return NextResponse.json({ info: info.result ?? null, infoError: info.description, bot: me.result ?? null });
}
