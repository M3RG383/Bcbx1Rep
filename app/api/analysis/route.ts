import { NextRequest, NextResponse } from "next/server";
import { kvHset, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AnalysisPayload {
  songId: string;
  analysis: {
    overallScore: number;
    passed: boolean;
    genre: Record<string, unknown>;
    metrics: Record<string, unknown>[];
    summary: string;
    enhancementTips: string[];
    createdAt: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalysisPayload;

    if (!body || !body.songId || !body.analysis) {
      return NextResponse.json(
        { error: "Missing required fields: songId and analysis" },
        { status: 400 }
      );
    }

    const { songId, analysis } = body;

    // Strip dashboard data — only store the metrics/scores/summary
    const analysisRecord: Record<string, unknown> = {
      overallScore: analysis.overallScore,
      passed: analysis.passed ? "true" : "false",
      genre: JSON.stringify(analysis.genre),
      metrics: JSON.stringify(analysis.metrics),
      summary: analysis.summary,
      enhancementTips: JSON.stringify(analysis.enhancementTips),
      createdAt: analysis.createdAt || new Date().toISOString(),
      cachedAt: new Date().toISOString(),
    };

    await kvHset(`analysis:${songId}`, analysisRecord);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Analysis cache POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cache analysis" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const songId = req.nextUrl.searchParams.get("songId");

    if (!songId) {
      return NextResponse.json(
        { error: "Missing required query param: songId" },
        { status: 400 }
      );
    }

    const cached = await kvHgetall<Record<string, string | undefined>>(
      `analysis:${songId}`
    );

    if (!cached || !cached.overallScore) {
      return NextResponse.json({ result: null });
    }

    // Check for expired cache
    if (cached.cachedAt) {
      const age = Date.now() - new Date(cached.cachedAt).getTime();
      if (age > CACHE_TTL_MS) {
        return NextResponse.json({ result: null });
      }
    }

    // Reconstruct the analysis object from stored fields
    const analysis = {
      overallScore: Number(cached.overallScore),
      passed: cached.passed === "true",
      genre: cached.genre ? JSON.parse(cached.genre) : null,
      metrics: cached.metrics ? JSON.parse(cached.metrics) : [],
      summary: cached.summary || "",
      enhancementTips: cached.enhancementTips
        ? JSON.parse(cached.enhancementTips)
        : [],
      createdAt: cached.createdAt || "",
    };

    return NextResponse.json({ result: analysis });
  } catch (err) {
    console.error("Analysis cache GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}