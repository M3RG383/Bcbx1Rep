#!/usr/bin/env node
/**
 * Backfill Preview Analysis — runs loudest-section analysis on all existing tracks.
 * 
 * Usage:
 *   node scripts/backfill-preview.mjs
 * 
 * Set BASE_URL if running against a deployed site:
 *   BASE_URL=https://blockchainbeats.xyz node scripts/backfill-preview.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DATA_API = "https://jack0.x1.xyz:8800/api/data";

async function api(path) {
  const res = await fetch(`${DATA_API}${path}`);
  if (!res.ok) throw new Error(`Data API ${res.status}: ${path}`);
  const data = await res.json();
  return data?.result ?? data;
}

async function main() {
  const songIds = await api("/smembers/songs:list");
  console.log(`Found ${songIds.length} tracks\n`);

  for (const songId of songIds) {
    const song = await api(`/hgetall/songs:${songId}`);
    if (!song) {
      console.log(`[${songId}] SKIP — no metadata`);
      continue;
    }

    const title = song.title || "?";
    const blobUrl = song.blobUrl || song.blob_url || "";

    // Check if previewStart already set
    if (song.previewStart !== undefined && song.previewStart !== null) {
      console.log(`[${title}] SKIP — already analyzed (previewStart=${song.previewStart}s)`);
      continue;
    }

    // Resolve relative URLs to full file server URLs
    let fullUrl = blobUrl;
    if (blobUrl.startsWith("/api/uploads/")) {
      fullUrl = `https://jack0.x1.xyz:8800${blobUrl.replace("/api/uploads/", "/uploads/")}`;
    } else if (blobUrl.startsWith("/uploads/")) {
      fullUrl = `https://jack0.x1.xyz:8800${blobUrl}`;
    } else if (blobUrl.startsWith("http")) {
      fullUrl = blobUrl;
    } else {
      console.log(`[${title}] SKIP — unknown URL format: ${blobUrl}`);
      continue;
    }

    console.log(`[${title}] Analyzing...`);

    try {
      const res = await fetch(`${BASE_URL}/api/analyze-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, blobUrl: fullUrl }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        console.log(`[${title}] ERROR: ${res.status} ${err.slice(0, 200)}`);
        continue;
      }

      const result = await res.json();
      console.log(`[${title}] ✅ previewStart=${result.previewStart}s (${result.duration}s total, method=${result.method})`);
    } catch (err) {
      console.log(`[${title}] FAILED: ${err.message}`);
    }

    // Small delay between tracks
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("\nDone!");
}

main().catch(console.error);