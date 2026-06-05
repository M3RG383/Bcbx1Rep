import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Fetches the WXNT/USDC.X price from x1.ninja API.
 * Returns { xntToUsd: number, timestamp: string }
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.X1_NINJA_KEY;

  if (!apiKey) {
    return NextResponse.json({
      xntToUsd: 0.5877,
      cached: false,
      error: "No API key configured",
    });
  }

  try {
    // Fetch all pools — find the WXNT/USDC.X pool
    const res = await fetch(
      "https://api.x1.ninja/v1/pools?limit=50&sortBy=liquidity&order=desc",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        next: { revalidate: 60 }, // cache for 60s
      }
    );

    if (!res.ok) {
      console.error("x1.ninja API error:", res.status);
      return NextResponse.json({
        xntToUsd: 0.5877,
        cached: false,
        error: `API returned ${res.status}`,
      });
    }

    const data = await res.json();
    const pools = data.pools || [];

    // Find the XNT/USDC.X pool
    let xntPrice = 0.583;

    for (const pool of pools) {
      const base = pool.baseToken?.symbol || "";
      const quote = pool.quoteToken?.symbol || "";

      // XNT/USDC.X ($34K liquidity)
      if (base === "XNT" && quote === "USDC.X") {
        xntPrice = parseFloat(pool.priceUsd) || xntPrice;
        break;
      }
    }

    return NextResponse.json({
      xntToUsd: xntPrice,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Price fetch error:", err);
    return NextResponse.json({
      xntToUsd: 0.5877,
      cached: false,
      error: "Failed to fetch price",
    });
  }
}