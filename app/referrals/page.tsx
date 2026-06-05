"use client";
import { useWallet } from "@/components/Providers";

export default function ReferralsPage() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      <h1 className="text-3xl font-bold mb-2">Referral Dashboard</h1>
      <p className="text-text-secondary mb-8">Earn bonuses by referring new fans</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="music-card p-6">
          <div className="text-text-secondary text-sm mb-1">Total Referred</div>
          <div className="text-3xl font-bold neon-text">0</div>
        </div>
        <div className="music-card p-6">
          <div className="text-text-secondary text-sm mb-1">Bonuses Earned</div>
          <div className="text-3xl font-bold neon-text">0 XNT</div>
        </div>
        <div className="music-card p-6">
          <div className="text-text-secondary text-sm mb-1">Claimable</div>
          <div className="text-3xl font-bold neon-text">0 XNT</div>
        </div>
      </div>

      <div className="music-card p-6 mb-8">
        <h3 className="font-semibold mb-2">Your Referral Link</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={`${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${publicKey?.slice(0, 8) || ""}`}
            className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white font-mono text-sm"
            readOnly
          />
          <button className="btn-secondary text-sm" onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/?ref=${publicKey?.slice(0, 8) || ""}`);
          }}>
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}