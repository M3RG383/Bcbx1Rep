import { NextRequest, NextResponse } from "next/server";
import { kvHgetall } from "@/lib/db";

export const runtime = "nodejs";

export interface SongDetailResponse {
  id: string;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  price: number;
  description: string;
  blobUrl: string;
  albumArtUrl: string | null;
  fileSize: number;
  hash: string;
  filename: string;
  originalFilename?: string;
  isMemberUpload: boolean;
  createdAt: string;
  previewStart?: number;
  previewDuration?: number;
  previewUrl?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await kvHgetall<Record<string, unknown>>(`songs:${id}`);

    if (!data) {
      return NextResponse.json(
        { error: "Song not found" },
        { status: 404 }
      );
    }

    const song: SongDetailResponse = {
      id: String(data.id || id),
      title: String(data.title || ""),
      artist: String(data.artist || ""),
      artistAddress: String(data.artistAddress || data.artist || ""),
      genre: String(data.genre || ""),
      price: parseFloat(String(data.price || "0")),
      description: String(data.description || ""),
      blobUrl: String(data.blobUrl || ""),
      albumArtUrl: data.albumArtUrl ? String(data.albumArtUrl) : null,
      fileSize: parseInt(String(data.fileSize || "0"), 10),
      hash: String(data.hash || ""),
      filename: String(data.filename || ""),
      originalFilename: data.originalFilename ? String(data.originalFilename) : undefined,
      isMemberUpload: data.isMemberUpload === true || data.isMemberUpload === "true",
      createdAt: String(data.createdAt || ""),
      previewStart: data.previewStart !== undefined ? Number(data.previewStart) : undefined,
      previewDuration: data.previewDuration !== undefined ? Number(data.previewDuration) : undefined,
      previewUrl: data.previewUrl ? String(data.previewUrl) : undefined,
    };

    return NextResponse.json({ song });
  } catch (err) {
    console.error("Song detail API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch song" },
      { status: 500 }
    );
  }
}
