import { NextRequest, NextResponse } from "next/server";
import { kvSmembers, kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";

    const wallets = await kvSmembers("artists:list");
    const results: Array<{ wallet: string; name: string; bio: string; avatarUrl: string }> = [];

    for (const wallet of wallets) {
      const profile = await kvHgetall<Record<string, string>>(`artist:${wallet}`);
      if (!profile) continue;

      const name = profile.name || "";
      const bio = profile.bio || "";
      const avatarUrl = profile.avatarUrl || "";

      // If search is empty, return all; otherwise filter
      if (search) {
        const nameLower = name.toLowerCase();
        const walletLower = wallet.toLowerCase();
        if (!nameLower.includes(search) && !walletLower.includes(search)) continue;
      }

      results.push({ wallet, name, bio, avatarUrl });
    }

    // Sort alphabetically by name
    results.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    return NextResponse.json({ artists: results });
  } catch (err) {
    console.error("Artists list error:", err);
    return NextResponse.json({ error: "Failed to fetch artists" }, { status: 500 });
  }
}