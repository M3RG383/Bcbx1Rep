import { NextRequest, NextResponse } from "next/server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { verifyXntTransferTo, MONTHLY_SUB_LAMPORTS, YEARLY_SUB_LAMPORTS, TREASURY_ADDRESS } from "@/lib/x1";
import { kvHset } from "@/lib/db";

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

    const expectedLamports = plan === "monthly" ? MONTHLY_SUB_LAMPORTS : YEARLY_SUB_LAMPORTS;
    const durationMs = plan === "monthly" ? 30 * 24 * 60 * 60 * 1000 : 365 * 24 * 60 * 60 * 1000;

    // Verify the tx on-chain: sent from wallet to TREASURY_ADDRESS with the correct amount
    const verification = await verifyXntTransferTo(
      txSignature,
      expectedLamports,
      wallet,
      TREASURY_ADDRESS
    );

    if (!verification.verified) {
      return NextResponse.json(
        { error: verification.message, verified: false },
        { status: 400 }
      );
    }

    const expires = Date.now() + durationMs;

    // Persist membership in KV store
    await kvHset(`member:${wallet}`, {
      plan,
      expires,
      txSignature,
    });

    return NextResponse.json({
      success: true,
      isMember: true,
      wallet,
      plan,
      price: expectedLamports / LAMPORTS_PER_SOL,
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