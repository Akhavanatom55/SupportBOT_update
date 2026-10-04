import { NextResponse } from "next/server";
import { exportBackup } from "@/lib/backup";

export async function GET() {
  const data = await exportBackup();
  const json = JSON.stringify(data, null, 2);
  const filename = `support-bot-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
