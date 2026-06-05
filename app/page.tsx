"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/components/Providers";

/* ── Animated Counter ── */
function Counter({ end, duration = 1500, suffix = "", suffixAfter = false }: { end: number; duration?: number; suffix?: string; suffixAfter?: boolean }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || started.current) return;
    started.current = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = Math.ceil(end / (duration / 16));
          const timer = setInterval(() => {
            start += step;
            if (start >= end) { setVal(end); clearInterval(timer); }
            else setVal(start);
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{suffixAfter ? `${val.toLocaleString()}${suffix}` : `${suffix}${val.toLocaleString()}`}</span>;
}

/* ── Marquee / Partner Carousel ── */
function PartnerMarquee() {
  const partners = ["X1 Network", "Solana VM", "Phantom", "Backpack", "Solflare", "x1.xyz", "Vercel"];
  return (
    <div className="relative overflow-hidden py-10">
      <div className="flex gap-12 animate-marquee whitespace-nowrap">
        {[...partners, ...partners].map((p, i) => (
          <span key={i} className="text-lg font-semibold text-text-muted/40 tracking-widest uppercase">{p}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Section Badge ── */
function Badge({ children }: { children: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(108,140,255,0.08)] border border-blue-500/20 mb-5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400">{children}</span>
    </div>
  );
}

/* ── Feature Card ── */
function FeatureCard({ icon, title, desc, gradient = false }: { icon: string; title: string; desc: string; gradient?: boolean }) {
  return (
    <div className={`rounded-2xl p-6 md:p-7 border transition-all duration-300 group hover:-translate-y-1 ${
      gradient
        ? "bg-gradient-to-br from-[rgba(108,140,255,0.06)] to-transparent border-blue-500/20"
        : "bg-dark-card border-dark-border hover:border-[rgba(108,140,255,0.2)]"
    }`}>
      <div className="w-12 h-12 rounded-xl bg-[rgba(108,140,255,0.1)] flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-base font-bold mb-2">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Content Wrapper ── */
function Content({ children }: { children: React.ReactNode }) {
  return <div className="max-w-5xl mx-auto px-8 md:px-20">{children}</div>;
}

/* ── Wallet Detection ── */
function useDetectedWallet() {
  const [detected, setDetected] = useState<string | null>(null);
  useEffect(() => {
    const w = window as any;
    const checks: [string, () => any][] = [
      ["Phantom", () => w.phantom?.solana],
      ["Backpack", () => w.backpack?.solana],
      ["Solflare", () => w.solflare],
      ["X1 Wallet", () => w.x1wallet || w.x1],
    ];
    for (const [name, getter] of checks) {
      if (getter()) {
        setDetected(name);
        return;
      }
    }
  }, []);
  return detected;
}

/* ── User Hero ── */
function WalletHero({ stats }: { stats: { songs: number; artists: number; volume: number } }) {
  const { connected, publicKey, connect } = useWallet();
  const detectedWallet = useDetectedWallet();

  // Fetch user-specific stats when connected
  const [userStats, setUserStats] = useState<{ tracks: number; earned: number } | null>(null);
  useEffect(() => {
    if (!connected || !publicKey) {
      setUserStats(null);
      return;
    }
    fetch(`/api/songs?artist=${publicKey}`)
      .then(r => r.json())
      .then(d => {
        setUserStats({
          tracks: d.songs?.length || 0,
          earned: d.songs?.reduce((s: number, t: any) => s + (t.price || 0), 0) || 0,
        });
      })
      .catch(() => {});
  }, [connected, publicKey]);

  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center overflow-hidden">
      {/* Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[rgba(108,140,255,0.03)] blur-[100px] pointer-events-none" />

      <Content>
        <div className="text-center">
          {/* Wallet Status */}
          {connected && publicKey ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 mb-5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Connected — {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
              </span>
            </div>
          ) : detectedWallet ? (
            <button onClick={connect} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(108,140,255,0.2)] bg-[rgba(108,140,255,0.08)] hover:bg-[rgba(108,140,255,0.15)] transition-colors mb-5 cursor-pointer">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                {detectedWallet} Detected — Connect
              </span>
            </button>
          ) : null}

          <Badge>Now Live on X1 Network</Badge>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 leading-[1.05] tracking-tight">
            Your Music,<br />
            <span className="bg-gradient-to-r from-[#3b82f6] via-[#60a5fa] to-[#2563eb] bg-clip-text text-transparent">Direct to Fans</span>
          </h1>
          <p className="text-text-secondary text-lg md:text-xl mb-10 leading-relaxed">
            {connected && publicKey && userStats ? (
              <>You&apos;ve uploaded <strong className="text-white">{userStats.tracks}</strong> track{userStats.tracks !== 1 ? "s" : ""} worth <strong className="text-white">{userStats.earned} XNT</strong>. Ready to drop another?</>
            ) : (
              <>Upload your tracks, sell them in <strong className="text-white">XNT</strong>, and earn <strong className="text-white">80%</strong> of every sale — no middlemen, instant settlements on X1 Network.</>
            )}</p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/browse" className="bubble-btn bubble-btn-lg">🎧 Browse Music</Link>
            <Link href="/upload" className="bubble-btn bubble-btn-lg bubble-btn-outline">🚀 Start Uploading</Link>
          </div>

          {/* Platform Stats — always visible */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-16">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white"><Counter key={stats.songs} end={stats.songs} /></div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Songs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white"><Counter key={stats.artists} end={stats.artists} /></div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Artists</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white"><Counter key={stats.volume} end={stats.volume} suffix=" XNT" suffixAfter /></div>
              <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Volume</div>
            </div>
          </div>
        </div>
      </Content>
    </section>
  );
}

/* ── How It Works Section ── */
function HowItWorksSection() {
  return (
    <section className="py-24 md:py-32 relative">
      <Content>
        <div className="text-center mb-16">
          <Badge>Simple Process</Badge>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">How It <span className="accent-text">Works</span></h2>
          <p className="text-text-secondary text-base">Three simple steps to start earning from your music</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Connect Wallet", desc: "Use Phantom, Backpack, or Solflare to connect to X1 Network. No email or password needed." },
            { step: "02", title: "Upload & Price", desc: "Drop your MP3 or WAV, pick a genre, set your price in XNT. Subscribers upload unlimited." },
            { step: "03", title: "Earn 80%", desc: "Every sale sends 80% straight to your wallet — no holds, no approvals, no delays." },
          ].map((s, i) => (
            <div key={i} className="step-card relative text-center">
              <div className="step-number">{s.step}</div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Content>
    </section>
  );
}

/* ── Features Section ── */
function FeaturesSection() {
  return (
    <section className="py-24 md:py-32 section-gradient border-t border-dark-border relative">
      <Content>
        <div className="text-center mb-16">
          <Badge>Platform Features</Badge>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Built for <span className="accent-text">Artists</span></h2>
          <p className="text-text-secondary text-base">Everything you need to distribute and monetize your music on-chain</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon="🎵" title="Upload Any Track" desc="MP3 and WAV support. Unlimited uploads for subscribers. Cover art upload included." gradient />
          <FeatureCard icon="💰" title="80% Revenue Share" desc="The highest payout in music. No record labels taking cuts. You keep what you earn." />
          <FeatureCard icon="⚡" title="Instant Settlement" desc="Sales settle instantly on X1 Network. No waiting periods, no withdrawal limits." />
          <FeatureCard icon="🛡️" title="Copyright Protection" desc="Intrinsic copyright detection via spectral fingerprinting." />
          <FeatureCard icon="📊" title="Artist Dashboard" desc="Track your sales, uploads, and revenue in real-time." />
          <FeatureCard icon="🔗" title="Wallet-Driven" desc="Your wallet is your identity. No signups, no emails." gradient />
        </div>
      </Content>
    </section>
  );
}

/* ── Trust Section ── */
function TrustSection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <Content>
        <div className="text-center mb-16">
          <Badge>Ecosystem</Badge>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Powered by <span className="accent-text">X1</span></h2>
          <p className="text-text-secondary text-base">Built on the fastest SVM Layer-1 blockchain for real-time micropayments</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 md:p-8 border border-dark-border bg-dark-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[rgba(108,140,255,0.1)] flex items-center justify-center text-lg">⚡</div>
              <div>
                <div className="text-sm font-bold">X1 Blockchain</div>
                <div className="text-xs text-text-muted">Layer-1 SVM</div>
              </div>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">Sub-second finality, near-zero fees, and Solana VM compatibility. Every track purchase settles in seconds for fractions of a cent.</p>
          </div>
          <div className="rounded-2xl p-6 md:p-8 border border-dark-border bg-dark-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[rgba(108,140,255,0.1)] flex items-center justify-center text-lg">🔐</div>
              <div>
                <div className="text-sm font-bold">Self-Custody</div>
                <div className="text-xs text-text-muted">Your Keys, Your Music</div>
              </div>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">Funds go directly to your wallet. No platform holds your balance. Full control, full transparency, full ownership.</p>
          </div>
        </div>

        <PartnerMarquee />
      </Content>
    </section>
  );
}

/* ── Final CTA ── */
function CTASection() {
  return (
    <section className="py-24 md:py-32 text-center relative border-t border-dark-border">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[rgba(108,140,255,0.04)] blur-[100px] pointer-events-none" />

      <Content>
        <Badge>Get Started</Badge>
        <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
          Ready to <span className="accent-text">Drop Your Track</span>?
        </h2>
        <p className="text-text-secondary mb-10 max-w-md mx-auto">
          No record labels. No gatekeepers. Just you, your music, and your fans.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/upload" className="bubble-btn bubble-btn-lg">🎤 Start Uploading</Link>
          <Link href="/browse" className="bubble-btn bubble-btn-lg bubble-btn-outline">🎧 Browse Music</Link>
        </div>
      </Content>
    </section>
  );
}

/* ════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════ */
export default function HomePage() {
  const [stats, setStats] = useState({ songs: 0, artists: 0, volume: 0 });

  useEffect(() => {
    fetch("/api/landing-stats")
      .then((r) => r.json())
      .then((d) => setStats({ songs: d.songs || 0, artists: d.artists || 0, volume: d.volume || 0 }))
      .catch(() => {});
  }, []);

  return (
    <div className="overflow-hidden">
      <WalletHero stats={stats} />
      <HowItWorksSection />
      <FeaturesSection />
      <TrustSection />
      <CTASection />
      <div className="accent-bar" />
    </div>
  );
}