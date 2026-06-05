import { NextRequest, NextResponse } from "next/server";
import { getStoredNftMetadata } from "@/lib/nft-mint";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const metadata = getStoredNftMetadata(id);
    if (!metadata) {
      return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
    }
    return NextResponse.json(metadata, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("NFT metadata error:", err);
    return NextResponse.json({ error: "Failed to load metadata" }, { status: 500 });
  }
}