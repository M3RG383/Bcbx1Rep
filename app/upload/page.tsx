"use client";
import { useWallet } from "@/components/Providers";
import { useState, useCallback, useRef, useEffect } from "react";
import AudioAnalyzer from "@/components/AudioAnalyzer";
import type { AnalysisResult } from "@/lib/audio-analyzer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const X1_RPC = "https://rpc.mainnet.x1.xyz";
const TREASURY_ADDRESS = "8fBujtC8EzsBpvp1fNrZBoPPLq1D7FQ6tPQ9ZXaQBeSx";
const TREASURY_PUBKEY = new PublicKey(TREASURY_ADDRESS);

const UPLOAD_FEE_XNT = 1.5;
const MONTHLY_SUB_XNT = 8;
const YEARLY_SUB_XNT = 62;
const UPLOAD_FEE_LAMPORTS = Math.round(UPLOAD_FEE_XNT * LAMPORTS_PER_SOL);
const MONTHLY_SUB_LAMPORTS = Math.round(MONTHLY_SUB_XNT * LAMPORTS_PER_SOL);
const YEARLY_SUB_LAMPORTS = Math.round(YEARLY_SUB_XNT * LAMPORTS_PER_SOL);

export default function UploadPage() {
  const { connected, publicKey, connect } = useWallet();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [scanStatusEndpoint, setScanStatusEndpoint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [memberStatus, setMemberStatus] = useState<any>(null);
  const [checkingMember, setCheckingMember] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [pendingFeeTx, setPendingFeeTx] = useState<string | null>(null);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artInputRef = useRef<HTMLInputElement>(null);
  const [albumArtBlob, setAlbumArtBlob] = useState<Blob | null>(null);

  // Genre tree — parent genres mapped to their subgenres
  const genreTree: Record<string, string[]> = {
    Electronic: [
      "Techno House",
      "Progressive House",
      "Dance House",
      "House",
      "Deep House",
      "Tech House",
      "Trance",
      "Dubstep",
      "Drum and Bass",
      "Ambient",
      "Synthwave",
      "Breakbeat",
    ],
    "Hip Hop": [
      "Trap",
      "Boom Bap",
      "Drill",
      "Cloud Rap",
      "Crunk",
      "Grime",
      "Lo-fi Hip Hop",
    ],
    "R&B": [
      "Neo-Soul",
      "Contemporary R&B",
      "Alternative R&B",
      "Soul",
      "Funk",
    ],
    Pop: [
      "Synth Pop",
      "Dream Pop",
      "Indie Pop",
      "Art Pop",
      "Electropop",
      "Hyperpop",
    ],
    Rock: [
      "Indie Rock",
      "Alternative Rock",
      "Hard Rock",
      "Post-Punk",
      "Shoegaze",
      "Prog Rock",
      "Psychedelic Rock",
    ],
    Jazz: [
      "Smooth Jazz",
      "Bebop",
      "Fusion",
      "Acid Jazz",
      "Nu Jazz",
      "Free Jazz",
    ],
    "Lo-Fi": [
      "Lo-fi Hip Hop",
      "Chillwave",
      "Vaporwave",
      "Ambient Lo-Fi",
      "Study Beats",
    ],
  };

  const allGenres = Object.keys(genreTree);

  // Check membership — localStorage backed, server as fallback
  useEffect(() => {
    if (publicKey) {
      // First try localStorage
      const cached = localStorage.getItem(`bb_member_${publicKey}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.expires && parsed.expires > Date.now()) {
            setMemberStatus({
              isMember: true,
              plan: parsed.plan,
              expires: new Date(parsed.expires).toISOString(),
              unlimitedUploads: true,
              uploadFee: 0,
              expiresInDays: Math.round((parsed.expires - Date.now()) / (24 * 60 * 60 * 1000)),
            });
            return;
          }
        } catch {}
      }
      // Fallback to server check
      setCheckingMember(true);
      fetch(`/api/membership/${publicKey}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.isMember) {
            setMemberStatus(data);
          } else {
            setMemberStatus({ isMember: false, uploadFee: UPLOAD_FEE_XNT, currency: "XNT", treasury: TREASURY_ADDRESS, subscribeMonthly: MONTHLY_SUB_XNT, subscribeYearly: YEARLY_SUB_XNT });
          }
          setCheckingMember(false);
        })
        .catch(() => {
          setMemberStatus({ isMember: false, uploadFee: UPLOAD_FEE_XNT, currency: "XNT", treasury: TREASURY_ADDRESS, subscribeMonthly: MONTHLY_SUB_XNT, subscribeYearly: YEARLY_SUB_XNT });
          setCheckingMember(false);
        });
    } else {
      setMemberStatus(null);
    }
  }, [publicKey]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    validateAndSetFile(f);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const validateAndSetFile = (f: File) => {
    setError("");
    setUploadResult(null);
    const allowed = ["audio/mpeg", "audio/wav", "audio/mp3"];
    if (!allowed.includes(f.type) && !f.name.endsWith(".mp3") && !f.name.endsWith(".wav")) {
      setError("Only MP3 and WAV files are allowed");
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError("File size must be under 100MB");
      return;
    }
    setFile(f);
    // Check if non-member needs to show fee before proceeding
    if (memberStatus && !memberStatus.isMember) {
      setShowSubscribeModal(true);
    } else {
      setStep(2);
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !price || !publicKey) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadPhase("");
    setError("");

    // Timeout safety: kill upload if it hangs beyond 90s
    const timeoutId = setTimeout(() => {
      if (uploading) {
        setUploading(false);
        setError("⏱ Upload timed out. Please try again.");
      }
    }, 90000);

    try {
      // Phase 1: Hash the file client-side
      setUploadPhase("🔐 Hashing file...");
      setUploadProgress(5);
      const fileBuffer = await file.arrayBuffer();
      const hashBytes = await crypto.subtle.digest("SHA-256", fileBuffer);
      const hash = Array.from(new Uint8Array(hashBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
      setUploadProgress(15);

      // Phase 2: Upload file through jack0.x1.xyz port 443 (standard HTTPS, no firewall issues)
      const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : ".mp3";
      const filename = `${crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)}${ext}`;

      setUploadPhase(`📡 Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);
      setUploadProgress(20);

      const fileForm = new FormData();
      fileForm.append("file", file, filename);
      if (albumArtBlob) {
        fileForm.append("art", albumArtBlob, `cover_${filename}.jpg`);
      }

      // Upload directly to bb-server storage node — bypass Vercel's 4.5MB body limit
      // CORS is allowed (Access-Control-Allow-Origin: *) on bb-server
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 180000);
      const fileRes = await fetch("https://jack0.x1.xyz:8800/api/bb-upload", {
        method: "POST",
        body: fileForm,
        signal: ac.signal,
      });
      clearTimeout(timeout);

      if (!fileRes || !fileRes.ok) {
        throw new Error("File upload failed — couldn't reach storage server");
      }
      const fileData = await fileRes.json();

      setUploadProgress(75);
      const songUrl = fileData.savedFiles?.[0]?.url || `/uploads/${filename}`;
      const albumArtUrl = fileData.savedFiles?.find((f: any) => f.filename?.startsWith("cover_"))?.url || null;

      // Phase 3: Send metadata to Vercel API (tiny JSON — no 4.5MB limit)
      setUploadPhase("💾 Saving track metadata...");
      setUploadProgress(80);
      const isMemberClaim = memberStatus?.isMember === true;
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          genre: subgenre ? `${genre} > ${subgenre}` : (genre || "Unknown"),
          price: parseFloat(price || "0"),
          description,
          artist: publicKey,
          filename: filename,
          originalFilename: file.name,
          fileSize: file.size,
          hash,
          blobUrl: songUrl,
          albumArtUrl,
          isMember: isMemberClaim,
          feeTx: (!isMemberClaim && pendingFeeTx) ? pendingFeeTx : null,
        }),
      });

      if (!res.ok) {
        let errMsg = "Upload failed";
        try { const e = await res.json(); errMsg = e.error || e.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      setUploadProgress(95);
      setUploadPhase("✅ Finalizing...");

      setUploadResult(data.id);
      setScanStatusEndpoint(data.scanStatusEndpoint || null);
      setUploadProgress(100);
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      console.error("Upload error:", err);
    } finally {
      clearTimeout(timeoutId);
      setUploading(false);
      setUploadPhase("");
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setTitle("");
    setGenre("");
    setSubgenre("");
    setPrice("");
    setDescription("");
    setUploadResult(null);
    setScanStatusEndpoint(null);
    setError("");
    setStep(1);
  };

  const sendXnt = async (amountLamports: number, plan?: "monthly" | "yearly") => {
    const win = window as any;
    const provider = win.x1wallet || win.x1 || win.phantom?.solana || win.solflare || win.backpack?.solana;
    if (!provider) throw new Error("No wallet found. Please install X1 Wallet, Phantom, Solflare, or Backpack.");

    const connection = new Connection(X1_RPC, "confirmed");
    const { blockhash } = await connection.getLatestBlockhash();

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(publicKey!),
        toPubkey: TREASURY_PUBKEY,
        lamports: amountLamports,
      })
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(publicKey!);

    const signed = await provider.signTransaction(tx);
    const txSignature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txSignature, "confirmed");
    return txSignature;
  };

  const subscribe = async (plan: "monthly" | "yearly") => {
    setError("");
    setSubscribing(true);
    try {
      const amountLamports = plan === "yearly" ? YEARLY_SUB_LAMPORTS : MONTHLY_SUB_LAMPORTS;
      const txSignature = await sendXnt(amountLamports);

      const res = await fetch("/api/membership/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey,
          plan,
          txSignature,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Subscription failed");
      }
      const data = await res.json();
      const newMemberStatus = {
        isMember: true,
        plan: data.plan,
        expires: data.expires,
        unlimitedUploads: true,
        uploadFee: 0,
        expiresInDays: data.expiresInDays,
      };
      setMemberStatus(newMemberStatus);
      // Save to localStorage for persistence
      try {
        localStorage.setItem(`bb_member_${publicKey}`, JSON.stringify({
          plan: data.plan,
          expires: new Date(data.expires).getTime(),
          txSignature: txSignature,
          activatedAt: Date.now(),
        }));
      } catch {}
      setShowSubscribeModal(false);
      setSubscriptionSuccess(`🎫 ${plan === "yearly" ? "Yearly" : "Monthly"} membership active! ${data.expiresInDays} days of unlimited uploads remaining.`);
      setTimeout(() => setSubscriptionSuccess(null), 8000);
      setSubscribing(false);
      // Proceed to step 2 if they had a file selected
      if (file) setStep(2);
    } catch (err) {
      setShowSubscribeModal(false);
      setSubscribing(false);
      setError(err instanceof Error ? err.message : "Subscription failed");
    }
  };

  const payUploadFee = async () => {
    setShowSubscribeModal(false);
    setError("");
    setPayingFee(true);
    try {
      const win = window as any;
      const provider = win.x1wallet || win.x1 || win.phantom?.solana || win.solflare || win.backpack?.solana;
      if (!provider) {
        throw new Error("No wallet found. Please install X1 Wallet, Phantom, Solflare, or Backpack.");
      }

      const connection = new Connection(X1_RPC, "confirmed");
      const { blockhash } = await connection.getLatestBlockhash();

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(publicKey!),
          toPubkey: TREASURY_PUBKEY,
          lamports: UPLOAD_FEE_LAMPORTS,
        })
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(publicKey!);

      // Sign and send via wallet provider
      const signed = await provider.signTransaction(tx);
      const txSignature = await connection.sendRawTransaction(signed.serialize());

      // Wait for confirmation
      await connection.confirmTransaction(txSignature, "confirmed");
      setPayingFee(false);

      // Store the fee tx signature for upload
      // It will be verified on-chain by the API
      if (file) {
        // Store the tx signature so it gets sent with the upload
        setPendingFeeTx(txSignature);
        setStep(2);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Payment failed");
      console.error("Fee payment error:", err);
      setPayingFee(false);
    }
  };

  const resizeAlbumArt = useCallback((file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = 100;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        // Center-crop to square then scale
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/jpeg", 0.85);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleArtSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const resized = await resizeAlbumArt(f);
      setAlbumArtBlob(resized);
      setPreview(URL.createObjectURL(resized));
    } catch {
      setError("Could not process album art");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">🎤</div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          Upload Your <span className="accent-text">Music</span>
        </h1>
        <p className="text-text-secondary text-lg mb-8 max-w-md mx-auto leading-relaxed">
          Drop your track, set your price, and earn 80% of every sale. Connect your wallet to get started.
        </p>
        <button onClick={connect} className="bubble-btn bubble-btn-lg animate-float">
          🔌 Connect Wallet
        </button>
      </div>
    );
  }

  // Step 3 — Success
  if (step === 3 && uploadResult) {
    // Generate a short audio profile description from analysis
    const audioProfile = analysisResult ? (() => {
      const dd = analysisResult.dashboard;
      const bpm = dd.bpm > 0 ? dd.bpm : "—";
      const stereo = dd.stereoCorrelation >= 0.5 ? "Wide" : dd.stereoCorrelation >= 0.3 ? "Moderate" : "Narrow";
      const bandwidth = dd.bandwidthHz > 15000 ? "High" : dd.bandwidthHz > 10000 ? "Full" : "Limited";
      const dynamics = dd.dynamicRangeDB > 12 ? "Dynamic" : dd.dynamicRangeDB > 8 ? "Compressed" : "Heavily Compressed";
      const bass = dd.bassRatio > 0.25 ? "Bass-heavy" : dd.bassRatio > 0.15 ? "Balanced" : "Bass-light";
      const quality = analysisResult.overallScore >= 90 ? "Industry-standard" : analysisResult.overallScore >= 70 ? "Decent" : "Low definition";
      const genreProfile = analysisResult.genre.name;
      return `${quality} · ${bass} · ${bandwidth} bandwidth · ${dynamics} · ${stereo} stereo · ${bpm} BPM (${genreProfile})`;
    })() : null;

    const scoreColor = analysisResult?.overallScore != null
      ? (analysisResult.overallScore >= 90 ? "#22c55e" : analysisResult.overallScore >= 70 ? "#eab308" : "#ef4444")
      : "#6c8cff";

    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6 animate-float">🎉</div>
        <div className="warm-card p-10 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.25)] text-green-400 text-xs font-semibold uppercase tracking-wider mb-4">
            ✅ Upload Successful
          </div>
          <h2 className="text-2xl font-extrabold mb-3">
            &ldquo;{title}&rdquo; is Live
          </h2>
          <div className="warm-input text-center font-mono text-xs text-text-secondary mb-2 mx-auto max-w-xs truncate">
            ID: {uploadResult}
          </div>

          {/* Audio Score Card */}
          {analysisResult && audioProfile && (
            <div className="rounded-xl p-5 mb-4 text-left" style={{ backgroundColor: `${scoreColor}08`, border: `1px solid ${scoreColor}25` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold flex items-center gap-2">
                  <span>🎛️</span> Audio Quality Score
                </span>
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreColor} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(analysisResult.overallScore / 100) * 97.4} 97.4`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-extrabold" style={{ color: scoreColor }}>{analysisResult.overallScore}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {audioProfile}
              </p>
            </div>
          )}

          {/* Copyright Scan Notice */}
          <div className="bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🛡️</span>
              <span className="text-sm font-semibold text-indigo-300">Copyright Scan Pending</span>
            </div>
            <p className="text-text-secondary text-xs leading-relaxed">
              Your track is published. A copyright/plagiarism scan will run automatically
              during low-activity hours. If any conflicts are found, you&apos;ll be notified
              in your artist dashboard. Your content stays yours either way.
            </p>
          </div>

          <p className="text-text-secondary text-sm mb-6">
            Your track is on the Blockchain Beats marketplace. Share the link with your fans!
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={resetForm} className="bubble-btn">
              🎵 Upload Another
            </button>
            <a href="/browse" className="bubble-btn bubble-btn-outline">
              Browse Marketplace
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
          {step === 1 ? "Upload Your Track" : "Track Details"}
        </h1>
        <p className="text-text-secondary text-base">
          {step === 1
            ? "Drag your file in or click to browse"
            : "Set your price, pick a genre, and tell fans about your music"
          }
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 justify-center mb-10">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s
                  ? "bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] text-white shadow-lg shadow-[#3b82f6]/30"
                  : "bg-dark-border text-text-secondary"
              }`}
            >
              {step > s ? "✓" : s}
            </div>
            <span className={`text-xs font-semibold ${step >= s ? "text-white" : "text-text-secondary"}`}>
              {s === 1 ? "Select File" : "Details & Publish"}
            </span>
          </div>
        ))}
      </div>

      {/* Membership badge */}
      {memberStatus && (
        <div className="mb-6">
          {memberStatus.isMember ? (
            <div className="warm-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                <span className="text-sm font-semibold">
                  🎫 {memberStatus.plan === "yearly" ? "Yearly" : "Monthly"} Member
                </span>
              </div>
              <span className="text-xs text-text-secondary">
                {memberStatus.expiresInDays} days remaining
              </span>
            </div>
          ) : (
            <div className="warm-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  <span className="font-semibold text-white">1.5 XNT</span> per upload — or{" "}
                  <button onClick={() => setShowSubscribeModal(true)} className="text-[#3b82f6] underline hover:no-underline font-semibold">
                    subscribe
                  </button>
                </span>
              </div>
              <span className="text-xs text-text-secondary">No active membership</span>
            </div>
          )}
        </div>
      )}

      {/* Step 1 — File Upload */}
      {step === 1 && (
        <div
          className={`drop-zone cursor-pointer ${dragging ? "active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-5xl mb-4">🎵</div>
          <p className="text-xl font-bold mb-2">Drop your track here</p>
          <p className="text-text-secondary text-sm mb-4">
            MP3 or WAV &middot; Max 100MB
          </p>
          <button className="bubble-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            📂 Browse Files
          </button>
          <input ref={fileInputRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" className="hidden" onChange={handleFileSelect} />
        </div>
      )}

      {/* Step 2 — Details Form */}
      {step === 2 && (
        <div>
          {/* Selected file summary */}
          <div className="warm-card p-5 mb-8 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6]/20 to-[#60a5fa]/20 flex items-center justify-center text-2xl flex-shrink-0">
              🎵
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{file?.name}</p>
              <p className="text-text-secondary text-sm">{file ? formatSize(file.size) : ""}</p>
            </div>
            {analysisResult && (
              <div className="flex-shrink-0 text-center">
                <div
                  className={`text-lg font-extrabold ${
                    analysisResult.overallScore >= 90 ? "text-green-400" :
                    analysisResult.overallScore >= 70 ? "text-yellow-400" :
                    "text-red-400"
                  }`}
                >
                  {analysisResult.overallScore}%
                </div>
                <div className="text-[10px] text-text-secondary">Quality</div>
              </div>
            )}
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setFile(null); setStep(1); }} className="text-sm text-text-secondary hover:text-[#3b82f6] transition-colors">
                ✕ Change
              </button>
              <button onClick={() => { setFile(null); setStep(1); }} className="text-sm text-text-secondary hover:text-white transition-colors">
                Remove
              </button>
            </div>
          </div>

          {/* Audio Quality Analyzer */}
          {file && (
            <AudioAnalyzer
              key={file.name + file.size}
              file={file}
              genre={subgenre || genre || "Default"}
              onResult={setAnalysisResult}
            />
          )}

          {/* Album Art */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-text-secondary mb-2 block">
              Album Art <span className="font-normal opacity-60">(optional)</span>
            </label>
            <div
              className="drop-zone !py-6 cursor-pointer"
              onClick={() => artInputRef.current?.click()}
            >
              {preview ? (
                <div className="flex items-center justify-center gap-4">
                  <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-xl shadow-lg" />
                  <div className="text-left">
                    <p className="font-semibold">Cover art added</p>
                    <div className="flex gap-3 mt-1">
                      <button onClick={(e) => { e.stopPropagation(); artInputRef.current?.click(); }} className="text-xs text-text-secondary hover:text-[#3b82f6]">
                        Change
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setPreview(null); setAlbumArtBlob(null); }} className="text-xs text-text-secondary hover:text-white">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-3xl">🖼️</span>
                  <p className="text-text-secondary text-sm mt-2">Click to upload cover art (JPEG / PNG)</p>
                </div>
              )}
            </div>
            <input
              ref={artInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleArtSelect}
            />
          </div>

          {/* Form fields */}
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1.5 block">
                Track Title <span className="text-[#3b82f6]">*</span>
              </label>
              <input
                type="text"
                className="warm-input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your track a name..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-text-secondary mb-1.5 block">
                  Genre <span className="text-[#3b82f6]">*</span>
                </label>
                <select
                  className="warm-input w-full"
                  value={genre}
                  onChange={(e) => {
                    setGenre(e.target.value);
                    setSubgenre(""); // reset subgenre when parent changes
                  }}
                >
                  <option value="">Select genre</option>
                  {allGenres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {genre && genreTree[genre] && (
                  <div className="mt-2">
                    <label className="text-xs font-medium text-text-secondary mb-1 block">
                      Subgenre
                    </label>
                    <select
                      className="warm-input w-full"
                      value={subgenre}
                      onChange={(e) => setSubgenre(e.target.value)}
                    >
                      <option value="">None — just {genre}</option>
                      {genreTree[genre].map((sg) => (
                        <option key={sg} value={sg}>{sg}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold text-text-secondary mb-1.5 block">
                  Price (XNT) <span className="text-[#3b82f6]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c084fc] font-bold text-xs">XNT</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="warm-input w-full pl-12"
                    value={price}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Allow empty, digits, single decimal point, and trailing decimal
                      if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
                        setPrice(v);
                      }
                    }}
                    placeholder="10"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-text-secondary mb-1.5 block">
                Description
              </label>
              <textarea
                className="warm-input w-full resize-none"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell fans the story behind this track..."
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 rounded-2xl bg-[rgba(108,140,255,0.08)] border border-[rgba(108,140,255,0.2)] text-[#3b82f6] text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Subscription success toast */}
          {subscriptionSuccess && (
            <div className="mt-4 p-4 rounded-2xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] text-green-400 text-sm flex items-center gap-3 animate-float">
              <span className="text-lg">✅</span>
              <span>{subscriptionSuccess}</span>
            </div>
          )}

          {/* Connected wallet badge + Upload button */}
          <div className="mt-8">
            <div className="warm-card p-4 mb-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
              <span className="text-sm font-mono text-text-secondary">
                Uploading as{" "}
                <span className="text-white font-semibold">
                  {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
                </span>
              </span>
              {memberStatus && !memberStatus.isMember && (
                <span className="text-xs text-[#60a5fa] font-semibold ml-auto">
                  +1.5 XNT fee
                </span>
              )}
            </div>

            <button
              className="bubble-btn w-full text-lg"
              onClick={handleUpload}
              disabled={uploading || !title || !price || !acceptedTos}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 w-full py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{uploadPhase || "Publishing Track..."}</span>
                  </div>
                  <div className="w-full max-w-xs bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {uploadProgress}%
                  </span>
                </div>
              ) : (
                "🚀 Publish Track"
              )}
            </button>
            {/* TOS Disclaimer */}
            <div className="warm-card p-5 mb-6 border border-[rgba(108,140,255,0.15)]">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <span>📋</span> Terms of Service
              </h3>
              <p className="text-text-secondary text-xs leading-relaxed mb-4">
                By publishing music on Blockchain Beats, you confirm that:
              </p>
              <ul className="text-text-secondary text-xs leading-relaxed space-y-2 mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <span>You own all rights to the uploaded content or have obtained proper licensing from the rights holder</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <span>Your content does not infringe on any third-party copyrights, trademarks, or intellectual property</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <span>You are responsible for all applicable royalties, mechanical licenses, and performance fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <span>Blockchain Beats acts as a marketplace only and does not claim ownership of your content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#3b82f6] mt-0.5">•</span>
                  <span>You may remove your content at any time by contacting support</span>
                </li>
              </ul>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTos}
                  onChange={(e) => setAcceptedTos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#3b82f6] rounded cursor-pointer"
                />
                <span className="text-xs text-text-secondary group-hover:text-white transition-colors leading-relaxed">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="text-[#3b82f6] underline hover:no-underline">
                    Terms of Service
                  </a>{" "}
                  and confirm that I have the rights to publish this content
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe / Pay fee modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={() => setShowSubscribeModal(false)}>
          <div className="warm-card p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-extrabold mb-2 text-center">
              Upload <span className="accent-text">Options</span>
            </h2>
            <p className="text-text-secondary text-sm text-center mb-6">
              Pay per upload or subscribe for unlimited access
            </p>

            {/* Pay-per-upload */}
            <div className="warm-card p-5 mb-4 border-[rgba(108,140,255,0.2)] cursor-pointer hover:shadow-[0_0_20px_rgba(108,140,255,0.15)] transition-all"
                 onClick={payUploadFee}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">Pay Per Upload</h3>
                  <p className="text-text-secondary text-sm mt-1">Upload this track now</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold accent-text">1.5 XNT</div>
                </div>
              </div>
              <button className="bubble-btn w-full mt-4" disabled={payingFee}>
                {payingFee ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing Tx...
                  </span>
                ) : (
                  "💳 Pay 1.5 XNT and Upload"
                )}
              </button>
            </div>

            {/* Monthly */}
            <div className="warm-card p-5 mb-4 border border-[rgba(192,132,252,0.2)] bg-gradient-to-br from-[rgba(192,132,252,0.05)] rounded-2xl cursor-pointer hover:shadow-[0_0_20px_rgba(192,132,252,0.15)] transition-all"
                 onClick={() => !subscribing && subscribe("monthly")}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">Monthly <span className="warm-tag text-xs ml-2">Popular</span></h3>
                  <p className="text-text-secondary text-sm mt-1">Unlimited uploads, cancel anytime</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-[#c084fc]">8 XNT</div>
                  <div className="text-xs text-text-secondary">/month</div>
                </div>
              </div>
              <button className="bubble-btn w-full mt-4 bubble-btn-outline"
                      style={{borderColor: "#c084fc", color: "#c084fc"}}
                      disabled={subscribing}>
                {subscribing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#c084fc]/30 border-t-[#c084fc] rounded-full animate-spin" />
                    Signing Tx...
                  </span>
                ) : (
                  "🎫 Subscribe Monthly"
                )}
              </button>
            </div>

            {/* Yearly */}
            <div className="warm-card p-5 border-[rgba(108,140,255,0.2)] cursor-pointer hover:shadow-[0_0_20px rgba(108,140,255,0.15)] transition-all"
                 onClick={() => !subscribing && subscribe("yearly")}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">Yearly <span className="text-xs text-green-400 font-semibold ml-2">Save 33%</span></h3>
                  <p className="text-text-secondary text-sm mt-1">Best value for serious artists</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold accent-text">62 XNT</div>
                  <div className="text-xs text-text-secondary">/year</div>
                </div>
              </div>
              <button className="bubble-btn w-full mt-4" disabled={subscribing}>
                {subscribing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing Tx...
                  </span>
                ) : (
                  "🎫 Subscribe Yearly"
                )}
              </button>
            </div>

            <button onClick={() => setShowSubscribeModal(false)}
                    className="text-text-secondary text-sm hover:text-white mt-4 block mx-auto transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}