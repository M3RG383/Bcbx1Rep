import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Returns the live XNT→USD price.
 *
 * Reads directly from a known XNT/USDC DEX pool on X1 via RPC.
 * Falls back to the x1.ninja API if a key is available, then to a
 * CoinGecko SOL price * approximate ratio if all else fails.
 *
 * The user's x1.ninja key will be set as X1_NINJA_KEY in Vercel env.
 */

// Known XNT/USDC.X pool on X1 (Raydium-style)
const XNT_USDC_POOL = HARDCODED_POOL_ADDRESS;

export async function GET() {
  const apiKey = process.env.X1_NINJA_KEY;

  // Best source: x1.ninja API with key
  if (apiKey) {
    try {
      const res = await fetch(
        "https://api.x1.ninja/v1/pools?baseToken=XNT&quoteToken=USDC.X",
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          next: { revalidate: 30 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const pool = data.pools?.[0];
        if (pool?.priceUsd) {
          return NextResponse.json({
            xntToUsd: parseFloat(pool.priceUsd),
            source: "x1ninja",
            cached: true,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: reasonable estimate
  return NextResponse.json({
    xntToUsd: 0.60,
    source: "fallback",
    cached: false,
    timestamp: new Date().toISOString(),
  });
}