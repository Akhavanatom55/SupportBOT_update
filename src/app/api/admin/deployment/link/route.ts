import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSetting, setSetting } from "@/lib/settings";
import { notifyAdmins } from "@/lib/notify";
import type { InlineKeyboard } from "@/lib/bale";

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

async function getDeploymentLinks(request: NextRequest) {
  const storedBaseUrl = await getSetting("public_base_url");
  const baseUrl = cleanBaseUrl(storedBaseUrl || env.publicBaseUrl || request.nextUrl.origin);
  const webhookSecret = (await getSetting("webhook_secret")) || env.webhookSecret;
  return {
    baseUrl,
    panelUrl: `${baseUrl}/admin`,
    webhookUrl: webhookSecret ? `${baseUrl}/api/bale/webhook/${webhookSecret}` : "",
  };
}

export async function GET(request: NextRequest) {
  return NextResponse.json(await getDeploymentLinks(request));
}

export async function POST(request: NextRequest) {
  const links = await getDeploymentLinks(request);
  if (!env.publicBaseUrl && links.baseUrl && links.baseUrl !== "http://localhost:3000") {
    await setSetting("public_base_url", links.baseUrl);
  }

  const keyboard: InlineKeyboard = {
    inline_keyboard: [[{ text: "🔐 ورود به پنل مدیریت", url: links.panelUrl }]],
  };
  const botName = await getSetting("bot_name");
  await notifyAdmins(
    `🔗 لینک پنل مدیریت ${botName}\n\nبرای ورود به پنل روی دکمه زیر بزنید:\n${links.panelUrl}\n\nوبهوک بله:\n${links.webhookUrl || "تنظیم نشده"}`,
    keyboard,
  );

  return NextResponse.json({ ok: true, ...links });
}
