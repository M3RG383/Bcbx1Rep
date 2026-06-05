"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [timeoutVal, setTimeoutVal] = useState<number>(15);

  // On mount, read stored settings
  useEffect(() => {
    const storedTheme = (localStorage.getItem("bb_theme") as "dark" | "light") || "dark";
    const storedTimeout = parseInt(localStorage.getItem("bb_wallet_timeout") || "15");
    setTheme(storedTheme);
    setTimeoutVal(storedTimeout);
    document.documentElement.classList.toggle("light-mode", storedTheme === "light");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("bb_theme", newTheme);
    document.documentElement.classList.toggle("light-mode", newTheme === "light");
    window.dispatchEvent(new CustomEvent("bb:settingsChanged", { detail: { theme: newTheme } }));
  };

  const handleTimeoutChange = (val: number) => {
    setTimeoutVal(val);
    localStorage.setItem("bb_wallet_timeout", String(val));
    window.dispatchEvent(new CustomEvent("bb:settingsChanged", { detail: { walletTimeout: val } }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/browse" className="text-sm text-text-secondary hover:text-accent transition-colors">
          ← Back to Browse
        </Link>
      </div>

      <h1 className="text-2xl md:text-3xl font-extrabold mb-8">
        Site <span className="text-accent">Settings</span>
      </h1>

      {/* Theme */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">Display</h2>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Theme</span>
          <button
            onClick={toggleTheme}
            className="px-5 py-2 rounded-lg border border-dark-border hover:border-dark-border-hover text-sm font-medium transition-all"
          >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>
        </div>
      </div>

      {/* Wallet Timeout */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4">Wallet</h2>
        <div>
          <span className="text-text-secondary block mb-3">Auto-disconnect after inactivity</span>
          <div className="flex gap-3">
            {[5, 10, 15, 30].map((m) => (
              <button
                key={m}
                onClick={() => handleTimeoutChange(m)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  timeoutVal === m
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-dark-border text-text-secondary hover:border-dark-border-hover"
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-3">
            Settings are saved automatically and apply immediately.
          </p>
        </div>
      </div>
    </div>
  );
}