import { NextResponse } from "next/server";
import { deleteWebhook } from "@/lib/bale";

export async function POST() {
  const result = await deleteWebhook();
  if (!result.ok) {
    return NextResponse.json({ error: result.description || "حذف وبهوک ناموفق بود" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
