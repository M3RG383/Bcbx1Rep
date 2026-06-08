"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeAudioFile } from "@/lib/audio-analyzer";
import type { AnalysisResult, DashboardData } from "@/lib/audio-analyzer";

interface Props {
  file: File;
  genre: string;
  onResult?: (r: AnalysisResult) => void;
  songId?: string;
}

// ─── Canvas helpers ─────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, rows: number, cols: number) {
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= rows; r++) {
    const y = (r / rows) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
}

function drawYLabels(ctx: CanvasRenderingContext2D, labels: string[], w: number, h: number, side: "left" | "right") {
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.textAlign = side === "left" ? "right" : "left";
  const x = side === "left" ? w - 6 : 6;
  for (let i = 0; i < labels.length; i++) {
    const y = h - (i / (labels.length - 1)) * h;
    ctx.fillText(labels[i], x, y + 3);
  }
}

function drawTimeAxis(ctx: CanvasRenderingContext2D, totalSec: number, w: number, h: number) {
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(totalSec / 6));
  for (let t = 0; t <= totalSec; t += step) {
    const x = (t / totalSec) * w;
    ctx.fillText(`${t}s`, x, h + 12);
  }
}

// ─── Panel 1: Waveform ──────────────────────────────────

function drawWaveform(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, 4, 6);

  // Y labels
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const val = 1 - i * 0.5;
    const y = (i / 4) * h;
    ctx.fillText(val.toFixed(1), 30, y + 3);
  }

  // Plot area (left margin for labels)
  const plotL = 35;
  const plotW = w - plotL - 5;
  const midY = h / 2;

  // Waveform
  const data = dd.waveform.channel[0];
  const step = Math.max(1, Math.floor(data.length / plotW));
  ctx.beginPath();
  for (let px = 0; px < plotW; px++) {
    const idx = Math.floor((px / plotW) * data.length);
    let val = 0;
    // Max over step samples
    for (let s = 0; s < step && idx + s < data.length; s++) {
      const abs = Math.abs(data[idx + s]);
      if (abs > val) val = abs;
    }
    const y = midY - (val * midY * 0.9);
    if (px === 0) ctx.moveTo(plotL + px, y);
    else ctx.lineTo(plotL + px, y);
  }
  ctx.strokeStyle = "#00ffcc";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Mirror negative
  ctx.beginPath();
  for (let px = 0; px < plotW; px++) {
    const idx = Math.floor((px / plotW) * data.length);
    let val = 0;
    for (let s = 0; s < step && idx + s < data.length; s++) {
      const abs = Math.abs(data[idx + s]);
      if (abs > val) val = abs;
    }
    const y = midY + (val * midY * 0.9);
    if (px === 0) ctx.moveTo(plotL + px, y);
    else ctx.lineTo(plotL + px, y);
  }
  ctx.stroke();

  // Center line
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(plotL, midY);
  ctx.lineTo(w - 5, midY);
  ctx.stroke();

  // Title overlay
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Waveform — Crest Factor: ${dd.crestFactorDB} dB | Peak/RMS: ${dd.peakToRms}x`, w / 2, 14);

  // Axis label
  ctx.save();
  ctx.fillStyle = "rgba(0,255,200,0.7)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Amplitude", 0, 0);
  ctx.restore();
}

// ─── Panel 2: Mel Spectrogram ──────────────────────────

function drawMelSpec(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);

  const plotL = 35;
  const plotW = w - plotL - 35; // leave room for colorbar
  const plotH = h;

  // Y labels
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  const yTicks = ["20000", "15000", "10000", "5000", "0"];
  for (let i = 0; i < yTicks.length; i++) {
    const y = (i / (yTicks.length - 1)) * plotH;
    ctx.fillText(yTicks[i], 30, y + 3);
  }

  // Draw mel spectrogram as heatmap
  const melSpec = dd.melSpectrogram;
  if (melSpec.length > 0) {
    const numMel = melSpec[0].length;
    const range = dd.melMaxDB - dd.melMinDB || 1;
    for (let tx = 0; tx < plotW && tx < melSpec.length; tx++) {
      const frameIdx = Math.floor((tx / plotW) * melSpec.length);
      const frame = melSpec[frameIdx];
      for (let my = 0; my < numMel; my++) {
        const val = (frame[my] - dd.melMinDB) / range; // 0-1
        const y = (my / numMel) * plotH;
        const bh = plotH / numMel;

        // Inferno-like colormap
        let r = 0, g = 0, b = 0;
        if (val < 0.2) {
          const t = val / 0.2;
          r = 5 + t * 15; g = 0; b = 15 + t * 40;
        } else if (val < 0.4) {
          const t = (val - 0.2) / 0.2;
          r = 20 + t * 60; g = 5 + t * 20; b = 55 + t * 5;
        } else if (val < 0.6) {
          const t = (val - 0.4) / 0.2;
          r = 80 + t * 80; g = 25 + t * 60; b = 60 - t * 20;
        } else if (val < 0.8) {
          const t = (val - 0.6) / 0.2;
          r = 160 + t * 60; g = 85 + t * 80; b = 40 - t * 20;
        } else {
          const t = (val - 0.8) / 0.2;
          r = 220 + t * 35; g = 165 + t * 90; b = 20 + t * 20;
        }
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(r))},${Math.min(255, Math.round(g))},${Math.min(255, Math.round(b))})`;
        ctx.fillRect(plotL + tx, y, 1, Math.max(1, Math.ceil(bh)));
      }
    }
  }

  // Color bar on right
  const cbL = w - 25;
  const cbW = 10;
  for (let i = 0; i < plotH; i++) {
    const val = 1 - i / plotH;
    let r = 0, g = 0, b = 0;
    if (val < 0.2) { const t = val / 0.2; r = 5 + t * 15; g = 0; b = 15 + t * 40; }
    else if (val < 0.4) { const t = (val - 0.2) / 0.2; r = 20 + t * 60; g = 5 + t * 20; b = 55 + t * 5; }
    else if (val < 0.6) { const t = (val - 0.4) / 0.2; r = 80 + t * 80; g = 25 + t * 60; b = 60 - t * 20; }
    else if (val < 0.8) { const t = (val - 0.6) / 0.2; r = 160 + t * 60; g = 85 + t * 80; b = 40 - t * 20; }
    else { const t = (val - 0.8) / 0.2; r = 220 + t * 35; g = 165 + t * 90; b = 20 + t * 20; }
    ctx.fillStyle = `rgb(${Math.min(255, Math.round(r))},${Math.min(255, Math.round(g))},${Math.min(255, Math.round(b))})`;
    ctx.fillRect(cbL, i, cbW, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "8px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("0", cbL + cbW / 2, 10);
  ctx.fillText("-80", cbL + cbW / 2, h - 5);

  // Axis labels
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "8px Inter, system-ui, sans-serif";
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Frequency (Hz)", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(w - 15, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("dB", 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Mel Spectrogram", w / 2, 14);
}

// ─── Panel 3: Stereo Vectorscope ───────────────────────

function drawVectorscope(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);

  const margin = 32;
  const size = Math.min(w - margin * 2, h - margin * 2);
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;

  // Fine grid (0.05 unit spacing = 20 divisions)
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 40; i++) {
    const pos = ox + (i / 40) * size;
    ctx.beginPath(); ctx.moveTo(pos, oy); ctx.lineTo(pos, oy + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, pos); ctx.lineTo(ox + size, pos); ctx.stroke();
  }

  // Major grid (0.25 unit spacing = 8 divisions)
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 8; i++) {
    const pos = ox + (i / 8) * size;
    ctx.beginPath(); ctx.moveTo(pos, oy); ctx.lineTo(pos, oy + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, pos); ctx.lineTo(ox + size, pos); ctx.stroke();
  }

  // Axes through center (0,0 lines)
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(ox, oy + size / 2); ctx.lineTo(ox + size, oy + size / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox + size / 2, oy); ctx.lineTo(ox + size / 2, oy + size); ctx.stroke();

  // Mono reference line (L=R, corr=1) — dashed
  ctx.strokeStyle = "rgba(180, 80, 80, 0.4)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(ox, oy + size); ctx.lineTo(ox + size, oy); ctx.stroke();

  // Anti-phase reference line (L=-R) — dashed
  ctx.strokeStyle = "rgba(80, 80, 180, 0.4)";
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + size, oy + size); ctx.stroke();
  ctx.setLineDash([]);

  // Axis tick labels
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  const ticks = ["-1.00", "-0.75", "-0.50", "-0.25", "0.00", "0.25", "0.50", "0.75", "1.00"];
  for (let i = 0; i < ticks.length; i++) {
    const x = ox + (i / (ticks.length - 1)) * size;
    const y = oy + size + 14;
    ctx.fillText(ticks[i], x, y);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i < ticks.length; i++) {
    const y = oy + size - (i / (ticks.length - 1)) * size;
    ctx.fillText(ticks[i], ox - 5, y);
  }
  ctx.textBaseline = "alphabetic";

  // Axis labels
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Left", w / 2, oy + size + 28);

  ctx.save();
  ctx.translate(12, oy + size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Right", 0, 0);
  ctx.restore();

  // Legend box (top-left)
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 0.5;
  const legX = ox + 6;
  const legY = oy + 12;
  ctx.beginPath();
  ctx.rect(legX - 4, legY - 12, 92, 30);
  ctx.fill();
  ctx.stroke();

  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(180, 80, 80, 0.6)";
  ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(legX, legY - 4); ctx.lineTo(legX + 12, legY - 4); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("Mono (corr=1)", legX + 16, legY - 1);

  ctx.strokeStyle = "rgba(80, 80, 180, 0.6)";
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(legX, legY + 8); ctx.lineTo(legX + 12, legY + 8); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText("Anti-phase", legX + 16, legY + 11);

  // Plot scatter dots (L on X, R on Y)
  const samples = dd.stereoSamples;
  if (samples && samples.left.length > 0) {
    const n = Math.min(samples.left.length, samples.right.length);
    for (let i = 0; i < n; i++) {
      // L maps to X, R maps to Y
      const lx = Math.max(-1, Math.min(1, samples.left[i]));
      const ry = Math.max(-1, Math.min(1, samples.right[i]));

      const px = ox + ((lx + 1) / 2) * size;
      const py = oy + size - ((ry + 1) / 2) * size;

      if (px >= ox && px <= ox + size && py >= oy && py <= oy + size) {
        ctx.fillStyle = "rgba(0, 255, 127, 0.15)";
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    }
  }

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Stereo Field — Correlation: ${dd.stereoCorrelation.toFixed(3)}`, w / 2, 12);
}

// ─── Panel 4: Spectral Centroid & Rolloff ──────────────

function drawCentroidRolloff(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, 6, 6);

  const plotL = 35;
  const plotW = w - plotL - 10;
  const totalSec = dd.timeAxis[dd.timeAxis.length - 1] || 1;

  // Y labels
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  const yTicks = ["12000", "10000", "8000", "6000", "4000", "2000", "0"];
  for (let i = 0; i < yTicks.length; i++) {
    const y = (i / (yTicks.length - 1)) * h;
    ctx.fillText(yTicks[i], 30, y + 3);
  }

  // Legend
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(w - 70, 6, 8, 8);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Centroid", w - 56, 14);

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(w - 70, 20, 8, 8);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Rolloff 85%", w - 62, 28);

  // Plot centroid (area fill)
  if (dd.spectralCentroid.length > 1) {
    const maxFreq = 12000;
    // Fill area
    ctx.beginPath();
    ctx.moveTo(plotL, h);
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.spectralCentroid.length);
      const val = Math.min(dd.spectralCentroid[idx], maxFreq);
      const y = h - (val / maxFreq) * h;
      ctx.lineTo(plotL + px, y);
    }
    ctx.lineTo(plotL + plotW, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(160, 82, 45, 0.4)";
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.spectralCentroid.length);
      const val = Math.min(dd.spectralCentroid[idx], maxFreq);
      const y = h - (val / maxFreq) * h;
      if (px === 0) ctx.moveTo(plotL + px, y);
      else ctx.lineTo(plotL + px, y);
    }
    ctx.strokeStyle = "#ff6600";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Plot rolloff (red line)
    ctx.beginPath();
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.spectralRolloff.length);
      const val = Math.min(dd.spectralRolloff[idx], maxFreq);
      const y = h - (val / maxFreq) * h;
      if (px === 0) ctx.moveTo(plotL + px, y);
      else ctx.lineTo(plotL + px, y);
    }
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis label
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "8px Inter, system-ui, sans-serif";
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Frequency (Hz)", 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Spectral Centroid & Rolloff", w / 2, 14);
}

// ─── Panel 4: RMS Energy + Beats ───────────────────────

function drawRMS(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, 6, 6);

  const plotL = 35;
  const plotW = w - plotL - 10;
  const totalSec = dd.timeAxis[dd.timeAxis.length - 1] || 1;
  const maxVal = 60; // scale for RMS * 100

  // Y labels
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  const yTicks = ["60", "50", "40", "30", "20", "10", "0"];
  for (let i = 0; i < yTicks.length; i++) {
    const y = (i / (yTicks.length - 1)) * h;
    ctx.fillText(yTicks[i], 30, y + 3);
  }

  // Beat markers (thin orange lines)
  ctx.strokeStyle = "rgba(255, 165, 0, 0.3)";
  ctx.lineWidth = 0.5;
  for (const beat of dd.beats) {
    const x = plotL + (beat / totalSec) * plotW;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  // RMS area fill
  if (dd.rmsEnergy.length > 1) {
    ctx.beginPath();
    ctx.moveTo(plotL, h);
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.rmsEnergy.length);
      const val = Math.min(dd.rmsEnergy[idx] * 100, maxVal);
      const y = h - (val / maxVal) * h;
      ctx.lineTo(plotL + px, y);
    }
    ctx.lineTo(plotL + plotW, h);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 191, 255, 0.35)";
    ctx.fill();

    // RMS line
    ctx.beginPath();
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.rmsEnergy.length);
      const val = Math.min(dd.rmsEnergy[idx] * 100, maxVal);
      const y = h - (val / maxVal) * h;
      if (px === 0) ctx.moveTo(plotL + px, y);
      else ctx.lineTo(plotL + px, y);
    }
    ctx.strokeStyle = "#00bfff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis label
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "8px Inter, system-ui, sans-serif";
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("RMS x 100", 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`RMS Energy — Beats: ${dd.totalBeats} | Est. Tempo: ${dd.bpm} BPM`, w / 2, 14);
}

// ─── Panel 5: Spectral Bandwidth & ZCR ──────────────────

function drawBandwidthZCR(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, 6, 6);

  const plotL = 35;
  const plotR = 35;
  const plotW = w - plotL - plotR;
  const totalSec = dd.timeAxis[dd.timeAxis.length - 1] || 1;

  // Left Y (bandwidth Hz)
  ctx.fillStyle = "rgba(153, 50, 204, 0.7)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  const bwTicks = ["6000", "4000", "2000", "0"];
  for (let i = 0; i < bwTicks.length; i++) {
    const y = (i / (bwTicks.length - 1)) * h;
    ctx.fillText(bwTicks[i], 30, y + 3);
  }

  // Right Y (ZCR)
  ctx.fillStyle = "rgba(0, 128, 128, 0.7)";
  ctx.textAlign = "left";
  const zcrTicks = ["0.25", "0.20", "0.15", "0.10", "0.05", "0.00"];
  for (let i = 0; i < zcrTicks.length; i++) {
    const y = (i / (zcrTicks.length - 1)) * h;
    ctx.fillText(zcrTicks[i], w - 28, y + 3);
  }

  // Plot bandwidth (purple)
  const maxBW = 6000;
  if (dd.spectralBandwidth.length > 1) {
    ctx.beginPath();
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.spectralBandwidth.length);
      const val = Math.min(dd.spectralBandwidth[idx], maxBW);
      const y = h - (val / maxBW) * h;
      if (px === 0) ctx.moveTo(plotL + px, y);
      else ctx.lineTo(plotL + px, y);
    }
    ctx.strokeStyle = "#9932cc";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Plot ZCR (teal)
  const maxZCR = 0.25;
  if (dd.zcr.length > 1) {
    ctx.beginPath();
    for (let px = 0; px < plotW; px++) {
      const idx = Math.floor((px / plotW) * dd.zcr.length);
      const val = Math.min(dd.zcr[idx], maxZCR);
      const y = h - (val / maxZCR) * h;
      if (px === 0) ctx.moveTo(plotL + px, y);
      else ctx.lineTo(plotL + px, y);
    }
    ctx.strokeStyle = "#008080";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Axis labels
  ctx.save();
  ctx.fillStyle = "rgba(153, 50, 204, 0.7)";
  ctx.font = "8px Inter, system-ui, sans-serif";
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Bandwidth (Hz)", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(0, 128, 128, 0.7)";
  ctx.font = "8px Inter, system-ui, sans-serif";
  ctx.translate(w - 12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("ZCR", 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Spectral Bandwidth & Zero Crossing Rate", w / 2, 14);

  // Time axis at bottom
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(totalSec / 6));
  for (let t = 0; t <= totalSec; t += step) {
    const x = plotL + (t / totalSec) * plotW;
    ctx.fillText(`${t}`, x, h + 14);
  }
  ctx.fillText("Time (s)", w / 2, h + 26);
}

// ─── Panel 7: Average Spectrum ─────────────────────────

function drawAvgSpectrum(ctx: CanvasRenderingContext2D, dd: DashboardData, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);

  const plotL = 40;
  const plotR = 15;
  const plotW = w - plotL - plotR;
  const plotH = h - 30;
  const plotBot = h - 5;

  const spec = dd.avgSpectrum;
  if (!spec || spec.freqs.length === 0) return;

  // Y axis: -80 to 0 dB
  const minDB = -80;
  const maxDB = 2;
  const yRange = maxDB - minDB;

  // Grid (every 10 dB)
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.5;
  for (let db = 0; db >= -70; db -= 10) {
    const y = plotBot - ((db - minDB) / yRange) * plotH;
    ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotL + plotW, y); ctx.stroke();
  }

  // Y labels (every 10 dB)
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  for (let db = 0; db >= -70; db -= 10) {
    const y = plotBot - ((db - minDB) / yRange) * plotH;
    ctx.fillText(`${db}`, plotL - 4, y + 3);
  }

  // X axis: logarithmic — powers of 10
  const xMin = Math.log10(20);
  const xMax = Math.log10(20000);
  const xRange = xMax - xMin;

  ctx.textAlign = "center";
  const xTicks = [100, 1000, 10000];
  for (const f of xTicks) {
    const x = plotL + ((Math.log10(f) - xMin) / xRange) * plotW;
    ctx.fillText(f < 1000 ? `${f}` : `${f / 1000}k`, x, plotBot + 14);
  }

  // Grid lines for x ticks
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.5;
  for (const f of xTicks) {
    const x = plotL + ((Math.log10(f) - xMin) / xRange) * plotW;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, plotBot); ctx.stroke();
  }

  // Reference zone markers (dashed lines)
  const zones: [number, string, string][] = [
    [60, "rgba(200, 80, 120, 0.5)", "Sub (60 Hz)"],
    [250, "rgba(255, 160, 50, 0.5)", "Bass (250 Hz)"],
    [4000, "rgba(80, 180, 220, 0.5)", "Presence (4 kHz)"],
    [8000, "rgba(150, 80, 200, 0.5)", "Air (8 kHz)"],
  ];

  // Legend
  const legX = plotL + plotW - 100;
  const legY = 8;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.rect(legX, legY, 100, 60);
  ctx.fill();
  ctx.stroke();

  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  for (let zi = 0; zi < zones.length; zi++) {
    const [freq, color, label] = zones[zi];
    const x = plotL + ((Math.log10(freq) - xMin) / xRange) * plotW;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, plotBot); ctx.stroke();
    ctx.setLineDash([]);

    // Legend entry
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(legX + 4, legY + 8 + zi * 14); ctx.lineTo(legX + 14, legY + 8 + zi * 14); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(label, legX + 18, legY + 12 + zi * 14);
  }

  // Average spectrum fill + line
  const maxMag = Math.max(...spec.mags, -100);
  const minMag = Math.min(...spec.mags, -100);

  // Draw fill
  ctx.beginPath();
  ctx.moveTo(plotL, plotBot);
  for (let i = 0; i < spec.freqs.length; i++) {
    const x = plotL + ((Math.log10(Math.max(spec.freqs[i], 20)) - xMin) / xRange) * plotW;
    const dbVal = Math.max(spec.mags[i], minDB);
    const y = plotBot - ((dbVal - minDB) / yRange) * plotH;
    ctx.lineTo(x, Math.max(0, Math.min(plotBot, y)));
  }
  ctx.lineTo(plotL + plotW, plotBot);
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 180, 80, 0.15)";
  ctx.fill();

  // Draw line
  ctx.beginPath();
  for (let i = 0; i < spec.freqs.length; i++) {
    const x = plotL + ((Math.log10(Math.max(spec.freqs[i], 20)) - xMin) / xRange) * plotW;
    const dbVal = Math.max(spec.mags[i], minDB);
    const y = plotBot - ((dbVal - minDB) / yRange) * plotH;
    if (i === 0) ctx.moveTo(x, Math.max(0, Math.min(plotBot, y)));
    else ctx.lineTo(x, Math.max(0, Math.min(plotBot, y)));
  }
  ctx.strokeStyle = "#00ff66";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Frequency (Hz)", w / 2, h - 1);

  ctx.save();
  ctx.translate(12, plotBot / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Magnitude (dB)", 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
    ctx.fillText(`Average Spectrum — Sub Energy Index: ${dd.subEnergyIndex.toFixed(1)} | Centroid μ: ${Math.round(dd.spectralCentroidHz)} Hz | Rolloff: ${Math.round(dd.spectralRolloff[dd.spectralRolloff.length - 1] || 0)} Hz`, w / 2, 12);
}

// ─── Main Component ─────────────────────────────────────

export default function AudioAnalyzer({ file, genre, onResult, songId }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const wfRef = useRef<HTMLCanvasElement>(null);
  const melRef = useRef<HTMLCanvasElement>(null);
  const vecRef = useRef<HTMLCanvasElement>(null);
  const centRef = useRef<HTMLCanvasElement>(null);
  const rmsRef = useRef<HTMLCanvasElement>(null);
  const bwRef = useRef<HTMLCanvasElement>(null);
  const avgRef = useRef<HTMLCanvasElement>(null);

  // Canvas dimensions
  const canvasW = 700;
  const panelH = 150;

  // Auto-submit analysis result to server for persistent caching
  useEffect(() => {
    if (!result || !songId || submitted) return;

    const analysisPayload = {
      overallScore: result.overallScore,
      passed: result.passed,
      genre: result.genre,
      metrics: result.metrics,
      summary: result.summary,
      enhancementTips: result.enhancementTips,
      createdAt: new Date().toISOString(),
    };

    fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        songId,
        analysis: analysisPayload,
      }),
    })
      .then((res) => {
        if (!res.ok) console.warn("Failed to cache analysis result");
        setSubmitted(true);
      })
      .catch((err) => {
        console.warn("Failed to cache analysis result:", err);
        setSubmitted(true); // still mark as submitted to avoid retry spam
      });
  }, [result, songId, submitted]);

  const run = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeAudioFile(file, genre);
      setResult(analysis);
      onResult?.(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [file, genre, onResult]);

  useEffect(() => { run(); }, [run]);

  // Draw panels when data arrives
  useEffect(() => {
    if (!result || !result.dashboard) return;
    const dd = result.dashboard;

    // Waveform
    const wf = wfRef.current;
    if (wf) {
      wf.width = canvasW;
      wf.height = panelH;
      const ctx = wf.getContext("2d");
      if (ctx) drawWaveform(ctx, dd, canvasW, panelH);
    }

    // Mel spectrogram
    const mel = melRef.current;
    if (mel) {
      mel.width = canvasW;
      mel.height = panelH;
      const ctx = mel.getContext("2d");
      if (ctx) drawMelSpec(ctx, dd, canvasW, panelH);
    }

    // Vectorscope
    const vec = vecRef.current;
    if (vec) {
      vec.width = canvasW;
      vec.height = panelH;
      const ctx = vec.getContext("2d");
      if (ctx) drawVectorscope(ctx, dd, canvasW, panelH);
    }

    // Centroid & Rolloff
    const cent = centRef.current;
    if (cent) {
      cent.width = canvasW;
      cent.height = panelH;
      const ctx = cent.getContext("2d");
      if (ctx) drawCentroidRolloff(ctx, dd, canvasW, panelH);
    }

    // RMS Energy
    const rms = rmsRef.current;
    if (rms) {
      rms.width = canvasW;
      rms.height = panelH;
      const ctx = rms.getContext("2d");
      if (ctx) drawRMS(ctx, dd, canvasW, panelH);
    }

    // Bandwidth & ZCR
    const bw = bwRef.current;
    if (bw) {
      bw.width = canvasW;
      bw.height = panelH;
      const ctx = bw.getContext("2d");
      if (ctx) drawBandwidthZCR(ctx, dd, canvasW, panelH);
    }

    // Average Spectrum
    const avg = avgRef.current;
    if (avg) {
      avg.width = canvasW;
      avg.height = panelH;
      const ctx = avg.getContext("2d");
      if (ctx) drawAvgSpectrum(ctx, dd, canvasW, panelH);
    }
  }, [result]);

  // ── Render ──

  if (loading) {
    return (
      <div className="warm-card p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#00ffcc]/30 border-t-[#00ffcc] rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Analyzing audio — computing waveform, spectrogram, spectral features...</span>
        </div>
        <div className="mt-3 h-32 bg-[rgba(255,255,255,0.03)] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="warm-card p-5 mb-6 border border-[rgba(239,68,68,0.3)]">
        <div className="flex items-center gap-2 text-red-400 text-sm mb-1"><span>⚠️</span><span className="font-semibold">Analysis Error</span></div>
        <p className="text-text-secondary text-xs">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  const scoreColor = result.overallScore >= 90 ? "#22c55e" : result.overallScore >= 70 ? "#eab308" : "#ef4444";
  const scoreBgColor = result.overallScore >= 90 ? "rgba(34,197,94,0.1)" : result.overallScore >= 70 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)";

  return (
    <div className="warm-card p-4 mb-6 border border-[rgba(108,140,255,0.12)]">
      {/* Compact header / dropdown toggle */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left group">
        <div className="flex items-center gap-2.5">
          <span>🎛️</span>
          <span className="text-sm font-semibold group-hover:text-text-primary transition-colors">Audio Analysis</span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: scoreBgColor, color: scoreColor }}>{result.overallScore}%</span>
          <span className="text-[11px] text-text-secondary">{result.passed ? "✅" : "⚠️"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-secondary opacity-50 group-hover:opacity-80 transition-opacity">{expanded ? "hide" : "show"}</span>
          <span className={`text-text-secondary text-sm transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          {/* Score Summary */}
          <div className="p-4 rounded-2xl text-sm" style={{ backgroundColor: scoreBgColor, border: `1px solid ${scoreColor}33` }}>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreColor} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(result.overallScore / 100) * 97.4} 97.4`} style={{ transition: "stroke-dasharray 0.8s ease" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-extrabold" style={{ color: scoreColor }}>{result.overallScore}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: scoreColor }}>
                  {result.passed ? "✅ Ready to Upload" : "❌ Not Recommended for Upload"}
                </p>
                <p className="text-text-secondary text-xs leading-relaxed">{result.summary.split("—")[1]?.trim() || result.summary}</p>
              </div>
            </div>
          </div>

          {/* 5-Panel Dashboard */}
          {result.dashboard && (
            <div className="bg-black rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)]" style={{ aspectRatio: `${canvasW} / ${panelH * 7 + 60}` }}>
            <div className="w-full" style={{ padding: 0 }}>
              <canvas ref={wfRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
              <canvas ref={melRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
              <canvas ref={vecRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
              <canvas ref={centRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
              <canvas ref={rmsRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
              <canvas ref={bwRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
              <canvas ref={avgRef} className="w-full h-auto block" style={{ aspectRatio: `${canvasW} / ${panelH}` }} />
            </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Quality Metrics</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.metrics.map((m) => {
                const c = m.passed ? "#22c55e" : m.score >= 50 ? "#eab308" : "#ef4444";
                return (
                  <div key={m.name} className="p-3 rounded-xl text-xs" style={{ backgroundColor: `${c}08`, border: `1px solid ${c}20` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-text-secondary">{m.name}</span>
                      <span className="font-mono font-bold" style={{ color: c }}>{m.score}/100</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">{m.value}</span>
                      <span className="opacity-60 text-[10px]">Threshold: {m.threshold}</span>
                    </div>
                    <div className="mt-1.5 h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.score}%`, backgroundColor: c }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enhancement Tips */}
          {result.enhancementTips.some(Boolean) && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Enhancement Tips</h4>
              <div className="space-y-2">
                {result.enhancementTips.filter(Boolean).map((tip: string, i: number) => (
                  <div key={i} className="p-3 rounded-xl text-xs leading-relaxed flex items-start gap-2" style={{ backgroundColor: "rgba(108,140,255,0.06)", border: "1px solid rgba(108,140,255,0.12)" }}>
                    <span className="mt-0.5 flex-shrink-0">{result.overallScore >= 90 ? "✅" : "💡"}</span>
                    <span className="text-text-secondary">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          {!result.passed && (
            <div className="p-3 rounded-xl text-xs bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)] flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-300 mb-1">Below Recommended Quality</p>
                <p className="text-text-secondary">The platform accepts all tracks regardless of analysis results. Consider re-exporting with higher quality settings.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
