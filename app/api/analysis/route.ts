import { NextRequest, NextResponse } from "next/server";
import { kvHset, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/analysis
 * Stores analysis result in KV cache as analysis:{songId} (30-day TTL).
 * Body: { songId, analysis }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { songId, analysis } = body;

    if (!songId || !analysis) {
      return NextResponse.json(
        { error: "Missing required fields: songId, analysis" },
        { status: 400 }
      );
    }

    // Store serialized analysis in a hash field
    await kvHset(`analysis:${songId}`, { data: JSON.stringify(analysis) });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Analysis POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analysis?songId=xxx
 * Returns cached analysis or null if not found.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const songId = searchParams.get("songId");

    if (!songId) {
      return NextResponse.json(
        { error: "Missing songId query parameter" },
        { status: 400 }
      );
    }

    const entry = await kvHgetall<Record<string, unknown>>(`analysis:${songId}`);
    if (!entry || !entry.data) {
      return NextResponse.json({ result: null });
    }

    const analysis = typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data;
    return NextResponse.json({ result: analysis });
  } catch (err) {
    console.error("Analysis GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}