"use client";

import { useWallet } from "@/components/Providers";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { X1_RPC, buildSplitPurchaseTx } from "@/lib/x1";
import AudioAnalyzer from "@/components/AudioAnalyzer";
import type { AnalysisResult } from "@/lib/audio-analyzer";

interface SongDetail {
  id: string;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  price: number;
  description: string;
  blobUrl: string;
  albumArtUrl: string | null;
  fileSize: number;
  hash: string;
  filename: string;
  createdAt: string;
  previewStart?: number;
  previewDuration?: number;
  previewUrl?: string;
}

export default function SongDetailPage() {
  const params = useParams<{ id: string }>();
  const { connected, publicKey, connect, ensureAuth } = useWallet();
  const [song, setSong] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [purchased, setPurchased] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(false);

  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [buySuccess, setBuySuccess] = useState("");
  const [downloading, setDownloading] = useState(false);

  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio analyzer state (for purchased tracks)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileGenre, setAudioFileGenre] = useState<string>("Default");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Fetch the actual audio file for analysis (only for purchased users)
  const fetchAudioFile = useCallback(async () => {
    if (!song?.blobUrl || !purchased) return;
    try {
      const rawUrl = song.blobUrl;
      const filename = rawUrl.split("/").pop();
      const res = await fetch(`/api/uploads/${filename}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const ext = filename?.includes(".") ? filename.split(".").pop() : "mp3";
      const f = new File([blob], filename || `track.${ext}`, { type: blob.type || `audio/${ext}` });
      setAudioFile(f);
      setAudioFileGenre(song.genre || "Default");
    } catch {}
  }, [song, purchased]);

  useEffect(() => { fetchAudioFile(); }, [fetchAudioFile]);

  // Clean up audio when leaving the page — covers React unmount + SPA transitions
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPreviewPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  const fetchSong = useCallback(async () => {
    if (!params?.id) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/songs/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Song not found");
          return;
        }
        throw new Error("Failed to load song");
      }
      const data = await res.json();
      setSong(data.song);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load song");
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  // Check if user already purchased this song
  const checkPurchaseStatus = useCallback(async () => {
    if (!publicKey || !params?.id || !song) return;
    try {
      setCheckingPurchase(true);
      const res = await fetch(`/api/purchased?wallet=${publicKey}`);
      if (res.ok) {
        const data = await res.json();
        const ids = (data.songs || []).map((s: any) => s.id);
        if (ids.includes(params.id)) {
          setPurchased(true);
        }
      }
    } catch (e) {
      console.error("Purchase check error:", e);
    } finally {
      setCheckingPurchase(false);
    }
  }, [publicKey, params?.id, song]);

  useEffect(() => {
    fetchSong();
  }, [fetchSong]);

  useEffect(() => {
    checkPurchaseStatus();
  }, [checkPurchaseStatus]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const handlePreview = () => {
    if (!song?.blobUrl) return;
    
    // Use dedicated preview clip if it exists, otherwise full track via proxy
    const rawUrl = song.blobUrl || "";
    const filename = rawUrl.split("/").pop();
    const fullTrackUrl = `/api/uploads/${filename}`;
    const audioUrl = song.previewUrl || fullTrackUrl;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener("ended", () => setPreviewPlaying(false));
    } else if (audioRef.current.src !== audioUrl) {
      // Different source URL — recreate
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener("ended", () => setPreviewPlaying(false));
    }
    
    if (previewPlaying) {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPreviewPlaying(false);
    } else {
      // With dedicated preview clip: start at 0
      // With full track: seek to the preview section
      if (!song.previewUrl) {
        audioRef.current.currentTime = song.previewStart ?? 30;
      } else {
        audioRef.current.currentTime = 0;
      }
      
      const previewDuration = song.previewDuration ?? 15;
      audioRef.current.play().catch(() => {});
      setPreviewPlaying(true);
      
      previewTimerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setPreviewPlaying(false);
        }
      }, previewDuration * 1000);
    }
  };

  const handleBuy = async () => {
    if (!song || !publicKey) return;

    // Ensure wallet is authenticated
    const authed = await ensureAuth();
    if (!authed) {
      setBuyError("🔑 Wallet authentication required. Please reconnect and sign.");
      setBuying(false);
      return;
    }

    setBuying(true);
    setBuyError("");
    setBuySuccess("");

    try {
      const win = window as any;
      const provider = win.x1wallet || win.x1 || win.phantom?.solana || win.solflare || win.backpack?.solana;
      if (!provider) {
        throw new Error("No wallet found. Please install Phantom, Solflare, or Backpack.");
      }

      const connection = new Connection(X1_RPC, "confirmed");

      const fromPubKey = new PublicKey(publicKey);
      const lamports = Math.round(song.price * LAMPORTS_PER_SOL);

      // Build split transaction: 80% artist + 20% treasury
      const tx = await buildSplitPurchaseTx(
        fromPubKey,
        song.artistAddress,
        lamports
      );

      // Sign with wallet (shows 2 XNT confirmation popup), send via raw RPC
      // This bypasses X1's broken simulation/subscription endpoints
      const signedTx = await provider.signTransaction(tx);
      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
        { skipPreflight: true, maxRetries: 5 }
      );

      // Give the RPC a moment to index
      const latestBlockhash = await connection.getLatestBlockhash();

      // Use blockhash-based confirmation strategy — avoids X1 WebSocket subscription issues
      try {
        await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, "confirmed");
      } catch (confirmErr) {
        // Best-effort: server will verify independently
        console.warn("Client confirm skipped:", confirmErr);
      }

      // Record purchase on server (server handles retries internally)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: song.id,
          txSignature: signature,
          buyerWallet: publicKey,
        }),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Purchase recording failed");
      }

      setPurchased(true);
      setBuySuccess("Purchase successful! You can now download the track.");
    } catch (err: any) {
      // Wallet rejection or on-chain failure
      const msg = err instanceof Error ? err.message : "Purchase failed";
      if (msg.includes("User rejected") || msg.includes("cancel") || msg.includes("reject")) {
        setBuyError("Transaction cancelled");
      } else {
        setBuyError(msg);
      }
    } finally {
      setBuying(false);
    }
  };


  const handleDownload = () => {
    if (!song?.blobUrl) return;
    setDownloading(true);
    const rawUrl = song.blobUrl || "";
    const filename = rawUrl.split("/").pop();
    const downloadFilename = (song as any).originalFilename || song.filename || `${song.title || "track"}.mp3`;
    const a = document.createElement("a");
    a.href = `/api/uploads/${filename}`;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 3000);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="flex items-center justify-center gap-3 text-text-secondary">
          <span className="w-6 h-6 border-2 border-text-accent/30 border-t-text-accent rounded-full animate-spin" />
          <span>Loading track...</span>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">🎵</div>
        <h1 className="text-2xl font-bold mb-4 text-text-accent">{error || "Song not found"}</h1>
        <Link href="/browse" className="btn-primary">
          ← Back to Browse
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/browse" className="text-sm text-text-secondary hover:text-text-accent transition-colors">
          ← Back to Browse
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Art + Actions */}
        <div className="md:col-span-1">
          <div className="aspect-square bg-gradient-to-br from-accent/20 to-blue-500/20 rounded-2xl mb-6 flex items-center justify-center overflow-hidden">
            {song.albumArtUrl ? (
              <img
                src={song.albumArtUrl}
                alt={song.title}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <img
                src="/brand/bb-logo.jpg"
                alt="Blockchain Beats"
                className="w-full h-full object-contain rounded-2xl opacity-30 p-8"
              />
            )}
          </div>

          {/* Price + Buy/Download */}
          <div className="card p-5">
            <div className="text-center mb-4">
              <div className="text-3xl font-extrabold text-accent">{song.price} XNT</div>
              <div className="text-text-secondary text-sm mt-1">{formatSize(song.fileSize)}</div>
            </div>

            {!connected && (
              <button onClick={connect} className="btn-primary w-full">
                🔌 Connect Wallet to Buy
              </button>
            )}

            {connected && !purchased && (
              <button
                onClick={handleBuy}
                disabled={buying}
                className="btn-primary w-full"
              >
                {buying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Confirming...
                  </span>
                ) : (
                  `Buy for ${song.price} XNT`
                )}
              </button>
            )}

            {connected && purchased && (
              <button onClick={handleDownload} disabled={downloading} className="btn-primary w-full">
                {downloading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving to device...
                  </span>
                ) : (
                  "⬇️ Download Track"
                )}
              </button>
            )}

            {/* Preview button */}
            <button
              onClick={handlePreview}
              className="btn-secondary w-full mt-3"
            >
              {previewPlaying ? "⏹ Stop Preview" : "▶️ Preview (15s)"}
            </button>

            {buyError && (
              <div className="mt-3 p-3 rounded-xl bg-[rgba(108,140,255,0.08)] border border-[rgba(108,140,255,0.2)] text-text-accent text-sm">
                ⚠️ {buyError}
              </div>
            )}

            {buySuccess && (
              <div className="mt-3 p-3 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] text-green-400 text-sm">
                ✅ {buySuccess}
              </div>
            )}
          </div>
        </div>

        {/* Right: Details */}
        <div className="md:col-span-2">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{song.title}</h1>
          <p className="text-text-secondary text-lg mb-4">by {song.artist}</p>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="chip">{song.genre}</span>
            {song.hash && (
              <span className="text-xs text-text-secondary bg-white/5 px-3 py-1 rounded-full">
                SHA-256: {song.hash.slice(0, 12)}...
              </span>
            )}
          </div>

          {song.description && (
            <div className="card p-5 mb-6">
              <h3 className="font-semibold mb-2">About this track</h3>
              <p className="text-text-secondary leading-relaxed">{song.description}</p>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold mb-3">Track Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Artist Address</span>
                <span className="font-mono">{song.artistAddress.slice(0, 6)}...{song.artistAddress.slice(-4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">File Size</span>
                <span>{formatSize(song.fileSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Released</span>
                <span>{formatDate(song.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Price</span>
                <span className="font-bold">{song.price} XNT</span>
              </div>
            </div>
          </div>

          {/* Audio Analyzer Dashboard — shows for owners/artists */}
          {(connected && purchased) && audioFile && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3 text-text-secondary text-sm tracking-wide uppercase">
                🔊 Audio Analysis Dashboard
              </h3>
              <AudioAnalyzer
                key={audioFile.name + audioFile.size}
                file={audioFile}
                genre={audioFileGenre}
                onResult={setAnalysisResult}
              />
            </div>
          )}

          {connected && purchased && (
            <div className="mt-6 card p-5 border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.05)]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-400">You own this track</p>
                  <p className="text-text-secondary text-sm">Download it anytime from this page or My Purchases</p>
                </div>
              </div>
              {/* Persistent download permalink */}
              <div className="mt-4 pt-4 border-t border-green-500/10 text-center">
                <a
                  href={`/api/dl/${song.id}`}
                  target="_blank"
                  className="text-sm text-text-secondary hover:text-text-accent underline underline-offset-2"
                >
                  🔗 Direct download link
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
