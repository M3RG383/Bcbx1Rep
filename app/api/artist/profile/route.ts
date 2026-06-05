import { NextRequest, NextResponse } from "next/server";
import { kvHgetall, kvHset, kvSadd } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
    }

    const profile = await kvHgetall<Record<string, string>>(`artist:${wallet}`);
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        wallet,
        name: profile.name || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || "",
      },
    });
  } catch (err) {
    console.error("Artist profile GET error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, name, bio, avatarUrl } = body;

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    await kvHset(`artist:${wallet}`, {
      name: name || "",
      bio: bio || "",
      avatarUrl: avatarUrl || "",
    });

    // Register in the artists list set
    await kvSadd("artists:list", wallet);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Artist profile POST error:", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}