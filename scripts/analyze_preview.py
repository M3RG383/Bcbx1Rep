#!/usr/bin/env python3
"""
Preview Analyzer & Generator — finds the loudest section of a track,
generates a small MP3 clip for instant playback, and optionally uploads
it to Vercel Blob.

Usage (analyze only):
    python3 scripts/analyze_preview.py <url_or_filepath>

Usage (analyze + generate):
    python3 scripts/analyze_preview.py <url_or_filepath> --generate --output-dir ./public/previews

Output:
    JSON with previewStart, previewDuration, duration, method
    If --generate: also previewFile, previewSize, previewUrl
"""

import argparse
import json
import sys
import tempfile
import urllib.request
import urllib.parse
import os
import subprocess
import numpy as np

def download_audio(url: str) -> str:
    """Download audio from URL to a temp file. Returns local path."""
    if os.path.isfile(url):
        return url
    suffix = url.rsplit(".", 1)[-1] if "." in url else "mp3"
    tmp = tempfile.NamedTemporaryFile(suffix=f".{suffix}", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        urllib.request.urlretrieve(url, tmp_path)
        return tmp_path
    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise RuntimeError(f"Download failed: {e}")


def find_loudest_window(
    audio_path: str,
    preview_duration: float = 15.0,
    margin: float = 5.0,
    energy_window: float = 0.25,
) -> dict:
    """Find the window of preview_duration seconds with highest RMS energy."""
    import librosa

    print(f"Loading: {audio_path}", file=sys.stderr)
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    duration = float(len(y)) / sr
    print(f"Duration: {duration:.1f}s, Sample rate: {sr} Hz", file=sys.stderr)

    if duration <= preview_duration + 2 * margin:
        start = min(margin, max(0, (duration - preview_duration) / 2))
        return {
            "previewStart": round(start, 1),
            "previewDuration": preview_duration,
            "duration": round(duration, 1),
            "method": "short_track",
        }

    hop_length = int(sr * energy_window)
    frame_length = hop_length * 2

    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)

    margin_frames = int(margin / energy_window)
    preview_frames = int(preview_duration / energy_window)

    if margin_frames + preview_frames >= len(rms):
        start_frame = max(0, (len(rms) - preview_frames) // 2)
        return {
            "previewStart": round(float(times[start_frame]), 1),
            "previewDuration": preview_duration,
            "duration": round(duration, 1),
            "method": "middle_fallback",
        }

    search_start = margin_frames
    search_end = len(rms) - preview_frames - margin_frames

    best_start = search_start
    best_energy = -np.inf
    for i in range(search_start, search_end + 1):
        window_energy = np.sum(rms[i : i + preview_frames])
        if window_energy > best_energy:
            best_energy = window_energy
            best_start = i

    preview_start_s = float(times[best_start])

    try:
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
        weighted = rms[best_start : best_start + preview_frames] * \
                   (1.0 + spectral_centroids[best_start : best_start + preview_frames] / (sr / 4))
        refined_start = np.argmax(weighted)
        preview_start_s = float(times[best_start + refined_start])
        method = "energy_spectral_peak"
    except Exception:
        method = "energy_peak"

    max_start = duration - preview_duration
    preview_start_s = min(preview_start_s, max_start)
    preview_start_s = max(preview_start_s, 0)

    print(f"Best: {preview_start_s:.1f}s (method: {method})", file=sys.stderr)

    return {
        "previewStart": round(preview_start_s, 1),
        "previewDuration": preview_duration,
        "duration": round(duration, 1),
        "method": method,
    }


def generate_preview(source_path: str, start_sec: float, duration: float, output_path: str):
    """Extract section and encode as 128kbps MP3 via ffmpeg."""
    print(f"Encoding {start_sec}s +{duration}s → {output_path}", file=sys.stderr)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", source_path,
        "-t", str(duration),
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        "-ar", "44100",
        "-ac", "2",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg: {result.stderr[:500]}")
    size = os.path.getsize(output_path)
    print(f"Preview: {size / 1024:.1f} KB", file=sys.stderr)
    return size


def upload_to_blob(local_path: str, song_id: str, blob_token: str) -> str:
    """
    Upload a preview file to Vercel Blob using their REST API.
    Returns the public blob URL.
    """
    import http.client
    
    filename = f"preview_{song_id}.mp3"
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    
    with open(local_path, "rb") as f:
        file_data = f.read()
    
    # Build multipart body manually
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: audio/mpeg\r\n\r\n"
    ).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")
    
    url = "https://blob.vercel-storage.com/upload"
    
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {blob_token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
            return result.get("url", "")
    except Exception as e:
        print(f"Blob upload failed: {e}", file=sys.stderr)
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Find loudest preview window + optionally generate clip"
    )
    parser.add_argument("source", help="URL or local file path to audio")
    parser.add_argument("--preview-duration", type=float, default=15.0)
    parser.add_argument("--margin", type=float, default=5.0)
    parser.add_argument("--generate", action="store_true",
                        help="Generate preview MP3")
    parser.add_argument("--output-dir", default=".",
                        help="Directory for preview output")
    parser.add_argument("--song-id", help="Song ID for naming/upload")
    parser.add_argument("--upload", action="store_true",
                        help="Upload preview to Vercel Blob")
    parser.add_argument("--blob-token", help="Vercel Blob token")
    args = parser.parse_args()

    local_path = download_audio(args.source)
    
    try:
        result = find_loudest_window(
            local_path,
            preview_duration=args.preview_duration,
            margin=args.margin,
        )

        if args.generate:
            song_id = args.song_id or os.path.splitext(
                os.path.basename(args.source))[0]
            
            preview_filename = f"preview_{song_id}.mp3"
            preview_path = os.path.join(args.output_dir, preview_filename)
            
            file_size = generate_preview(
                local_path,
                result["previewStart"],
                result["previewDuration"],
                preview_path
            )
            
            result["previewFile"] = preview_filename
            result["previewSize"] = file_size
            
            if args.upload:
                if not args.blob_token:
                    print(json.dumps({"error": "No blob token provided"}))
                    sys.exit(1)
                blob_url = upload_to_blob(preview_path, song_id, args.blob_token)
                result["previewUrl"] = blob_url
                print(f"Blob URL: {blob_url}", file=sys.stderr)
                
                # Clean up local preview file after upload
                if os.path.exists(preview_path):
                    os.unlink(preview_path)
                    result["previewFile"] = None

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
    finally:
        if local_path != args.source and os.path.exists(local_path):
            os.unlink(local_path)


if __name__ == "__main__":
    main()