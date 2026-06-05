"use client";

import { useEffect } from "react";

/**
 * Polyfills needed by Solana wallet adapter libraries in the browser.
 * Turbopack/Next.js 16 doesn't ship Buffer/process globals.
 */
export default function WalletPolyfill() {
  useEffect(() => {
    // Buffer polyfill
    if (typeof window !== "undefined" && !(window as any).Buffer) {
      const { Buffer } = require("buffer");
      (window as any).Buffer = Buffer;
    }

    // process polyfill
    if (typeof window !== "undefined" && !(window as any).process) {
      (window as any).process = { env: {} };
    }
  }, []);

  return null;
}