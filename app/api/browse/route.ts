import { NextRequest, NextResponse } from "next/server";
import { kvSmembers, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get("genre");
    const artist = searchParams.get("artist");
    const search = searchParams.get("search");

    const songIds = await kvSmembers("songs:list");
    const songs: Record<string, unknown>[] = [];

    for (const id of songIds) {
      const song = await kvHgetall<Record<string, unknown>>(`songs:${id}`);
      if (song) songs.push(song);
    }

    let results = [...songs];

    if (genre) {
      results = results.filter(
        (s) => typeof s.genre === "string" && s.genre.toLowerCase() === genre.toLowerCase()
      );
    }
    if (artist) {
      results = results.filter(
        (s) => typeof s.artist === "string" && s.artist.toLowerCase().includes(artist.toLowerCase())
      );
    }
    if (search) {
      results = results.filter(
        (s) => typeof s.title === "string" && s.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    return NextResponse.json({ songs: results });
  } catch (err) {
    console.error("Browse error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
