import { NextResponse } from "next/server";
import { kvHgetall, kvSmembers } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Count total songs
    const songIds = await kvSmembers("songs:list");
    const songCount = Array.isArray(songIds) ? songIds.length : 0;

    // Count unique artist wallets
    const uniqueArtists = new Set<string>();
    if (Array.isArray(songIds)) {
      for (const id of songIds) {
        const song = await kvHgetall<Record<string, any>>(`songs:${id}`);
        if (song) {
          const addr = String(song.artistAddress || song.artist || "");
          if (addr) uniqueArtists.add(addr);
        }
      }
    }

    // Sum total lifetime volume from daily stats hash
    const stats = (await kvHgetall<Record<string, string | number>>("stats")) || {};
    let totalVolume = 0;
    for (const [key, val] of Object.entries(stats)) {
      if (key.endsWith("|volume")) {
        totalVolume += Number(val) || 0;
      }
    }

    return NextResponse.json({
      songs: songCount,
      artists: uniqueArtists.size,
      volume: totalVolume,
      currency: "XNT",
    });
  } catch (err) {
    console.error("Landing stats error:", err);
    return NextResponse.json({ songs: 0, artists: 0, volume: 0, currency: "XNT" });
  }
}