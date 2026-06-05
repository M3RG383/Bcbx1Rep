"use client";

import { useWallet } from "@/components/Providers";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteSettingsDropdown from "@/components/SiteSettings";

function NavLinks() {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="hidden md:flex items-center gap-5">
      <Link href="/browse" className="bubble-btn bubble-btn-sm">
        Browse
      </Link>
      {mounted && connected && (
        <>
          <Link href="/my-purchases" className="text-text-secondary hover:text-[#3b82f6] transition-colors font-medium">
            My Purchases
          </Link>
          <Link href="/dashboard" className="text-text-secondary hover:text-[#3b82f6] transition-colors font-medium">
            Dashboard
          </Link>
          <Link href="/upload" className="bubble-btn bubble-btn-sm !py-2 !px-5">
            Upload
          </Link>
        </>
      )}
    </div>
  );
}

function ConnectedBadge({ publicKey }: { publicKey: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)]">
      <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
      <span className="text-xs font-mono text-white font-semibold">
        {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
      </span>
    </div>
  );
}

export default function Navbar() {
  const { connected, publicKey, connect, disconnect } = useWallet();

  return (
    <nav className="border-b border-dark-border bg-dark-card/90 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-20 flex items-center">
        {/* Logo — centered, takes ~75% of header */}
        <div className="flex-1 flex justify-start">
          <NavLinks />
        </div>

        <Link href="/" className="flex items-center justify-center shrink-0">
          <img
            src="/brand/bb-logo.jpg"
            alt="Blockchain Beats"
            className="h-[55px] w-auto object-contain"
          />
        </Link>

        <div className="flex-1 flex justify-end items-center gap-3">
          {connected && publicKey ? (
            <>
              <ConnectedBadge publicKey={publicKey} />
              <SiteSettingsDropdown />
              <button onClick={disconnect} className="text-xs text-text-secondary hover:text-[#3b82f6] transition-colors">
                ✕
              </button>
            </>
          ) : (
            <button onClick={connect} className="bubble-btn bubble-btn-sm animate-pulse-glow">
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}