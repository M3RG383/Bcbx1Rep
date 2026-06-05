import { NextRequest, NextResponse } from "next/server";
import { kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const stats = (await kvHgetall<Record<string, number>>("stats")) || {};
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    return NextResponse.json({
      uploads: stats[`${today}|uploads`] || 0,
      sales: stats[`${today}|sales`] || 0,
      volume: stats[`${today}|volume`] || 0,
      date: today,
    });
  } catch {
    return NextResponse.json({ uploads: 0, sales: 0, volume: 0, date: "" });
  }
}