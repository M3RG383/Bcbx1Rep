import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    platform: "Blockchain Beats",
    version: "2.0.0",
    stack: "Vercel Serverless",
    features: {
      blob: true,
      kv: true,
      copyrightScan: true,
      memberships: true,
    },
    pricing: {
      uploadFee: 0.99,
      monthlySub: 4.99,
      yearlySub: 39.99,
      currency: "XNT",
    },
  });
}