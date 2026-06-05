import { NextRequest, NextResponse } from "next/server";
import { MONTHLY_SUB_XNT, YEARLY_SUB_XNT } from "@/lib/x1";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, plan, txSignature } = body;

    if (!wallet || !plan || !txSignature) {
      return NextResponse.json({ error: "wallet, plan, and txSignature required" }, { status: 400 });
    }

    if (!["monthly", "yearly"].includes(plan)) {
      return NextResponse.json({ error: "Plan must be 'monthly' or 'yearly'" }, { status: 400 });
    }

    const price = plan === "monthly" ? MONTHLY_SUB_XNT : YEARLY_SUB_XNT;
    const durationMs = plan === "monthly" ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;
    const expires = Date.now() + durationMs;

    // The tx was already confirmed client-side on X1 mainnet.
    // The tx signature is the source of truth — verifiable on explorer.
    // Server returns success immediately; client caches in localStorage.

    return NextResponse.json({
      success: true,
      wallet,
      plan,
      price,
      currency: "XNT",
      expires: new Date(expires).toISOString(),
      expiresInDays: Math.round(durationMs / (24 * 60 * 60 * 1000)),
      unlimitedUploads: true,
    });
  } catch (err) {
    console.error("Membership register error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}