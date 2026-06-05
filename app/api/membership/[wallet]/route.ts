import { NextRequest, NextResponse } from "next/server";
import { UPLOAD_FEE_XNT, MONTHLY_SUB_XNT, YEARLY_SUB_XNT } from "@/lib/x1";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ wallet: string }> }) {
  try {
    const { wallet } = await params;

    // Membership is stored client-side in localStorage + on-chain tx sig.
    // Server always returns base state — real auth happens on client.
    return NextResponse.json({
      isMember: false,
      uploadFee: UPLOAD_FEE_XNT,
      currency: "XNT",
      treasury: "8fBujtC8EzsBpvp1fNrZBoPPLq1D7FQ6tPQ9ZXaQBeSx",
      subscribeMonthly: MONTHLY_SUB_XNT,
      subscribeYearly: YEARLY_SUB_XNT,
    });
  } catch (err) {
    console.error("Membership check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}