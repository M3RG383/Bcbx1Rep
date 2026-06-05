import { NextRequest, NextResponse } from "next/server";
import { kvSmembers, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export interface PurchasedSong {
  id: string;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  price: number;
  blobUrl: string;
  filename: string;
  originalFilename?: string;
  albumArtUrl: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet parameter" },
        { status: 400 }
      );
    }

    const songIds = await kvSmembers(`purchases:${wallet}`);
    const songs: PurchasedSong[] = [];

    for (const songId of songIds) {
      const data = await kvHgetall<Record<string, unknown>>(`songs:${songId}`);
      if (!data) continue;

      songs.push({
        id: String(data.id || songId),
        title: String(data.title || "Untitled"),
        artist: String(data.artist || ""),
        artistAddress: String(data.artistAddress || data.artist || ""),
        genre: String(data.genre || ""),
        price: parseFloat(String(data.price || "0")),
        blobUrl: String(data.blobUrl || ""),
        filename: String(data.filename || ""),
        originalFilename: data.originalFilename ? String(data.originalFilename) : undefined,
        albumArtUrl: data.albumArtUrl ? String(data.albumArtUrl) : null,
      });
    }

    return NextResponse.json({ songs });
  } catch (err) {
    console.error("Purchased API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch purchases" },
      { status: 500 }
    );
  }
}
