"use client";

import { useWallet } from "@/components/Providers";
import { useState, useEffect } from "react";
import Link from "next/link";

// Genre tree — same as upload page
const genreTree: Record<string, string[]> = {
  Electronic: [
    "Techno House", "Progressive House", "Dance House", "House",
    "Deep House", "Tech House", "Trance", "Dubstep",
    "Drum and Bass", "Ambient", "Synthwave", "Breakbeat",
  ],
  "Hip Hop": ["Trap", "Boom Bap", "Drill", "Cloud Rap", "Crunk", "Grime", "Lo-fi Hip Hop"],
  "R&B": ["Neo-Soul", "Contemporary R&B", "Alternative R&B", "Soul", "Funk"],
  Pop: ["Synth Pop", "Dream Pop", "Indie Pop", "Art Pop", "Electropop", "Hyperpop"],
  Rock: ["Indie Rock", "Alternative Rock", "Hard Rock", "Post-Punk", "Shoegaze", "Prog Rock", "Psychedelic Rock"],
  Jazz: ["Smooth Jazz", "Bebop", "Fusion", "Acid Jazz", "Nu Jazz", "Free Jazz"],
  "Lo-Fi": ["Lo-fi Hip Hop", "Chillwave", "Vaporwave", "Ambient Lo-Fi", "Study Beats"],
};

const allGenres = Object.keys(genreTree);
const GENRES = ["All", ...allGenres];

interface Song {
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
  createdAt: string;
  previewStart?: number;
  previewDuration?: number;
  previewUrl?: string;
}

// Animated counter — ramps up to target
function AnimatedNum({ n }: { n: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (n === 0) { setDisplay(0); return; }
    let frame = 0;
    const total = 20;
    const interval = setInterval(() => {
      frame++;
      setDisplay(Math.min(Math.round((n / total) * frame), n));
      if (frame >= total) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [n]);
  return <span>{display}</span>;
}

export default function BrowsePage() {
  const { connected } = useWallet();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ uploads: 0, sales: 0, volume: 0, date: "" });
  const [xntRate, setXntRate] = useState(0.583);

  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [subgenre, setSubgenre] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // XNT→USD rate — adjustable, will pull from oracle when available
  const XNT_USD_RATE = xntRate;

  // Fetch songs + daily stats + price on mount
  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        setError("");
        const [songsRes, statsRes] = await Promise.all([
          fetch("/api/songs"),
          fetch("/api/stats"),
        ]);
        if (!songsRes.ok) throw new Error("Failed to load songs");
        const songsData = await songsRes.json();
        setSongs(songsData.songs || []);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
        // Fetch live price
        try {
          const priceRes = await fetch("/api/price");
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            if (priceData.xntToUsd) setXntRate(priceData.xntToUsd);
          }
        } catch {} // fallback to 0.583
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load songs");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Client-side filter + sort
  const filtered = songs.filter((s) => {
    if (genre !== "All" && !s.genre.includes(genre)) return false;
    if (subgenre && !s.genre.includes(subgenre)) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) &&
        !s.artist.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">

      {/* ── DAILY STATS BANNER ── */}
      <div className="relative mb-8 overflow-hidden rounded-xl bg-gradient-to-r from-[#3b82f6]/10 via-[#60a5fa]/10 to-[#3b82f6]/10 border border-[rgba(108,140,255,0.2)]">
        {/* Animated glow line */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(108,140,255,0.08)] to-transparent animate-pulse pointer-events-none" />
        <div className="flex items-stretch divide-x divide-[rgba(108,140,255,0.15)]">
          {/* Label block */}
          <div className="flex flex-col items-center justify-center px-5 py-4 min-w-[80px]">
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-text-secondary">Today</span>
            <span className="text-[10px] text-text-secondary/60 mt-0.5">{stats.date}</span>
          </div>
          {/* Uploads */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-3">
            <span className="text-[#3b82f6] text-lg leading-none mb-1">📤</span>
            <span className="text-xl md:text-2xl font-black text-white">
              <AnimatedNum n={stats.uploads} />
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">uploads</span>
          </div>
          {/* Sales */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-3">
            <span className="text-[#3b82f6] text-lg leading-none mb-1">💰</span>
            <span className="text-xl md:text-2xl font-black text-white">
              <AnimatedNum n={stats.sales} />
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5">sales</span>
          </div>
          {/* XNT→USD rate */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-3 bg-[rgba(108,140,255,0.05)] rounded-r-lg md:rounded-r-none md:rounded-r-lg">
            <span className="text-emerald-400 text-lg leading-none mb-1">💹</span>
            <span className="text-xl md:text-2xl font-black text-white">
              1 XNT
            </span>
            <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 mt-0.5">= ${XNT_USD_RATE.toFixed(6)} USD</span>
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold">
          Browse <span className="accent-text">Music</span>
        </h1>
        <span className="text-sm text-text-secondary/60">
          {filtered.length} track{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-wrap gap-3 mb-8">
        <input
          type="text"
          placeholder="Search songs..."
          className="warm-input flex-1 min-w-[180px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="warm-input w-auto"
          value={genre}
          onChange={(e) => { setGenre(e.target.value); setSubgenre(""); }}
        >
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {genre !== "All" && genreTree[genre] && (
          <select
            className="warm-input w-auto"
            value={subgenre}
            onChange={(e) => setSubgenre(e.target.value)}
          >
            <option value="">All {genre}</option>
            {genreTree[genre].map((sg) => (
              <option key={sg} value={sg}>{sg}</option>
            ))}
          </select>
        )}
        <select
          className="warm-input w-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="price-low">Price: Low → High</option>
          <option value="price-high">Price: High → Low</option>
        </select>
      </div>

      {/* ── LOADING ── */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-text-secondary">
          <span className="w-6 h-6 border-2 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin" />
          <span>Loading tracks...</span>
        </div>
      )}

      {/* ── ERROR ── */}
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

      {/* ── GRID ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {filtered.map((song) => (
            <Link
              key={song.id}
              href={`/song/${song.id}`}
              className="warm-card p-3 md:p-3.5 group block transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="aspect-square bg-gradient-to-br from-[#3b82f6]/20 to-[#60a5fa]/20 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                {song.albumArtUrl ? (
                  <img
                    src={song.albumArtUrl}
                    alt={song.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <img
                    src="/brand/bb-logo.jpg"
                    alt="Blockchain Beats"
                    className="w-full h-full object-contain rounded-lg opacity-40 p-4"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-sm md:text-base leading-tight group-hover:text-[#3b82f6] transition-colors line-clamp-1">
                  {song.title}
                </h3>
                <p className="text-text-secondary text-xs truncate">{song.artist}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] md:text-xs bg-[rgba(108,140,255,0.1)] text-[#3b82f6] px-2 py-0.5 rounded-full truncate max-w-[70%]">
                    {song.genre}
                  </span>
                  <div className="text-right shrink-0">
                    <div className="text-sm md:text-base font-bold">{song.price} XNT</div>
                    <div className="text-text-secondary text-[10px]">≈ ${(song.price * XNT_USD_RATE).toFixed(2)}</div>
                    <div className="text-text-secondary text-[10px]">{formatSize(song.fileSize)}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── EMPTY ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-xl mb-2">No songs found</p>
          <p>Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}