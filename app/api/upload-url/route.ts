import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 30;

// Client requests a signed upload URL — uploads directly to Vercel's CDN
// This avoids browser security restrictions on non-standard HTTPS ports
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, contentType } = body;
    if (!filename) {
      return NextResponse.json({ error: "Missing filename" }, { status: 400 });
    }

    const ext = filename.includes(".") ? filename.split(".").pop() : "mp3";
    const safeName = `${crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)}.${ext}`;

    const blob = await put(safeName, new Blob([]), {
      access: "public",
      contentType: contentType || "audio/mpeg",
      addRandomSuffix: false,
    });

    // Return the upload URL the client can PUT to
    // Vercel Blob handles the actual file bytes via their SDK
    return NextResponse.json({
      success: true,
      uploadUrl: blob.url,
      url: blob.url,
      filename: safeName,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed to create upload URL",
    }, { status: 500 });
  }
}