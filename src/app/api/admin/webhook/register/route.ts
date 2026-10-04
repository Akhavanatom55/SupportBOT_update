import { NextRequest, NextResponse } from "next/server";
import { setWebhook } from "@/lib/bale";
import { getSetting, setSetting } from "@/lib/settings";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  let baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim().replace(/\/$/, "") : "";

  if (!baseUrl) {
    baseUrl = (await getSetting("public_base_url")) || env.publicBaseUrl;
  }
  if (!baseUrl) {
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    baseUrl = origin.replace(/\/$/, "");
  }
  if (!baseUrl) {
    return NextResponse.json({ error: "آدرس عمومی سایت مشخص نیست" }, { status: 400 });
  }
  if (!env.baleBotToken) {
    return NextResponse.json({ error: "BALE_BOT_TOKEN تنظیم نشده است" }, { status: 400 });
  }

  await setSetting("public_base_url", baseUrl);
  const secret = await getSetting("webhook_secret");
  const webhookUrl = `${baseUrl}/api/bale/webhook/${secret}`;

  const result = await setWebhook(webhookUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.description || "ثبت وبهوک ناموفق بود" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, webhookUrl });
}
