import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Returns the live XNT→USD price.
 *
 * Queries the XNT/USDC.X pool on X1 by exact pool address via the x1.ninja API.
 * Falls back to a reasonable estimate if the API call fails.
 */

// Exact XNT/USDC.X pool address on X1
const XNT_USDC_POOL = "CAJeVEoSm1QQZccnCqYu9cnNF7TTD2fcUA3E5HQoxRvR";

export async function GET() {
  const apiKey = process.env.X1_NINJA_KEY;

  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.x1.ninja/v1/pools?address=${XNT_USDC_POOL}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          next: { revalidate: 30 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        // Find the exact pool in the results
        const pool = (data.pools || []).find(
          (p: { address: string }) => p.address === XNT_USDC_POOL
        );
        if (pool?.priceUsd) {
          return NextResponse.json({
            xntToUsd: parseFloat(pool.priceUsd),
            source: "x1ninja",
            cached: true,
            poolAddress: XNT_USDC_POOL,
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
    xntToUsd: 0.45,
    source: "fallback",
    cached: false,
    timestamp: new Date().toISOString(),
  });
}
