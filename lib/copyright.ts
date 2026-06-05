import { createHash } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import { fingerprint, similarity } from "./spectral";
import { kvHgetall, kvSmembers, kvHset, kvSadd } from "./db";

export const SAMPLE_RATE = 22050;
export const SIMILARITY_THRESHOLD = 0.70;

export interface FingerprintRecord {
  id: string;
  title: string;
  artist: string;
  fingerprint: number[];
  hash: string | null;
  created_at: string;
  isReference?: boolean;
}

export interface CheckResult {
  passed: boolean;
  matches: MatchResult[];
  confidence: number;
  threshold: number;
  hash?: string;
  durationSeconds?: number;
}

export interface MatchResult {
  track: {
    id: string;
    title: string;
    artist: string;
    hash: string | null;
    created_at: string;
    isReference: boolean;
  };
  similarity: number;
}

// Extract mono PCM at 22050 Hz from a file path or buffer
export async function extractFingerprintFromBuffer(buffer: Buffer): Promise<{ hashes: number[]; durationSeconds: number }> {
  // Write to a temp file since fluent-ffmpeg needs a path
  const os = await import("os");
  const path = await import("path");
  const fs = await import("fs");
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `bb-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const pcmPath = `${tmpPath}.pcm`;

  try {
    fs.writeFileSync(tmpPath, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpPath)
        .audioChannels(1)
        .audioFrequency(SAMPLE_RATE)
        .audioCodec("pcm_s16le")
        .format("s16le")
        .on("error", reject)
        .on("end", resolve)
        .save(pcmPath);
    });

    const pcmBuffer = fs.readFileSync(pcmPath);

    // Convert Int16LE buffer to float array [-1, 1]
    const totalSamples = pcmBuffer.length / 2;
    const floats = new Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const val = pcmBuffer.readInt16LE(i * 2);
      floats[i] = val / 32768.0;
    }

    const result = fingerprint(floats, SAMPLE_RATE);
    return result;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
    try { fs.unlinkSync(pcmPath); } catch {}
  }
}

export function computeFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function checkAgainstDb(fp: { hashes: number[] }): Promise<CheckResult> {
  const trackIds = await kvSmembers("fingerprint:tracks");
  const matches: MatchResult[] = [];

  for (const id of trackIds) {
    const track = await kvHgetall<FingerprintRecord>(`track:${id}`);
    if (!track || !track.fingerprint) continue;
    const fpHashes = Array.isArray(track.fingerprint)
      ? track.fingerprint
      : (typeof track.fingerprint === "string" ? JSON.parse(track.fingerprint) : []);
    if (!fpHashes.length) continue;

    const sim = similarity(fp.hashes, fpHashes as number[]);
    if (sim >= SIMILARITY_THRESHOLD) {
      matches.push({
        track: {
          id: track.id,
          title: track.title,
          artist: track.artist,
          hash: track.hash || null,
          created_at: track.created_at,
          isReference: track.isReference || false,
        },
        similarity: Math.round(sim * 1000) / 10,
      });
    }
  }

  // Sort descending by similarity
  matches.sort((a, b) => b.similarity - a.similarity);

  const topConfidence = matches.length ? matches[0].similarity : 0;
  const passed = topConfidence < 70; // flagged if >= 70

  return {
    passed,
    matches,
    confidence: topConfidence,
    threshold: 70,
  };
}

export async function scanFileBuffer(buffer: Buffer): Promise<CheckResult & { hash: string; durationSeconds: number; fingerprint: number[] }> {
  const fp = await extractFingerprintFromBuffer(buffer);
  const result = await checkAgainstDb(fp);
  const hash = computeFileHash(buffer);
  return {
    ...result,
    hash,
    durationSeconds: Math.round(fp.durationSeconds * 10) / 10,
    fingerprint: fp.hashes,
  };
}

export async function registerTrackInKv(
  id: string,
  title: string,
  artist: string,
  fingerprintHashes: number[],
  hash?: string | null
) {
  const entry: FingerprintRecord = {
    id,
    title,
    artist,
    fingerprint: fingerprintHashes,
    hash: hash || null,
    created_at: new Date().toISOString(),
  };

  await kvHset(`track:${id}`, entry as unknown as Record<string, unknown>);
  await kvSadd("fingerprint:tracks", id);

  return { success: true, track: entry };
}
