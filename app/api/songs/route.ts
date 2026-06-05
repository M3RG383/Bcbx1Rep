import { NextRequest, NextResponse } from "next/server";
import { kvSmembers, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export interface SongResponse {
  id: string;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  price: number;
  description: string;
  blobUrl: string;
  albumArtUrl: string | null;
  fileSize: number;
  createdAt: string;
  previewStart?: number;
  previewDuration?: number;
  previewUrl?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const genreFilter = searchParams.get("genre")?.toLowerCase() || "";
    const artistFilter = searchParams.get("artist") || "";

    const songIds = await kvSmembers("songs:list");
    const songs: SongResponse[] = [];

    for (const songId of songIds) {
      const data = await kvHgetall<Record<string, unknown>>(`songs:${songId}`);
      if (!data) continue;

      const song: SongResponse = {
        id: String(data.id || songId),
        title: String(data.title || ""),
        artist: String(data.artist || ""),
        artistAddress: String(data.artistAddress || data.artist || ""),
        genre: String(data.genre || ""),
        price: parseFloat(String(data.price || "0")),
        description: String(data.description || ""),
        blobUrl: String(data.blobUrl || "").replace(/^\/uploads\//, "/api/uploads/"),
        albumArtUrl: data.albumArtUrl ? String(data.albumArtUrl).replace(/^\/uploads\//, "/api/uploads/") : null,
        fileSize: parseInt(String(data.fileSize || "0"), 10),
        createdAt: String(data.createdAt || ""),
        previewStart: data.previewStart !== undefined ? Number(data.previewStart) : undefined,
        previewDuration: data.previewDuration !== undefined ? Number(data.previewDuration) : undefined,
        previewUrl: data.previewUrl ? String(data.previewUrl) : undefined,
      };

      // Artist filter: match the artist address exactly
      if (artistFilter) {
        const songAddress = String(data.artistAddress || data.artist || "");
        if (songAddress !== artistFilter) continue;
      }

      // Genre filter: match if genre or subgenre contains the filter string
      if (genreFilter) {
        const songGenre = song.genre.toLowerCase();
        if (!songGenre.includes(genreFilter)) {
          continue;
        }
      }

      songs.push(song);
    }

    // Sort by newest first
    songs.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ songs });
  } catch (err) {
    console.error("Songs API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch songs" },
      { status: 500 }
    );
  }
}
