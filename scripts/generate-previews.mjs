#!/usr/bin/env node
/**
 * Preview Generator — generates 15-second preview clips and uploads to Vercel Blob.
 * 
 * 1. Downloads audio from the file server
 * 2. Analyzes via local Python to find loudest section
 * 3. Generates preview MP3 via ffmpeg
 * 4. Uploads to Vercel Blob
 * 5. Stores previewUrl in song metadata
 *
 * Usage:
 *   node scripts/generate-previews.mjs [--all | --song-id <id>]
 *   node scripts/generate-previews.mjs --all          # backfill all
 *   node scripts/generate-previews.mjs --single <id>  # one track
 */

const DATA_API = "https://jack0.x1.xyz:8800/api/data";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "store_hHcE3h9QpOp8c6Pr";
const { execSync } = await import("child_process");
const { writeFileSync, unlinkSync, existsSync } = await import("fs");
const { join, dirname } = await import("path");
const { fileURLToPath } = await import("url");

const __dirname = dirname(fileURLToPath(import.meta.url));

async function api(path) {
  const res = await fetch(`${DATA_API}${path}`);
  if (!res.ok) throw new Error(`Data API ${res.status}: ${path}`);
  const data = await res.json();
  return data?.result ?? data;
}

async function uploadToBlob(filePath, filename) {
  const { put } = await import("@vercel/blob");
  const fs = await import("fs");
  const blob = await put(filename, fs.createReadStream(filePath), {
    access: "public",
    contentType: "audio/mpeg",
    addRandomSuffix: false,
  });
  return blob.url;
}

function runPythonAnalyzer(audioUrl, songId) {
  const script = join(__dirname, "..", "scripts", "analyze_preview.py");
  if (!existsSync(script)) throw new Error("analyze_preview.py not found");
  
  const output = execSync(
    `python3 "${script}" "${audioUrl}" --preview-duration 15 --margin 5`,
    { timeout: 90000, maxBuffer: 10 * 1024 * 1024, encoding: "utf-8" }
  ).trim();
  
  return JSON.parse(output);
}

function generatePreviewClip(audioUrl, startSec, duration, outputPath) {
  // Download a small section using ffmpeg range request
  const cmd = [
    "ffmpeg", "-y",
    "-ss", String(startSec),
    "-i", audioUrl,
    "-t", String(duration),
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    outputPath
  ];
  
  execSync(cmd.join(" "), { timeout: 120000, stdio: "pipe" });
  return existsSync(outputPath);
}

async function processSong(songId) {
  const song = await api(`/hgetall/songs:${songId}`);
  if (!song || !song.blobUrl) {
    console.log(`[${songId}] SKIP — no metadata or blobUrl`);
    return;
  }

  const title = song.title || "?";
  
  // Skip if already has previewUrl
  if (song.previewUrl) {
    console.log(`[${title}] SKIP — has previewUrl already`);
    return;
  }

  // Resolve audio URL
  let audioUrl = song.blobUrl;
  if (audioUrl.startsWith("/api/uploads/")) {
    audioUrl = `https://jack0.x1.xyz:8800/${audioUrl.replace("/api/uploads/", "uploads/")}`;
  } else if (audioUrl.startsWith("/uploads/")) {
    audioUrl = `https://jack0.x1.xyz:8800${audioUrl}`;
  } else if (audioUrl.startsWith("https://") || audioUrl.startsWith("http://")) {
    audioUrl = audioUrl.replace(/^https:\/\/jack0\.x1\.xyz:8800\/uploads\//, "https://jack0.x1.xyz:8800/uploads/");
  } else {
    console.log(`[${title}] SKIP — unknown URL: ${audioUrl}`);
    return;
  }

  // Try the nginx proxy URL (port 443, which has better range support)
  audioUrl = audioUrl.replace("jack0.x1.xyz:8800", "jack0.x1.xyz").replace("/uploads/", "/uploads/");

  console.log(`[${title}] Analyzing...`);

  try {
    // Step 1: Find the best preview window
    const analysis = runPythonAnalyzer(audioUrl, songId);
    if (analysis.error) {
      console.log(`[${title}] Analysis error: ${analysis.error}`);
      return;
    }

    console.log(`  → Starts at ${analysis.previewStart}s, duration ${analysis.previewDuration}s (${analysis.method})`);

    // Step 2: Generate preview clip
    const tmpPath = `/tmp/preview_${songId}.mp3`;
    console.log(`  → Generating preview clip...`);
    
    const success = generatePreviewClip(audioUrl, analysis.previewStart, analysis.previewDuration, tmpPath);
    if (!success) {
      console.log(`[${title}] ffmpeg failed`);
      return;
    }

    // Step 3: Upload to Vercel Blob
    console.log(`  → Uploading to Vercel Blob...`);
    const blobUrl = await uploadToBlob(tmpPath, `preview_${songId}.mp3`);
    console.log(`  → Blob URL: ${blobUrl}`);

    // Step 4: Store in KV
    console.log(`  → Storing metadata...`);
    await fetch(`${DATA_API}/hset/songs:${songId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        previewUrl: blobUrl,
        previewStart: analysis.previewStart,
        previewDuration: analysis.previewDuration,
      }),
    });

    // Cleanup
    if (existsSync(tmpPath)) unlinkSync(tmpPath);

    console.log(`[${title}] ✅ Preview ready: ${blobUrl}`);
  } catch (err) {
    console.log(`[${title}] FAILED: ${err.message?.slice(0, 200)}`);
  }
}

// ─── Main ───
const args = process.argv.slice(2);
const isAll = args.includes("--all");
const singleArg = args.find(a => a.startsWith("--single="));
const singleId = singleArg ? singleArg.split("=")[1] : null;

if (singleId) {
  await processSong(singleId);
} else if (isAll) {
  const songIds = await api("/smembers/songs:list");
  console.log(`Found ${songIds.length} tracks\n`);
  for (const sid of songIds) {
    await processSong(sid);
    await new Promise(r => setTimeout(r, 2000)); // throttle
  }
} else {
  console.log("Usage: node scripts/generate-previews.mjs [--all | --single=<id>]");
}
console.log("\nDone!");