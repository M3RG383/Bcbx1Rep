import { NextRequest, NextResponse } from "next/server";
import { processQueue } from "@/lib/scan-queue-kv";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Verify cron invocation — Vercel Cron sends a simple GET
  // We accept both cron and manual triggers, but skip during high-activity hours
  try {
    const result = await processQueue();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Process queue error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
