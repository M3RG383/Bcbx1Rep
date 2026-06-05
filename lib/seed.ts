import { kvSadd, kvHset } from "./db";

export interface SeedTrack {
  id: string;
  title: string;
  artist: string;
  fingerprint: number[];
  hash: string;
  created_at: string;
  isReference?: boolean;
}

let seeded = false;

export async function seedFingerprints(seedData: { tracks: SeedTrack[] }) {
  if (seeded) return;
  seeded = true;

  for (const track of seedData.tracks) {
    await kvHset(`track:${track.id}`, track as unknown as Record<string, unknown>);
    await kvSadd("fingerprint:tracks", track.id);
  }

  console.log(`[Seed] Seeded ${seedData.tracks.length} reference fingerprints into KV`);
}
