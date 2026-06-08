"use client";
import { useWallet } from "@/components/Providers";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Song {
  id: string;
  title: string;
  genre: string;
  price: number;
  blobUrl: string;
  albumArtUrl: string | null;
  createdAt: string;
  hash: string;
  fileSize: number;
}

export default function DashboardPage() {
  const { connected, publicKey, ensureAuth } = useWallet();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [salesCount, setSalesCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [xntRate, setXntRate] = useState<number | null>(null);
  // Delete state
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Song | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  // Artist profile state
  const [artistName, setArtistName] = useState("");
  const [artistBio, setArtistBio] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const fetchArtistProfile = useCallback(async () => {
    if (!publicKey) return;
    try {
      setProfileLoading(true);
      const res = await fetch(`/api/artist/profile?wallet=${publicKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setArtistName(data.profile.name || "");
          setArtistBio(data.profile.bio || "");
        }
      }
    } catch {} finally {
      setProfileLoading(false);
    }
  }, [publicKey]);

  const fetchMySongs = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/songs?artist=${publicKey}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.songs || [];
        setSongs(list);
        const earned = list.reduce((sum: number, s: any) => sum + (s.price || 0), 0);
        setTotalEarned(earned);
        setSalesCount(list.filter((s: any) => false).length);
        try {
          const pRes = await fetch(`/api/purchases?artist=${publicKey}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            setSalesCount(pData.count || 0);
            setTotalEarned(pData.volume || 0);
          }
        } catch {}
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchMySongs();
      fetchArtistProfile();
    }
  }, [connected, publicKey, fetchMySongs, fetchArtistProfile]);

  useEffect(() => {
    fetch("/api/price")
      .then((res) => res.json())
      .then((data) => setXntRate(data.xntToUsd))
      .catch(() => {});
  }, []);

  const handleDeleteClick = (song: Song) => {
    setConfirmDelete(song);
    setDeleteStatus(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete || !publicKey) return;
    // Re-authenticate before deleting
    const authed = await ensureAuth();
    if (!authed) {
      setDeleteStatus("🔑 Wallet authentication required");
      return;
    }
    setDeletingIds(prev => new Set([...prev, confirmDelete.id]));
    setDeleteStatus(null);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: confirmDelete.id, wallet: publicKey }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Delete failed");
      }
      const data = await res.json();
      setDeleteStatus("deleted");
      // Remove from local state
      setSongs(prev => prev.filter(s => s.id !== confirmDelete.id));
    } catch (err) {
      setDeleteStatus(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(confirmDelete.id);
        return next;
      });
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
    setDeleteStatus(null);
  };

  if (!connected) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Artist Dashboard</h1>
        <p className="text-text-secondary">Connect your wallet to view your dashboard</p>
      </div>
    );
  }

  const xntVal = (n: number) => `${n.toFixed(2)} XNT`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Artist Dashboard</h1>
      <p className="text-text-secondary mb-8 font-mono text-sm">{publicKey?.slice(0, 12)}...</p>

      {/* Artist Profile Section */}
      <div className="section-gradient rounded-xl p-6 mb-8">
        <h2 className="section-heading mb-4 flex items-center gap-2">
          <span>🎨</span> Artist Profile
        </h2>
        {profileLoading ? (
          <div className="text-text-secondary text-sm flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Loading profile...
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                className="input w-full"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Your artist alias / display name"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1.5 block">
                Bio
              </label>
              <textarea
                className="input w-full resize-none"
                rows={3}
                value={artistBio}
                onChange={(e) => setArtistBio(e.target.value)}
                placeholder="Tell listeners about yourself and your music..."
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!publicKey) return;
                  setProfileSaving(true);
                  setProfileMessage(null);
                  try {
                    const res = await fetch("/api/artist/profile", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ wallet: publicKey, name: artistName, bio: artistBio }),
                    });
                    if (res.ok) {
                      setProfileMessage("✅ Profile saved!");
                    } else {
                      setProfileMessage("⚠️ Failed to save");
                    }
                  } catch {
                    setProfileMessage("⚠️ Failed to save");
                  } finally {
                    setProfileSaving(false);
                    setTimeout(() => setProfileMessage(null), 4000);
                  }
                }}
                disabled={profileSaving}
                className="btn-primary text-sm"
              >
                {profileSaving ? "Saving..." : "💾 Save Profile"}
              </button>
              {profileMessage && (
                <span className="text-xs text-green-400 fade-in">{profileMessage}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 fade-in">
        <div className="card p-6">
          <div className="text-text-secondary text-sm mb-1">Total Sales</div>
          <div className="text-3xl font-bold text-accent">{salesCount}</div>
          <div className="text-xs text-text-secondary mt-1">songs sold</div>
        </div>
        <div className="card p-6">
          <div className="text-text-secondary text-sm mb-1">Total Earned</div>
          <div className="text-3xl font-bold text-accent">{xntVal(totalEarned)}</div>
          <div className="text-xs text-text-secondary mt-1">80% of sales</div>
        </div>
        <div className="card p-6">
          <div className="text-text-secondary text-sm mb-1">Uploaded</div>
          <div className="text-3xl font-bold text-accent">{songs.length}</div>
          <div className="text-xs text-text-secondary mt-1">tracks</div>
        </div>
      </div>

      {/* Songs List */}
      <h2 className="section-heading mb-4">Your Songs</h2>
      {loading ? (
        <div className="card p-8 text-center text-text-secondary">
          <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin inline-block" />
          <p className="mt-2">Loading your tracks...</p>
        </div>
      ) : songs.length === 0 ? (
        <div className="card p-8 text-center text-text-secondary">
          <p className="text-lg mb-2">No songs uploaded yet</p>
          <Link href="/upload" className="btn-primary mt-4 inline-flex">
            Upload Your First Track
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {songs.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 card p-4 hover:border-dark-border-hover transition-colors"
            >
              <Link href={`/song/${s.id}`} className="flex items-center gap-4 flex-1 min-w-0 no-underline">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent/20 to-blue-500/20 flex items-center justify-center shrink-0">
                  🎵
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text-primary truncate">{s.title}</div>
                  <div className="text-xs text-text-secondary">{s.genre}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-accent">{s.price} XNT</div>
                  {xntRate !== null && (
                    <div className="text-xs text-text-secondary">≈ ${(s.price * xntRate).toFixed(2)} USD</div>
                  )}
                </div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDeleteClick(s); }}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold
                  bg-[rgba(239,68,68,0.15)] text-red-400 border border-[rgba(239,68,68,0.25)]
                  hover:bg-[rgba(239,68,68,0.25)] transition-colors"
                disabled={deletingIds.has(s.id)}
              >
                {deletingIds.has(s.id) ? "..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Referral Section */}
      <div className="mt-8">
        <h2 className="section-heading mb-4">Referral Program</h2>
        <div className="card p-6">
          <p className="text-text-secondary mb-4">
            Earn referral bonuses when buyers discover your music through your referral links.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={`https://blockchainbeats.xyz/?ref=${publicKey?.slice(0, 8)}`}
              className="input flex-1 font-mono text-sm"
              readOnly
            />
            <button
              className="btn-secondary text-sm"
              onClick={() => navigator.clipboard.writeText(`https://blockchainbeats.xyz/?ref=${publicKey?.slice(0, 8)}`)}
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-8 max-w-md w-full mx-4 text-center">
            {deleteStatus === "deleted" ? (
              <>
                <div className="text-5xl mb-4">🗑️</div>
                <h3 className="text-xl font-bold mb-2">File Deleted</h3>
                <p className="text-text-secondary mb-6">
                  &ldquo;{confirmDelete.title}&rdquo; has been permanently removed from the system.
                </p>
                <button onClick={handleDeleteCancel} className="btn-primary w-full">
                  Done
                </button>
              </>
            ) : deleteStatus ? (
              <>
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold mb-2">Delete Failed</h3>
                <p className="text-text-secondary mb-2">{deleteStatus}</p>
                <button onClick={handleDeleteCancel} className="btn-primary w-full mt-4">
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold mb-2">Are you sure?</h3>
                <p className="text-text-secondary mb-2">
                  Permanently delete &ldquo;{confirmDelete.title}&rdquo;?
                </p>
                <p className="text-xs text-red-400 mb-6">
                  This will flush the file and all metadata from the system. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteCancel}
                    className="btn-secondary flex-1"
                    disabled={deletingIds.has(confirmDelete.id)}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm
                      bg-[rgba(239,68,68,0.2)] text-red-400 border border-[rgba(239,68,68,0.3)]
                      hover:bg-[rgba(239,68,68,0.35)] transition-colors"
                    disabled={deletingIds.has(confirmDelete.id)}
                  >
                    {deletingIds.has(confirmDelete.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}