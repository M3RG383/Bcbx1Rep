import { NextRequest, NextResponse } from "next/server";
import { kvHgetall, kvSadd } from "@/lib/db";
import { verifyXntTransferTo } from "@/lib/x1";
import { mintNftToBuyer } from "@/lib/nft-mint";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { songId, txSignature, buyerWallet } = body;

    if (!songId || !txSignature || !buyerWallet) {
      return NextResponse.json(
        { error: "Missing required fields: songId, txSignature, buyerWallet" },
        { status: 400 }
      );
    }

    // Fetch song metadata
    const songData = await kvHgetall<Record<string, unknown>>(`songs:${songId}`);
    if (!songData) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const artistAddress = String(songData.artistAddress || songData.artist || "");
    const priceXnt = parseFloat(String(songData.price || "0"));
    const blobUrl = String(songData.blobUrl || "");

    if (!artistAddress) {
      return NextResponse.json(
        { error: "Song has no artist address" },
        { status: 400 }
      );
    }

    const expectedLamports = Math.round(priceXnt * LAMPORTS_PER_SOL);

    // Verify the on-chain transaction was sent to the artist for the correct amount
    const verification = await verifyXntTransferTo(
      txSignature,
      expectedLamports,
      buyerWallet,
      artistAddress
    );

    if (!verification.verified) {
      return NextResponse.json(
        { error: verification.message, verified: false },
        { status: 400 }
      );
    }

    // Record the purchase
    await kvSadd(`purchases:${buyerWallet}`, songId);
    await kvSadd("buyers", buyerWallet);

    // Mint NFT to buyer (BcBx1: Track Title)
    let nftMintAddress = "";
    try {
      const trackTitle = String(songData.title || "Untitled");
      const artistName = String(songData.artist || "Unknown");
      const albumArtUrl = songData.albumArtUrl ? String(songData.albumArtUrl) : null;

      nftMintAddress = await mintNftToBuyer(
        buyerWallet,
        trackTitle,
        artistName,
        blobUrl,
        albumArtUrl,
      );
    } catch (nftErr) {
      // NFT minting is best-effort — don't block the purchase
      console.error("NFT mint error (non-fatal):", nftErr);
    }

    // Increment daily sales counter (EST)
    try {
      const estDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { kvHgetall, kvHset } = await import('@/lib/db');
      const stats = (await kvHgetall<Record<string, number>>('stats')) || {};
      const sKey = `${estDate}|sales`;
      const vKey = `${estDate}|volume`;
      stats[sKey] = (stats[sKey] || 0) + 1;
      stats[vKey] = (stats[vKey] || 0) + priceXnt;
      await kvHset('stats', stats);
    } catch {}

    return NextResponse.json({
      success: true,
      songUrl: blobUrl,
      nftMint: nftMintAddress,
      message: nftMintAddress
        ? "Purchase recorded! NFT sent to your wallet."
        : "Purchase recorded successfully",
    });
  } catch (err) {
    console.error("Purchase API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purchase failed" },
      { status: 500 }
    );
  }
}
