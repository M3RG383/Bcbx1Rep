import { NextRequest, NextResponse } from "next/server";
import { kvHgetall, kvSmembers } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artistWallet = searchParams.get("artist");

  if (!artistWallet) {
    return NextResponse.json({ count: 0, volume: 0 });
  }

  try {
    // Find all song IDs by this artist
    const allSongIds = (await kvSmembers("songs:list")) as string[];
    const artistSongIds: string[] = [];

    for (const id of allSongIds) {
      const song = await kvHgetall<Record<string, any>>(`songs:${id}`);
      if (!song) continue;
      const addr = String(song.artistAddress || song.artist || "");
      if (addr === artistWallet) {
        artistSongIds.push(id);
      }
    }

    if (artistSongIds.length === 0) {
      return NextResponse.json({ count: 0, volume: 0 });
    }

    // Scan all buyer wallets to find purchases of this artist's songs
    const allBuyers = (await kvSmembers("buyers")) as string[];
    let totalSales = 0;
    let totalVolume = 0;

    for (const wallet of allBuyers) {
      const boughtIds = (await kvSmembers(`purchases:${wallet}`)) as string[];
      for (const sid of boughtIds) {
        if (artistSongIds.includes(sid)) {
          totalSales++;
          const song = await kvHgetall<Record<string, any>>(`songs:${sid}`);
          if (song) totalVolume += parseFloat(String(song.price || "0"));
        }
      }
    }

    return NextResponse.json({ count: totalSales, volume: totalVolume });
  } catch (err) {
    console.error("Purchases API error:", err);
    return NextResponse.json({ count: 0, volume: 0 });
  }
}