"use client";

import { useEffect, useState, useRef } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("bb_theme") as "dark" | "light") || "dark";
    setTheme(stored);
    document.documentElement.classList.toggle("light-mode", stored === "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("bb_theme", next);
    document.documentElement.classList.toggle("light-mode", next === "light");
    window.dispatchEvent(new CustomEvent("bb:settingsChanged", { detail: { theme: next } }));
  };

  return { theme, toggleTheme };
}

export function useWalletTimeout() {
  const [timeout, setTimeout_] = useState<number>(15);

  useEffect(() => {
    const stored = parseInt(localStorage.getItem("bb_wallet_timeout") || "15");
    setTimeout_(stored);
  }, []);

  const setWalletTimeout = (val: number) => {
    setTimeout_(val);
    localStorage.setItem("bb_wallet_timeout", String(val));
    window.dispatchEvent(new CustomEvent("bb:settingsChanged", { detail: { walletTimeout: val } }));
  };

  return { timeout, setWalletTimeout };
}

export default function SiteSettingsDropdown() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { timeout, setWalletTimeout } = useWalletTimeout();
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-text-secondary hover:text-text-primary transition-colors text-lg p-1"
        title="Settings"
        aria-label="Settings"
      >
        ⚙️
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 card p-4 shadow-xl z-50">
          <div className="space-y-4">
            {/* Theme Toggle */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Display</h4>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-dark-border hover:border-dark-border-hover transition-all"
              >
                <span className="text-sm text-text-primary">Theme</span>
                <span className="text-sm font-medium">
                  {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
                </span>
              </button>
            </div>

            {/* Wallet Timeout */}
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Wallet Timeout</h4>
              <div className="flex gap-2">
                {[5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    onClick={() => setWalletTimeout(m)}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      timeout === m
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-dark-border text-text-secondary hover:border-dark-border-hover"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}