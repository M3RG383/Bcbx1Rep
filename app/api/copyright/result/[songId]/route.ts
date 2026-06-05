import { NextRequest, NextResponse } from "next/server";
import { getScanResult } from "@/lib/scan-queue-kv";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ songId: string }> }) {
  try {
    const { songId } = await params;
    const result = await getScanResult(songId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Scan result error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
