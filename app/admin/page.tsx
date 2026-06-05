"use client";
import { useWallet } from "@/components/Providers";



export default function AdminPage() {
  const { connected } = useWallet();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Admin / Treasury</h1>
      <p className="text-text-secondary mb-8">Multi-sig treasury management</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="music-card p-6">
          <h3 className="font-semibold mb-4">Treasury Balance</h3>
          <div className="text-3xl font-bold neon-text">0 XNT</div>
          <p className="text-text-secondary text-sm mt-1">Platform 20% cut + label fees</p>
        </div>
        <div className="music-card p-6">
          <h3 className="font-semibold mb-4">Multi-Sig Status</h3>
          <div className="text-sm text-text-secondary">
            <p>Type: 2-of-N</p>
            <p className="mt-1">Pending approvals: 0</p>
          </div>
        </div>
      </div>

      <div className="music-card p-6">
        <h3 className="font-semibold mb-4">Platform Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: "Total Songs", value: "0" },
            { label: "Total Artists", value: "0" },
            { label: "Total Labels", value: "0" },
            { label: "Total Volume", value: "0 XNT" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold neon-text">{stat.value}</div>
              <div className="text-text-secondary text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}