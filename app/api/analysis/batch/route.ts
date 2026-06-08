import { NextRequest, NextResponse } from "next/server";
import { kvSmembers, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/analysis/batch
 * Returns list of song IDs that do not have a cached analysis result.
 * Useful for backfilling analysis data.
 */
export async function POST(req: NextRequest) {
  try {
    const songIds = await kvSmembers("songs:list");
    const needsBackfill: string[] = [];

    for (const id of songIds) {
      const cached = await kvHgetall<Record<string, unknown>>(`analysis:${id}`);
      if (!cached || !cached.data) {
        needsBackfill.push(id);
      }
    }

    return NextResponse.json({ songIds: needsBackfill });
  } catch (err) {
    console.error("Analysis batch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}