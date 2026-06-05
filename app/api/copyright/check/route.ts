import { NextRequest, NextResponse } from "next/server";
import { scanFileBuffer } from "@/lib/copyright";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await scanFileBuffer(buffer);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Copyright check error:", err);
    const message = err instanceof Error ? err.message : "Internal server error during copyright check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
