// API client for Blockchain Beats backend
// Uses relative paths — Vercel rewrites proxy to the backend server

const API_BASE = "/api";

export async function uploadSong(formData: FormData) {
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json();
}

export async function listSongs(params?: {
  genre?: string;
  artist?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.genre) query.set("genre", params.genre);
  if (params?.artist) query.set("artist", params.artist);
  if (params?.search) query.set("search", params.search);

  const res = await fetch(`${API_BASE}/songs?${query.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch songs");
  return res.json();
}

export async function getSong(id: string) {
  const res = await fetch(`${API_BASE}/songs/${id}`);
  if (!res.ok) throw new Error("Song not found");
  return res.json();
}

export async function downloadSong(id: string, purchased = true) {
  const res = await fetch(`${API_BASE}/download/${id}?purchased=${purchased}`);
  if (!res.ok) throw new Error("Download failed");
  return res;
}

export async function verifySong(id: string) {
  const res = await fetch(`${API_BASE}/verify/${id}`);
  if (!res.ok) throw new Error("Verification failed");
  return res.json();
}

export function getArtUrl(id: string): string {
  return `${API_BASE}/art/${id}`;
}