import { NextResponse } from "next/server";
import { db } from "@/db";

export async function GET() {
  try {
    await db.run("SELECT 1");

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "failed",
      },
      {
        status: 500,
      }
    );
  }
}
