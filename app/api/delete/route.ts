import { NextRequest, NextResponse } from "next/server";
import { kvDel, kvSmembers, kvSet, kvHgetall, kvHget, kvHset } from "@/lib/db";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { songId, wallet } = body;
    if (!songId || !wallet) {
      return NextResponse.json({ error: "Missing songId or wallet" }, { status: 400 });
    }

    // Get full song metadata to verify ownership
    const fullSong: any = await kvHgetall(`songs:${songId}`);
    if (!fullSong) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Verify ownership
    if (fullSong.artist !== wallet && fullSong.artistAddress !== wallet) {
      return NextResponse.json({ error: "Not authorized — you don't own this song" }, { status: 403 });
    }

    const filename = fullSong.filename || "";
    const blobUrl = fullSong.blobUrl || "";

    // Delete from KV store
    await kvDel(`songs:${songId}`);

    // Remove from songs:list set
    try {
      const list = await kvSmembers("songs:list");
      const updated = list.filter((id: string) => id !== songId);
      await kvSet("songs:list", updated);
    } catch {}

    // Delete the physical file — Vercel Blob URL or local
    let fileDeleted = false;
    if (blobUrl && blobUrl.startsWith("http")) {
      // Vercel Blob — use SDK
      try {
        await del(blobUrl);
        fileDeleted = true;
      } catch (e) {
        console.error("Blob delete error:", e);
      }
    } else if (filename) {
      // Local file server
      try {
        const fileRes = await fetch(`https://jack0.x1.xyz:8800/api/bb-delete/${encodeURIComponent(filename)}`, {
          method: "DELETE",
        });
        if (fileRes.ok) fileDeleted = true;
      } catch (e) {
        console.error("File delete error:", e);
      }
    }
    // Also delete album art blob URL
    const albumArtUrl = (fullSong as any).albumArtUrl;
    if (albumArtUrl && albumArtUrl.startsWith("http")) {
      try { await del(albumArtUrl); } catch {}
    }

    // Clean up any purchase records for this song
    try {
      const purchases = await kvHgetall<Record<string, unknown>>("purchases");
      if (purchases) {
        for (const [walletAddr, songsRaw] of Object.entries(purchases)) {
          if (typeof songsRaw === "string" && songsRaw.includes(songId)) {
            try {
              const list = JSON.parse(songsRaw);
              const filtered = Array.isArray(list) ? list.filter((s: any) => s.songId !== songId && s.id !== songId) : list;
              await kvHset("purchases", { [walletAddr]: JSON.stringify(filtered) });
            } catch {}
          }
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Track permanently deleted",
      fileDeleted,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Delete failed",
    }, { status: 500 });
  }
}