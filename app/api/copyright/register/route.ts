import { NextRequest, NextResponse } from "next/server";
import { registerTrackInKv } from "@/lib/copyright";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, artist, fingerprint, hash } = body;

    if (!id || !title || !artist || !fingerprint || !Array.isArray(fingerprint)) {
      return NextResponse.json({ error: "Missing required fields: id, title, artist, fingerprint" }, { status: 400 });
    }

    const result = await registerTrackInKv(id, title, artist, fingerprint, hash || null);
    if (!result.success) {
      return NextResponse.json({ error: "Track already registered", trackId: result.track?.id }, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Copyright register error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
