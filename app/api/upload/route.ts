import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { kvHset, kvSadd, kvGet, kvSet } from "@/lib/db";
import { enqueueScan } from "@/lib/scan-queue-kv";
import { seedFingerprints } from "@/lib/seed";

export const runtime = "nodejs";
export const maxDuration = 60;

let seeded = false;
async function ensureSeed() {
  if (seeded) return;
  seeded = true;
  try { const { default: fdb } = await import("@/data/fingerprint-db.json"); await seedFingerprints(fdb); } catch { }
}

// Client uploads audio file directly to HTTPS file server (64.20.42.194:3004),
// bypassing Vercel 4.5MB serverless body limit and mixed-content restrictions.
// This route only receives metadata JSON (tiny payload).
export async function POST(req: NextRequest) {
  await ensureSeed();
  try {
    const body = await req.json();
    const { title, genre, price, description, artist, filename, originalFilename, fileSize, hash, blobUrl, albumArtUrl, isMember, feeTx } = body;
    if (!title || !artist || !filename) return NextResponse.json({ error: "Missing required" }, { status: 400 });

    const songId = uuidv4();
    const songUrl = (blobUrl || `/uploads/${filename}`).replace(/^\/uploads\//, "/api/uploads/");

    const metadata = {
      id: songId, title, genre: genre || "Unknown",
      price: parseFloat(String(price || "0")), description: description || "",
      artist, artistAddress: artist, filename,
      originalFilename: originalFilename || filename,
      blobUrl: songUrl, hash: hash || "", fileSize: fileSize || 0,
      albumArtUrl: albumArtUrl || null,
      isMemberUpload: isMember === true, createdAt: new Date().toISOString(),
    };

    try { await kvHset(`songs:${songId}`, metadata as Record<string, unknown>); await kvSadd("songs:list", songId); } catch {}
    if (feeTx) {
      try { const e = JSON.parse((await kvGet<string>("fee:ledger")) || "[]"); e.push({ wallet: artist, songId, amount: 1.5, currency: "XNT", feeTx, timestamp: Date.now() }); await kvSet("fee:ledger", JSON.stringify(e)); } catch {}
    }
    try { await enqueueScan({ songId, blobUrl: songUrl, title, artist }); } catch {}

    // Trigger preview analysis in background (fire-and-forget)
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3000}`;
      fetch(`${baseUrl}/api/analyze-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, blobUrl: songUrl }),
      }).catch(() => {});
    } catch {
      // Preview analysis is non-critical
    }

    // Increment daily upload counter (EST)
    try {
      const estDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { kvHgetall, kvHset } = await import('@/lib/db');
      const stats = (await kvHgetall<Record<string, number>>('stats')) || {};
      const key = `${estDate}|uploads`;
      stats[key] = (stats[key] || 0) + 1;
      await kvHset('stats', stats);
    } catch {}

    return NextResponse.json({
      success: true, id: songId, hash: hash || "",
      songUrl, metadata,
      feeWaived: isMember === true, uploadFee: isMember ? 0 : 1.5,
      scanStatusEndpoint: `/api/copyright/result/${songId}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}