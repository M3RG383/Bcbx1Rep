import { kvLpush, kvLrange, kvLrem, kvSet, kvGet, kvDel } from "./db";
import { scanFileBuffer, registerTrackInKv } from "./copyright";

export interface ScanEntry {
  songId: string;
  blobUrl: string;
  title: string;
  artist: string;
  enqueuedAt: string;
  attempts: number;
  status: string;
}

export interface CompletedScan {
  songId: string;
  title: string;
  passed: boolean;
  matches: unknown[];
  confidence: number;
  scannedAt: string;
}

const LOW_ACTIVITY_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // 00:00 - 08:59 UTC

export function isLowActivityWindow(): boolean {
  const hour = new Date().getUTCHours();
  return LOW_ACTIVITY_HOURS.includes(hour);
}

export async function enqueueScan(entry: Omit<ScanEntry, "enqueuedAt" | "attempts" | "status">) {
  const fullEntry: ScanEntry = {
    ...entry,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  await kvLpush("scan:queue", JSON.stringify(fullEntry));
  return fullEntry;
}

export async function getScanResult(songId: string) {
  // Check completed
  const completedRaw = await kvGet<string>(`scan:result:${songId}`);
  if (completedRaw) {
    const parsed = JSON.parse(completedRaw) as CompletedScan;
    return { status: "completed", ...parsed };
  }

  // Check pending
  const pending = await kvLrange("scan:queue", 0, -1);
  for (const raw of pending) {
    const entry = JSON.parse(raw) as ScanEntry;
    if (entry.songId === songId) {
      return { status: "pending", songId };
    }
  }

  // Check failed (stored as a separate key pattern)
  const failedRaw = await kvGet<string>(`scan:failed:${songId}`);
  if (failedRaw) {
    const parsed = JSON.parse(failedRaw);
    return { status: "failed", songId, error: parsed.error };
  }

  return { status: "not_found", songId };
}

export async function processQueue() {
  if (!isLowActivityWindow()) return { processed: 0, skipped: true, reason: "not_low_activity" };

  const pending = await kvLrange("scan:queue", 0, -1);
  if (!pending.length) return { processed: 0, skipped: false };

  let processed = 0;

  for (const raw of pending) {
    const entry = JSON.parse(raw) as ScanEntry;

    try {
      // Fetch blob
      const res = await fetch(entry.blobUrl);
      if (!res.ok) throw new Error("Failed to fetch blob for scanning");
      const buffer = Buffer.from(await res.arrayBuffer());

      const result = await scanFileBuffer(buffer);

      if (result.passed) {
        // Register fingerprint in KV database if clean
        await registerTrackInKv(
          entry.songId,
          entry.title,
          entry.artist,
          result.fingerprint,
          result.hash
        );
      }

      const completed: CompletedScan = {
        songId: entry.songId,
        title: entry.title,
        passed: result.passed,
        matches: result.matches,
        confidence: result.confidence,
        scannedAt: new Date().toISOString(),
      };

      await kvSet(`scan:result:${entry.songId}`, JSON.stringify(completed));
      await kvLrem("scan:queue", 0, raw);
      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await kvSet(`scan:failed:${entry.songId}`, JSON.stringify({ error: errorMsg, failedAt: new Date().toISOString() }));
      await kvLrem("scan:queue", 0, raw);
      processed++;
    }
  }

  return { processed, skipped: false };
}

export async function getQueueStats() {
  const pending = await kvLrange("scan:queue", 0, -1);
  return {
    pending: pending.length,
  };
}
