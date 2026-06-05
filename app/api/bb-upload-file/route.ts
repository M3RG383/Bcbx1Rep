import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const FILE_SERVER = "https://jack0.x1.xyz:8800";

// Proxies file uploads to the bb-server data/storage node at jack0.x1.xyz:8800
// This bypasses Vercel's 4.5MB serverless body limit by streaming through
// the bb-server's raw multipart parser, which stores files directly on disk.
export async function POST(req: NextRequest) {
  try {
    // Read the incoming FormData and reconstruct it for the upstream server
    const formData = await req.formData();
    const upstream = new URL(`${FILE_SERVER}/api/bb-upload`);

    const upstreamForm = new FormData();
    for (const [key, val] of formData.entries()) {
      upstreamForm.append(key, val);
    }

    const upstreamRes = await fetch(upstream.toString(), {
      method: "POST",
      body: upstreamForm,
      // @vercel/blob needs no auth here — bb-server is open on purpose for uploads
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Storage server error (${upstreamRes.status}): ${errText}` },
        { status: upstreamRes.status }
      );
    }

    const data = await upstreamRes.json();

    // Rewrite URLs: bb-server returns /uploads/x or full https://jack0.x1.xyz:8800/uploads/x
    // but the Vercel frontend needs to go through the /api/uploads/ proxy
    if (data.savedFiles) {
      data.savedFiles = data.savedFiles.map((f: any) => ({
        ...f,
        url: f.url
          ? f.url.replace(/^(https?:\/\/[^/]+)?\/uploads\//, "/api/uploads/")
          : f.url,
      }));
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "File upload failed";
    console.error("bb-upload-file proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}