"use client";

import { useWallet } from "@/components/Providers";
import { useState, useEffect } from "react";
import Link from "next/link";

interface PurchasedSong {
  id: string;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  price: number;
  blobUrl: string;
  filename: string;
  originalFilename?: string;
  albumArtUrl: string | null;
}

export default function MyPurchasesPage() {
  const { connected, publicKey, connect } = useWallet();
  const [songs, setSongs] = useState<PurchasedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPurchases() {
      if (!publicKey) return;
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/purchased?wallet=${publicKey}`);
        if (!res.ok) {
          throw new Error("Failed to load purchases");
        }
        const data = await res.json();
        setSongs(data.songs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load purchases");
      } finally {
        setLoading(false);
      }
    }

    if (connected && publicKey) {
      fetchPurchases();
    }
  }, [connected, publicKey]);

  const handleDownload = (song: PurchasedSong) => {
    const rawUrl = song.blobUrl || "";
    const filename = rawUrl.split("/").pop();
    const downloadFilename = (song as any).originalFilename || song.filename || `${song.title || "track"}.mp3`;
    const a = document.createElement("a");
    a.href = `/api/uploads/${filename}`;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">🎒</div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          My <span className="accent-text">Purchases</span>
        </h1>
        <p className="text-text-secondary text-lg mb-8 max-w-md mx-auto leading-relaxed">
          Connect your wallet to view and download your purchased tracks.
        </p>
        <button onClick={connect} className="bubble-btn bubble-btn-lg animate-float">
          🔌 Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
        My <span className="accent-text">Purchases</span>
      </h1>
      <p className="text-text-secondary mb-8">
        Wallet: <span className="font-mono text-white">{publicKey?.slice(0, 6)}...{publicKey?.slice(-4)}</span>
      </p>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-text-secondary">
          <span className="w-6 h-6 border-2 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />
          <span>Loading your library...</span>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16 text-[#3b82f6]">
          <p className="text-xl mb-2">⚠️ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="warm-btn mt-4"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && songs.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 opacity-30">🎵</div>
          <p className="text-xl text-text-secondary mb-2">No purchases yet</p>
          <p className="text-text-secondary mb-6">Browse the marketplace and discover your next favorite track</p>
          <Link href="/browse" className="bubble-btn">
            Browse Music
          </Link>
        </div>
      )}

      {!loading && !error && songs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {songs.map((song) => (
            <div
              key={song.id}
              className="warm-card p-4 flex flex-col"
            >
              <Link href={`/song/${song.id}`} className="block mb-4">
                <div className="aspect-square bg-gradient-to-br from-[#3b82f6]/20 to-[#60a5fa]/20 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  {song.albumArtUrl ? (
                    <img
                      src={song.albumArtUrl}
                      alt={song.title}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-5xl opacity-30">🎵</span>
                  )}
                </div>
                <h3 className="font-semibold text-lg hover:text-[#3b82f6] transition-colors truncate">
                  {song.title}
                </h3>
                <p className="text-text-secondary text-sm">{song.artist}</p>
                <span className="inline-block mt-1 text-xs bg-[rgba(108,140,255,0.1)] text-[#3b82f6] px-2 py-0.5 rounded-full">
                  {song.genre}
                </span>
              </Link>

              <div className="mt-auto pt-4 border-t border-white/5">
                <button
                  onClick={() => handleDownload(song)}
                  className="bubble-btn w-full text-sm"
                >
                  ⬇️ Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}