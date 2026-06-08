import { NextRequest, NextResponse } from "next/server";
import { kvSmembers, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = body.limit ? Number(body.limit) : undefined;

    // Get all songs from the registry
    const songIds = await kvSmembers("songs:list");

    // Filter out songs that already have cached analysis
    const needsBackfill: string[] = [];
    for (const id of songIds) {
      const cached = await kvHgetall<Record<string, unknown>>(`analysis:${id}`);
      if (!cached || !cached.overallScore) {
        needsBackfill.push(id);
      }
      if (limit !== undefined && needsBackfill.length >= limit) break;
    }

    return NextResponse.json({
      totalSongs: songIds.length,
      cachedCount: songIds.length - needsBackfill.length,
      needsBackfillCount: needsBackfill.length,
      songIds: needsBackfill,
    });
  } catch (err) {
    console.error("Analysis batch API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check batch status" },
      { status: 500 }
    );
  }
}