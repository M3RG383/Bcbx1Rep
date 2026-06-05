import { NextRequest, NextResponse } from "next/server";
import { kvHgetall } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

// Dedicated iOS-safe download endpoint.
// iOS Safari refuses a.download for audio/* and ignores blob URLs.
// The only thing that works: navigate to a URL serving application/octet-stream.
//
// /api/dl/:id  →  looks up song metadata, proxies from bb-server, returns octet-stream
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await kvHgetall<Record<string, unknown>>(`songs:${id}`);

    if (!data) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Use original filename if available, otherwise title, otherwise UUID
    const originalFilename = String(data.originalFilename || "");
    const title = String(data.title || "");
    const blobUrl = String(data.blobUrl || "");
    const hash = String(data.hash || "");

    // The blobUrl is stored as /api/uploads/<uuid>.mp3 — rebuild the bb-server URL
    const filename = blobUrl.split("/").pop();
    const upstream = `https://jack0.x1.xyz:8800/uploads/${filename}`;

    // Build a nice download filename
    let downloadName: string;
    if (originalFilename) {
      downloadName = originalFilename;
    } else if (title) {
      downloadName = `${title}.mp3`;
    } else {
      downloadName = `track_${id.slice(0, 8)}.mp3`;
    }
    // Sanitise
    downloadName = downloadName.replace(/[/\\:*?"<>|]/g, "_").substring(0, 200);

    // Proxy the file, streaming — no memory buffering needed
    const upstreamRes = await fetch(upstream, {
      signal: AbortSignal.timeout(120000),
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `File not found (${upstreamRes.status})` },
        { status: upstreamRes.status }
      );
    }

    // Return as octet-stream with Content-Disposition: attachment
    // This triggers the iOS share sheet / save-to-files regardless of file type
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
      "X-Content-Type-Options": "nosniff",
    };

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;
    if (hash) headers["X-Content-Hash"] = hash;

    return new NextResponse(upstreamRes.body, { status: 200, headers });
  } catch (err) {
    console.error("iOS download error:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}