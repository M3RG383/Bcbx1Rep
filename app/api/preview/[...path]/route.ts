import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const FILE_SERVER = "https://jack0.x1.xyz:8800";

// Proxies /preview/* requests to the bb-server preview clip generator
// Preview clips are ~240KB 30-second mono mp3s at 22kHz — fast to serve
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = path.join("/");
    const upstream = `${FILE_SERVER}/preview/${filePath}`;

    const upstreamRes = await fetch(upstream, {
      signal: AbortSignal.timeout(15000),
    });

    if (!upstreamRes.ok) {
      // Preview doesn't exist — fall back to full file
      return NextResponse.redirect(
        new URL(`/api/uploads/${filePath}`, req.url)
      );
    }

    const contentType = upstreamRes.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstreamRes.headers.get("content-length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    };

    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(upstreamRes.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    // Fall back to full file on error
    const { path } = await params;
    const filePath = path.join("/");
    return NextResponse.redirect(
      new URL(`/api/uploads/${filePath}`, req.url)
    );
  }
}