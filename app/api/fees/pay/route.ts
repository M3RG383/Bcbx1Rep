import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/db";
import { UPLOAD_FEE_XNT, UPLOAD_FEE_LAMPORTS, verifyXntTransfer } from "@/lib/x1";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, txSignature } = body;

    if (!wallet || !txSignature) {
      return NextResponse.json({ error: "wallet and txSignature required" }, { status: 400 });
    }

    // Verify the transaction on X1 mainnet
    const verification = await verifyXntTransfer(txSignature, UPLOAD_FEE_LAMPORTS, wallet);

    const feeReceipt = {
      wallet,
      amount: UPLOAD_FEE_XNT,
      currency: "XNT",
      txSignature,
      timestamp: Date.now(),
      verified: verification.verified,
      verificationMessage: verification.message,
    };

    const existingLedger = (await kvGet<string>("fee:ledger")) || "[]";
    const ledger = JSON.parse(existingLedger) as unknown[];
    ledger.push(feeReceipt);
    await kvSet("fee:ledger", JSON.stringify(ledger));

    if (!verification.verified) {
      return NextResponse.json({
        success: false,
        receipt: feeReceipt,
        message: `Payment recorded but on-chain verification failed: ${verification.message}`,
      }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      receipt: feeReceipt,
      message: `${UPLOAD_FEE_XNT} XNT fee verified on-chain`,
    });
  } catch (err) {
    console.error("Fee pay error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}