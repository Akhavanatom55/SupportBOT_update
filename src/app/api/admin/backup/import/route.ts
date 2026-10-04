import { NextRequest, NextResponse } from "next/server";
import { importBackup, type BackupData } from "@/lib/backup";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let data: BackupData | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "فایل بکاپ ارسال نشده است" }, { status: 400 });
      }
      const text = await file.text();
      data = JSON.parse(text);
    } else {
      data = await request.json();
    }

    if (!data) {
      return NextResponse.json({ error: "فایل بکاپ نامعتبر است" }, { status: 400 });
    }

    const result = await importBackup(data);
    return NextResponse.json({ ok: true, restored: result.restored });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "بازیابی بکاپ ناموفق بود" },
      { status: 500 },
    );
  }
}
