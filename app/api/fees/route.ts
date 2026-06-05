import { NextResponse } from "next/server";
import { UPLOAD_FEE_XNT, MONTHLY_SUB_XNT, YEARLY_SUB_XNT } from "@/lib/x1";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    uploadFee: UPLOAD_FEE_XNT,
    monthlySub: MONTHLY_SUB_XNT,
    yearlySub: YEARLY_SUB_XNT,
    currency: "XNT",
    treasury: "8fBujtC8EzsBpvp1fNrZBoPPLq1D7FQ6tPQ9ZXaQBeSx",
  });
}