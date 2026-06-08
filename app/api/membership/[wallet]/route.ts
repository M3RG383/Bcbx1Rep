import { NextRequest, NextResponse } from "next/server";
import { UPLOAD_FEE_XNT, MONTHLY_SUB_XNT, YEARLY_SUB_XNT } from "@/lib/x1";
import { kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ wallet: string }> }) {
  try {
    const { wallet } = await params;

    // Look up membership from KV store
    const membership = await kvHgetall<Record<string, unknown>>(`member:${wallet}`);

    if (membership) {
      const expires = Number(membership.expires);
      const plan = String(membership.plan || "monthly");

      // Check if membership is still valid
      if (expires > Date.now()) {
        return NextResponse.json({
          isMember: true,
          plan,
          expires: new Date(expires).toISOString(),
          expiresInDays: Math.round((expires - Date.now()) / (24 * 60 * 60 * 1000)),
          unlimitedUploads: true,
          uploadFee: 0,
          currency: "XNT",
          treasury: "ApJ8Xnp8sFutG4i3pnsfe2C7LxArGJCzeUQpaBdvxhA7",
          subscribeMonthly: MONTHLY_SUB_XNT,
          subscribeYearly: YEARLY_SUB_XNT,
        });
      }
    }

    // No active membership — return base state
    return NextResponse.json({
      isMember: false,
      uploadFee: UPLOAD_FEE_XNT,
      currency: "XNT",
      treasury: "ApJ8Xnp8sFutG4i3pnsfe2C7LxArGJCzeUQpaBdvxhA7",
      subscribeMonthly: MONTHLY_SUB_XNT,
      subscribeYearly: YEARLY_SUB_XNT,
    });
  } catch (err) {
    console.error("Membership check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}