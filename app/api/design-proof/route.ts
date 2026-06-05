import { NextRequest, NextResponse } from "next/server";

const DATA_API = "https://jack0.x1.xyz:8800/api/data";

export async function GET() {
  try {
    const res = await fetch(`${DATA_API}/get?key=design:proof`);
    const data = await res.json();
    const raw = data?.result;
    const proof = raw ? JSON.parse(raw) : null;
    return NextResponse.json({ proof });
  } catch {
    return NextResponse.json({ proof: null });
  }
}