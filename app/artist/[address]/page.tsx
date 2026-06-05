"use client";
import { useWallet } from "@/components/Providers";
import { useParams } from "next/navigation";

export default function ArtistPage() {
  const params = useParams();
  const { connected } = useWallet();
  const address = typeof params?.address === "string" ? params.address : "";

  if (!address) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-text-secondary">Invalid artist address</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Artist Header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center text-3xl">
          🎤
        </div>
        <div>
          <h1 className="text-3xl font-bold">Artist Profile</h1>
          <p className="text-text-secondary font-mono text-sm mt-1">{address.slice(0, 12)}...</p>
          <div className="flex gap-4 mt-2 text-sm text-text-secondary">
            <span>0 songs</span>
            <span>0 total sales</span>
          </div>
        </div>
      </div>

      {/* Songs */}
      <h2 className="text-xl font-bold mb-4">Songs</h2>
      <div className="music-card p-8 text-center text-text-secondary">
        <p>No songs released yet</p>
      </div>
    </div>
  );
}