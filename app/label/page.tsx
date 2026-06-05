"use client";
import { useWallet } from "@/components/Providers";

export default function LabelPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Labels</h1>
      <div className="music-card p-8 text-center text-text-secondary">
        <p className="text-lg mb-2">No labels registered yet</p>
        <p>Label owners can register and manage their brand page</p>
      </div>
    </div>
  );
}
