import { NextRequest, NextResponse } from "next/server";
import NodeID3 from "node-id3";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    let url = req.nextUrl.searchParams.get("url");
    const filename = req.nextUrl.searchParams.get("filename") || "track.mp3";
    const originalFilename = req.nextUrl.searchParams.get("originalFilename") || filename;
    const title = req.nextUrl.searchParams.get("title") || "";
    const artist = req.nextUrl.searchParams.get("artist") || "";
    const genreStr = req.nextUrl.searchParams.get("genre") || "";
    const albumArtUrl = req.nextUrl.searchParams.get("albumArt") || "";
    const forceDownload = req.nextUrl.searchParams.get("dl") !== "0";

    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Vercel Blob URLs are already absolute HTTPS
    // Local relative paths would go through FILE_BASE but we're on blob now

    // Sanitise filename to match song title
    const ext = filename.includes(".") ? filename.split(".").pop() : "mp3";
    const safeName = (originalFilename || title || filename.replace(/\.[^/.]+$/, "") || "track")
      .replace(/[/\\:*?"<>|]/g, "_")
      .substring(0, 120) + "." + ext;

    // Fetch the file from blob storage
    const upstream = await fetch(url, { signal: AbortSignal.timeout(60000) });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    // Read entire response into buffer
    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No response body" }, { status: 502 });
    }

    const chunks: Buffer[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks);

    // Inject ID3 metadata tags into the MP3
    const tags: Record<string, any> = {};

    if (title) tags.title = title;
    if (artist) tags.artist = artist;
    if (genreStr) tags.genre = genreStr;
    if (title) tags.album = title; // album = song title for singles

    // Fetch album art from blob and embed it
    if (albumArtUrl) {
      try {
        const artRes = await fetch(albumArtUrl, { signal: AbortSignal.timeout(10000) });
        if (artRes.ok) {
          const artBuffer = Buffer.from(await artRes.arrayBuffer());
          tags.image = {
            type: {
              id: 3, // cover (front)
              name: "Cover (front)",
            },
            mime: "image/jpeg",
            description: "Cover",
            imageBuffer: artBuffer,
          };
        }
      } catch {
        // Non-fatal if art fetch fails
      }
    }

    // Write tags to buffer
    let finalBuffer = buffer;
    if (Object.keys(tags).length > 0) {
      try {
        const tagged = NodeID3.write(tags, buffer);
        if (tagged) finalBuffer = Buffer.from(tagged);
      } catch {
        // If tagging fails, serve raw file
      }
    }

    const contentDisposition = forceDownload
      ? `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
      : `inline; filename="${safeName}"`;

    return new NextResponse(finalBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": contentDisposition,
        "Content-Length": String(finalBuffer.length),
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

// Allow up to 50MB files
export const maxDuration = 60;