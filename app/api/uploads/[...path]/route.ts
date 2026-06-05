import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const FILE_SERVER = "https://jack0.x1.xyz:8800";

// Proxies /uploads/* file requests to the bb-server storage node
// Vercel rewrites can't handle custom ports, so we proxy at the app level
//
// ⚠️ CRITICAL: Forward Range headers for audio seeking support
// Without this, browsers can't seek into large files (especially WAV)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = path.join("/");
    const upstream = `${FILE_SERVER}/uploads/${filePath}`;

    // ?dl=1 forces octet-stream + attachment for iOS Safari compatibility
    const forceDownload = req.nextUrl.searchParams.get("dl") === "1";

    // Forward Range header for audio seeking support
    const rangeHeader = !forceDownload ? req.headers.get("range") : null;
    const upstreamHeaders: Record<string, string> = {};
    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    const upstreamRes = await fetch(upstream, {
      signal: AbortSignal.timeout(60000),
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: `File not found on storage server (${upstreamRes.status})` },
        { status: upstreamRes.status }
      );
    }

    // Stream the file back with correct content type
    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstreamRes.headers.get("content-length");
    const contentRange = upstreamRes.headers.get("content-range");

    const headers: Record<string, string> = {
      "Content-Type": forceDownload ? "application/octet-stream" : contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      "Accept-Ranges": "bytes",
    };

    if (contentLength) headers["Content-Length"] = contentLength;
    if (contentRange) headers["Content-Range"] = contentRange;

    // Force Content-Disposition: attachment when ?dl=1
    if (forceDownload) {
      headers["Content-Disposition"] = `attachment; filename="${filePath}"`;
      headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Length";
    }

    // Return 206 Partial Content when Range was requested
    const status = rangeHeader ? upstreamRes.status : 200;

    return new NextResponse(upstreamRes.body, {
      status,
      headers,
    });
  } catch (err) {
    console.error("Uploads proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch file from storage server" },
      { status: 502 }
    );
  }
}