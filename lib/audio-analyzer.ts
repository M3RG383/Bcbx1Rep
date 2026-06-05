/**
 * Audio Quality Analyzer — Pure Web Audio API
 * Produces industry-standard analysis dashboard:
 *   1. Waveform + Crest Factor
 *   2. Mel Spectrogram
 *   3. Spectral Centroid & Rolloff
 *   4. RMS Energy, Beat Detection, BPM
 *   5. Spectral Bandwidth & Zero Crossing Rate
 *   6. Stereo Vectorscope / Goniometer
 *
 * All computation is client-side, no native dependencies.
 */

// ─── Types ──────────────────────────────────────────────

export interface GenreProfile {
  name: string;
  label: string;
  minBandwidthHz: number;
  minDynamicRangeDB: number;
  maxClipping: number;
  minBassRatio: number;
  targetMidRange: [number, number];
  minTrebleRatio: number;
  minStereoCorrelation: number;
  targetLoudnessRange: [number, number];
}

export interface DashboardData {
  /** Waveform: interleaved channels as { left, right? } arrays */
  waveform: { channel: Float32Array[]; sampleRate: number; durationSec: number };
  /** Crest factor dB */
  crestFactorDB: number;
  /** Peak-to-RMS ratio */
  peakToRms: number;
  /** Mel spectrogram: [time][melBins] power values */
  melSpectrogram: number[][];
  /** Mel spectrogram min/max dB for color scaling */
  melMinDB: number;
  melMaxDB: number;
  /** Mel filterbank frequencies (center freqs) */
  melFreqs: number[];
  /** Time axis for all per-frame data (seconds) */
  timeAxis: number[];
  /** Spectral centroid per frame (Hz) */
  spectralCentroid: number[];
  /** Spectral rolloff-85% per frame (Hz) */
  spectralRolloff: number[];
  /** RMS energy per frame */
  rmsEnergy: number[];
  /** Beat positions in seconds */
  beats: number[];
  /** Estimated BPM */
  bpm: number;
  /** Total beats detected */
  totalBeats: number;
  /** Spectral bandwidth per frame (Hz) */
  spectralBandwidth: number[];
  /** Zero crossing rate per frame */
  zcr: number[];

  // Quality metrics (same as before)
  loudnessDB: number;
  peakLevel: number;
  clippingRatio: number;
  dynamicRangeDB: number;
  spectralCentroidHz: number;
  bandwidthHz: number;
  bassRatio: number;
  midRatio: number;
  trebleRatio: number;
  stereoCorrelation: number;
  /** Downsampled L/R sample pairs for vectorscope rendering */
  stereoSamples: { left: Float64Array; right: Float64Array };
  /** Average spectrum: frequency bins (Hz) and magnitude (dB) */
  avgSpectrum: { freqs: number[]; mags: number[] };
  /** Sub energy index */
  subEnergyIndex: number;
  estimatedBitrateKbps: number;
  sampleRate: number;
  channels: number;
}

export interface MetricResult {
  name: string;
  value: string;
  score: number;
  passed: boolean;
  threshold: string;
  tip?: string;
}

export interface AnalysisResult {
  overallScore: number;
  passed: boolean;
  genre: GenreProfile;
  metrics: MetricResult[];
  summary: string;
  enhancementTips: string[];
  dashboard: DashboardData;
}

// ─── Genre Profiles ─────────────────────────────────────

const GENRE_PROFILES: Record<string, GenreProfile> = {
  Electronic: { name: "Electronic", label: "Electronic / Dance", minBandwidthHz: 16000, minDynamicRangeDB: 12, maxClipping: 0.001, minBassRatio: 0.20, targetMidRange: [0.20, 0.45], minTrebleRatio: 0.15, minStereoCorrelation: 0.3, targetLoudnessRange: [-12, -7] },
  "Hip Hop": { name: "Hip Hop", label: "Hip Hop / Rap", minBandwidthHz: 14000, minDynamicRangeDB: 8, maxClipping: 0.003, minBassRatio: 0.30, targetMidRange: [0.20, 0.45], minTrebleRatio: 0.10, minStereoCorrelation: 0.4, targetLoudnessRange: [-10, -6] },
  "R&B": { name: "R&B", label: "R&B / Soul", minBandwidthHz: 15000, minDynamicRangeDB: 10, maxClipping: 0.001, minBassRatio: 0.20, targetMidRange: [0.35, 0.55], minTrebleRatio: 0.12, minStereoCorrelation: 0.5, targetLoudnessRange: [-12, -8] },
  Pop: { name: "Pop", label: "Pop", minBandwidthHz: 16000, minDynamicRangeDB: 8, maxClipping: 0.002, minBassRatio: 0.15, targetMidRange: [0.25, 0.50], minTrebleRatio: 0.15, minStereoCorrelation: 0.4, targetLoudnessRange: [-9, -5] },
  Rock: { name: "Rock", label: "Rock / Alternative", minBandwidthHz: 15000, minDynamicRangeDB: 10, maxClipping: 0.005, minBassRatio: 0.15, targetMidRange: [0.40, 0.60], minTrebleRatio: 0.12, minStereoCorrelation: 0.5, targetLoudnessRange: [-11, -6] },
  Jazz: { name: "Jazz", label: "Jazz / Fusion", minBandwidthHz: 18000, minDynamicRangeDB: 14, maxClipping: 0.0005, minBassRatio: 0.10, targetMidRange: [0.30, 0.50], minTrebleRatio: 0.20, minStereoCorrelation: 0.6, targetLoudnessRange: [-16, -10] },
  "Lo-Fi": { name: "Lo-Fi", label: "Lo-Fi / Chill", minBandwidthHz: 11000, minDynamicRangeDB: 6, maxClipping: 0.01, minBassRatio: 0.15, targetMidRange: [0.30, 0.55], minTrebleRatio: 0.05, minStereoCorrelation: 0.3, targetLoudnessRange: [-14, -8] },
};

const DEFAULT_PROFILE: GenreProfile = { name: "Default", label: "General Broadcast", minBandwidthHz: 14000, minDynamicRangeDB: 8, maxClipping: 0.005, minBassRatio: 0.10, targetMidRange: [0.20, 0.60], minTrebleRatio: 0.08, minStereoCorrelation: 0.2, targetLoudnessRange: [-14, -5] };

export function getGenreProfile(genre: string): GenreProfile {
  const key = genre.split(" > ")[0].trim();
  return GENRE_PROFILES[key] || DEFAULT_PROFILE;
}

// ─── DSP Utilities ──────────────────────────────────────

function toDB(ratio: number): number { return 20 * Math.log10(Math.max(ratio, 1e-10)); }

/** Cooley-Tukey radix-2 FFT on Float64Array (power of 2, in-place on views) */
function fft(signal: Float64Array): { real: Float64Array; imag: Float64Array } {
  const n = signal.length;
  // Must be power of 2
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  const real = new Float64Array(nextPow2);
  const imag = new Float64Array(nextPow2);
  for (let i = 0; i < n; i++) real[i] = signal[i];
  for (let i = n; i < nextPow2; i++) real[i] = 0;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < nextPow2; i++) {
    let bit = nextPow2 >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
    }
  }

  // Butterfly
  for (let len = 2; len <= nextPow2; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < nextPow2; i += len) {
      let wRe = 1, wIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const idx = i + k;
        const idx2 = idx + len / 2;
        const tRe = wRe * real[idx2] - wIm * imag[idx2];
        const tIm = wRe * imag[idx2] + wIm * real[idx2];
        real[idx2] = real[idx] - tRe;
        imag[idx2] = imag[idx] - tIm;
        real[idx] = real[idx] + tRe;
        imag[idx] = imag[idx] + tIm;
        const nwr = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nwr;
      }
    }
  }
  return { real, imag };
}

/** Hanning window of length n */
function hanning(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

/** Mel-scale: convert Hz to Mel */
function hzToMel(hz: number): number { return 2595 * Math.log10(1 + hz / 700); }

/** Mel-scale: convert Mel to Hz */
function melToHz(mel: number): number { return 700 * (Math.pow(10, mel / 2595) - 1); }

/** Build triangular mel filterbank */
function createMelFilterbank(numFilters: number, fftSize: number, sampleRate: number): Float64Array[] {
  const nyquist = sampleRate / 2;
  const lowMel = hzToMel(20);
  const highMel = hzToMel(nyquist);
  const melPoints = new Float64Array(numFilters + 2);
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = lowMel + (i * (highMel - lowMel)) / (numFilters + 1);
  }

  const binFreqs = new Float64Array(fftSize / 2 + 1);
  for (let i = 0; i < binFreqs.length; i++) {
    binFreqs[i] = (i * sampleRate) / fftSize;
  }

  const filters: Float64Array[] = [];
  for (let m = 0; m < numFilters; m++) {
    const filter = new Float64Array(fftSize / 2 + 1);
    const f0 = melToHz(melPoints[m]);
    const f1 = melToHz(melPoints[m + 1]);
    const f2 = melToHz(melPoints[m + 2]);
    for (let i = 0; i < binFreqs.length; i++) {
      const f = binFreqs[i];
      if (f >= f0 && f <= f1) {
        filter[i] = (f - f0) / (f1 - f0);
      } else if (f >= f1 && f <= f2) {
        filter[i] = (f2 - f) / (f2 - f1);
      }
    }
    filters.push(filter);
  }
  return filters;
}

// ─── Main Audio Analysis ────────────────────────────────

export function analyzeAudioBuffer(buffer: AudioBuffer): DashboardData {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const numFrames = buffer.length;
  const durationSec = numFrames / sampleRate;

  // Get channel data
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  // Mono mix
  const mono = new Float64Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) sum += channels[c][i];
    mono[i] = sum / numChannels;
  }

  // ── Waveform data (downsampled for display) ──
  // We keep full precision in channels, waveform is just for rendering

  // ── Per-frame analysis ──
  const fftSize = 2048;
  const hopSize = 1024;
  const halfFft = fftSize / 2;
  const numWindows = Math.max(1, Math.floor((numFrames - fftSize) / hopSize) + 1);

  const window = hanning(fftSize);

  // Spectrogram storage: [time][bin]
  const specPower: number[][] = [];
  const timeAxis: number[] = [];
  const spectralCentroid: number[] = [];
  const spectralRolloff: number[] = [];
  const rmsEnergy: number[] = [];
  const spectralBandwidth: number[] = [];
  const zcr: number[] = [];

  // Mel filterbank
  const numMelBands = 128;
  const melFilters = createMelFilterbank(numMelBands, fftSize, sampleRate);
  const melCenterFreqs: number[] = [];
  for (let m = 0; m < numMelBands; m++) {
    const lowMel = hzToMel(20);
    const highMel = hzToMel(sampleRate / 2);
    const mel = lowMel + (m + 1) * (highMel - lowMel) / (numMelBands + 1);
    melCenterFreqs.push(melToHz(mel));
  }
  const melSpec: number[][] = []; // [time][melBand]

  // Accumulated magnitudes for overall metrics
  const accMags = new Float64Array(halfFft);
  let totalEnergyPerFrame = 0;

  for (let w = 0; w < numWindows; w++) {
    const offset = w * hopSize;
    if (offset + fftSize > numFrames) break;

    const t = offset / sampleRate;
    timeAxis.push(t);

    // Frame data
    const frame = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) frame[i] = mono[offset + i] * window[i];
    const { real, imag } = fft(frame);

    // Magnitudes & power
    const mags = new Float64Array(halfFft);
    let framePower = 0;
    for (let i = 0; i < halfFft; i++) {
      mags[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      const p = mags[i] * mags[i];
      framePower += p;
      accMags[i] += mags[i];
    }
    totalEnergyPerFrame += framePower;

    // Power spectrum (dB)
    const powerDB = new Float64Array(halfFft);
    for (let i = 0; i < halfFft; i++) {
      powerDB[i] = 10 * Math.log10(Math.max(mags[i] * mags[i], 1e-15));
    }
    specPower.push(Array.from(powerDB));

    // Mel spectrogram
    const melFrame = new Float64Array(numMelBands);
    for (let m = 0; m < numMelBands; m++) {
      let sum = 0;
      for (let i = 0; i < halfFft; i++) sum += mags[i] * melFilters[m][i];
      melFrame[m] = sum;
    }
    melSpec.push(Array.from(melFrame));

    // RMS energy
    let sqSum = 0;
    for (let i = 0; i < fftSize; i++) {
      const val = mono[Math.min(offset + i, numFrames - 1)];
      sqSum += val * val;
    }
    rmsEnergy.push(Math.sqrt(sqSum / fftSize));

    // Spectral centroid
    let num = 0, denom = 0;
    for (let i = 1; i < halfFft; i++) {
      const freq = (i * sampleRate) / fftSize;
      num += freq * mags[i];
      denom += mags[i];
    }
    spectralCentroid.push(denom > 0 ? num / denom : 0);

    // Spectral rolloff (85%)
    const totalMag = denom;
    let cumMag = 0;
    let rolloff = 0;
    for (let i = 1; i < halfFft; i++) {
      cumMag += mags[i];
      if (cumMag >= totalMag * 0.85) {
        rolloff = (i * sampleRate) / fftSize;
        break;
      }
    }
    spectralRolloff.push(rolloff);

    // Spectral bandwidth
    let bwNum = 0, bwDenom = 0;
    const c = spectralCentroid[spectralCentroid.length - 1];
    for (let i = 1; i < halfFft; i++) {
      const freq = (i * sampleRate) / fftSize;
      const diff = freq - c;
      bwNum += diff * diff * mags[i];
      bwDenom += mags[i];
    }
    spectralBandwidth.push(bwDenom > 0 ? Math.sqrt(bwNum / bwDenom) : 0);

    // Zero crossing rate
    let zcCount = 0;
    const startIdx = offset;
    const endIdx = Math.min(offset + fftSize, numFrames);
    for (let i = startIdx + 1; i < endIdx; i++) {
      if ((mono[i] >= 0 && mono[i - 1] < 0) || (mono[i] < 0 && mono[i - 1] >= 0)) zcCount++;
    }
    zcr.push(zcCount / Math.max(endIdx - startIdx - 1, 1));
  }

  // Normalize accumulators
  const numActual = timeAxis.length;
  for (let i = 0; i < halfFft; i++) accMags[i] /= numActual;

  // ── Mel spectrogram conversion to dB ──
  let melMinDB = Infinity, melMaxDB = -Infinity;
  const melSpecDB: number[][] = [];
  for (const frame of melSpec) {
    const dbFrame: number[] = [];
    for (const v of frame) {
      const db = 10 * Math.log10(Math.max(v, 1e-15));
      dbFrame.push(db);
      if (db < melMinDB) melMinDB = db;
      if (db > melMaxDB) melMaxDB = db;
    }
    melSpecDB.push(dbFrame);
  }

  // ── Beat detection via spectral flux onset ──
  const beats: number[] = [];
  if (specPower.length > 2) {
    // Spectral flux: positive differences in power spectrum
    const flux: number[] = [0];
    for (let i = 1; i < specPower.length; i++) {
      let f = 0;
      for (let j = 0; j < halfFft; j++) {
        const diff = specPower[i][j] - specPower[i - 1][j];
        if (diff > 0) f += diff;
      }
      flux.push(f);
    }

    // Normalize and find peaks
    const maxFlux = Math.max(...flux);
    const fluxNorm = flux.map(f => f / maxFlux);
    const threshold = 0.6;
    // Moving average for adaptive threshold
    const windowSize = Math.max(1, Math.floor(flux.length / 8));
    for (let i = windowSize; i < fluxNorm.length - windowSize; i++) {
      const localMax = Math.max(...fluxNorm.slice(i - windowSize, i + windowSize));
      if (fluxNorm[i] === localMax && fluxNorm[i] > threshold) {
        beats.push(timeAxis[i]);
      }
    }
  }

  const totalBeats = beats.length;
  // Estimate BPM from median inter-beat interval
  let bpm = 0;
  if (beats.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < beats.length; i++) intervals.push(beats[i] - beats[i - 1]);
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (median > 0) bpm = Math.round(60 / median);
  }

  // ── Overall metrics ──
  let sumSq = 0;
  for (let c = 0; c < numChannels; c++) {
    const data = channels[c];
    for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
  }
  const rms = Math.sqrt(sumSq / (numChannels * numFrames));
  const loudnessDB = toDB(rms);

  let peak = 0, clipCount = 0;
  for (let c = 0; c < numChannels; c++) {
    const data = channels[c];
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
      if (abs >= 0.999) clipCount++;
    }
  }
  const clippingRatio = clipCount / (numChannels * numFrames);
  const crestFactorDB = toDB(peak / Math.max(rms, 1e-10));
  const dynamicRangeDB = crestFactorDB;

  // Spectral centroid (overall)
  let cNum = 0, cDenom = 0;
  const binRes = sampleRate / fftSize;
  for (let i = 1; i < halfFft; i++) {
    const freq = i * binRes;
    cNum += freq * accMags[i];
    cDenom += accMags[i];
  }
  const overallCentroid = cDenom > 0 ? cNum / cDenom : 0;

  // Bandwidth (overall)
  let bwN = 0, bwD = 0;
  for (let i = 1; i < halfFft; i++) {
    const freq = i * binRes;
    const diff = freq - overallCentroid;
    bwN += diff * diff * accMags[i];
    bwD += accMags[i];
  }
  const overallBandwidth = bwD > 0 ? Math.sqrt(bwN / bwD) : 0;

  // Band energies
  let bassE = 0, midE = 0, trebleE = 0, totalE = 0;
  for (let i = 1; i < halfFft; i++) {
    const freq = i * binRes;
    const e = accMags[i] * accMags[i];
    totalE += e;
    if (freq < 250) bassE += e;
    else if (freq < 4000) midE += e;
    else trebleE += e;
  }

  // Stereo correlation
  let stereoCorr = 1;
  if (numChannels >= 2) {
    let sL2 = 0, sR2 = 0, sLR = 0;
    const left = channels[0], right = channels[1];
    for (let i = 0; i < numFrames; i++) {
      sL2 += left[i] * left[i];
      sR2 += right[i] * right[i];
      sLR += left[i] * right[i];
    }
    const sDenom = Math.sqrt(sL2 * sR2);
    stereoCorr = sDenom > 0 ? sLR / sDenom : 1;
  }

  const bwRatio = overallBandwidth / (sampleRate / 2);
  const estBitrate = 128 + (bwRatio > 0.75 ? 192 : bwRatio > 0.5 ? 64 : 0);

  // Build waveform render data (downsampled for display)
  const waveformChannels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    waveformChannels.push(channels[c]);
  }

  // Build downsampled L/R samples for vectorscope (max ~10,000 points)
  let stereoSamples: { left: Float64Array; right: Float64Array } = { left: new Float64Array(0), right: new Float64Array(0) };
  if (numChannels >= 2) {
    const maxPoints = 10000;
    const decimation = Math.max(1, Math.floor(numFrames / maxPoints));
    const nPoints = Math.floor(numFrames / decimation);
    const left = new Float64Array(nPoints);
    const right = new Float64Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      left[i] = channels[0][i * decimation];
      right[i] = channels[1][i * decimation];
    }
    stereoSamples = { left, right };
  }

  // Build average spectrum: ~200 log-spaced bins for display
  function buildAvgSpectrum(mags: Float64Array, half: number, sr: number, fft: number): { freqs: number[]; mags: number[] } {
    const binRes = sr / fft;
    // Log-spaced bins: 20Hz to nyquist, ~50 bins per decade
    const result: { freq: number; mag: number }[] = [];
    const nyquist = sr / 2;
    const bins = Math.min(200, half);
    for (let i = 0; i < bins; i++) {
      const freq = 20 * Math.pow(nyquist / 20, i / (bins - 1));
      const binIdx = Math.min(Math.round(freq / binRes), half - 1);
      if (binIdx < half) {
        const db = 10 * Math.log10(Math.max(mags[binIdx] * mags[binIdx], 1e-15));
        result.push({ freq, mag: db });
      }
    }
    return { freqs: result.map(r => r.freq), mags: result.map(r => r.mag) };
  }

  // Compute sub energy index: RMS of 20-60Hz normalized by overall RMS
  function buildSubEnergyIndex(mags: Float64Array, half: number, sr: number, fft: number): number {
    const binRes = sr / fft;
    let subEnergy = 0, subBins = 0;
    let totalEnergy = 0, totalBins = 0;
    for (let i = 1; i < half; i++) {
      const freq = i * binRes;
      const e = mags[i] * mags[i];
      totalEnergy += e;
      totalBins++;
      if (freq >= 20 && freq <= 60) {
        subEnergy += e;
        subBins++;
      }
    }
    if (totalBins === 0 || subBins === 0) return 0;
    const avgSub = subEnergy / subBins;
    const avgTotal = totalEnergy / totalBins;
    // Scale to match reference: ratio * 1000 for a readable index
    return Math.round((avgSub / Math.max(avgTotal, 1e-15)) * 1000 * 100) / 100;
  }

  return {
    waveform: { channel: waveformChannels, sampleRate, durationSec },
    crestFactorDB: Math.round(crestFactorDB * 10) / 10,
    peakToRms: Math.round((peak / Math.max(rms, 1e-10)) * 100) / 100,
    melSpectrogram: melSpecDB,
    melMinDB: Math.round(melMinDB),
    melMaxDB: Math.round(melMaxDB),
    melFreqs: melCenterFreqs,
    timeAxis,
    spectralCentroid,
    spectralRolloff,
    rmsEnergy,
    beats,
    bpm: Math.round(bpm),
    totalBeats,
    spectralBandwidth,
    zcr,
    loudnessDB,
    peakLevel: peak,
    clippingRatio,
    dynamicRangeDB,
    spectralCentroidHz: overallCentroid,
    bandwidthHz: overallBandwidth,
    bassRatio: totalE > 0 ? bassE / totalE : 0,
    midRatio: totalE > 0 ? midE / totalE : 0,
    trebleRatio: totalE > 0 ? trebleE / totalE : 0,
    stereoCorrelation: stereoCorr,
    stereoSamples,
    // Average spectrum (log-spaced bins for display)
    avgSpectrum: buildAvgSpectrum(accMags, halfFft, sampleRate, fftSize),
    subEnergyIndex: buildSubEnergyIndex(accMags, halfFft, sampleRate, fftSize),
    estimatedBitrateKbps: Math.round(estBitrate),
    sampleRate,
    channels: numChannels,
  };
}

// ─── Quality Scoring ────────────────────────────────────

export function analyzeQuality(metrics: DashboardData, genre: string = "Default"): AnalysisResult {
  const profile = getGenreProfile(genre);
  const metricResults: MetricResult[] = [];
  const tips: string[] = [];

  function pushMetric(name: string, value: number, formatted: string, threshold: [number, number], unit: string, tipFail?: string) {
    const min = threshold[0], max = threshold[1];
    let score: number, passed: boolean;
    if (value >= min && value <= max) { score = 100; passed = true; }
    else if (value < min) {
      score = Math.max(0, 100 - ((min - value) / Math.max(min, 0.01)) * 100);
      passed = score >= 50;
    } else {
      score = Math.max(0, 100 - ((value - max) / Math.max(2 * max, 0.01)) * 100);
      passed = score >= 50;
    }
    metricResults.push({ name, value: formatted, score: Math.round(score), passed, threshold: `${threshold[0]} - ${threshold[1]} ${unit}`, tip: !passed ? tipFail : undefined });
    if (tipFail && !passed) tips.push(tipFail);
  }

  function pushMinMetric(name: string, value: number, formatted: string, min: number, unit: string, tip?: string) {
    const passed = value >= min;
    const score = passed ? 100 : Math.round((value / Math.max(min, 0.01)) * 100);
    metricResults.push({ name, value: formatted, score, passed, threshold: `≥ ${min} ${unit}`, tip: !passed ? tip : undefined });
    if (tip && !passed) tips.push(tip);
  }

  function pushMaxMetric(name: string, value: number, formatted: string, max: number, unit: string, tip?: string) {
    const passed = value <= max;
    const score = passed ? 100 : Math.round(Math.max(0, (1 - (value - max) / max) * 100));
    metricResults.push({ name, value: formatted, score, passed, threshold: `≤ ${max} ${unit}`, tip: !passed ? tip : undefined });
    if (tip && !passed) tips.push(tip);
  }

  pushMetric("Loudness (RMS)", metrics.loudnessDB, `${metrics.loudnessDB.toFixed(1)} dB`, profile.targetLoudnessRange, "dB",
    metrics.loudnessDB < profile.targetLoudnessRange[0]
      ? `Track is too quiet. ${profile.label} targets ${profile.targetLoudnessRange[0]} to ${profile.targetLoudnessRange[1]} dB RMS. Increase gain or use a limiter at -1dB.`
      : `Track is too hot. ${profile.label} targets ${profile.targetLoudnessRange[0]} to ${profile.targetLoudnessRange[1]} dB RMS. Reduce master gain.`);

  pushMaxMetric("Clipping", metrics.clippingRatio, `${(metrics.clippingRatio * 100).toFixed(2)}%`, profile.maxClipping * 100, "%",
    `⚠️ ${(metrics.clippingRatio * 100).toFixed(1)}% of samples clipped! Apply a limiter at -0.3dB ceiling.`);

  pushMinMetric("Dynamic Range", metrics.dynamicRangeDB, `${metrics.dynamicRangeDB.toFixed(1)} dB`, profile.minDynamicRangeDB, "dB",
    `Dynamic range too narrow (${metrics.dynamicRangeDB.toFixed(1)} dB). ${profile.label} needs ≥ ${profile.minDynamicRangeDB} dB. Reduce compression.`);

  pushMinMetric("Bandwidth", metrics.bandwidthHz / 1000, `${(metrics.bandwidthHz / 1000).toFixed(1)} kHz`, profile.minBandwidthHz / 1000, "kHz",
    `High frequencies limited (${(metrics.bandwidthHz / 1000).toFixed(1)} kHz). ${profile.label} expects ≥ ${(profile.minBandwidthHz / 1000).toFixed(0)} kHz. Check export bitrate.`);

  pushMinMetric("Bass Energy", metrics.bassRatio * 100, `${(metrics.bassRatio * 100).toFixed(0)}%`, profile.minBassRatio * 100, "%",
    `Bass weak (${(metrics.bassRatio * 100).toFixed(0)}%). ${profile.label} needs ≥ ${(profile.minBassRatio * 100).toFixed(0)}%. Boost around 60-100Hz.`);

  pushMetric("Mid Range", metrics.midRatio * 100, `${(metrics.midRatio * 100).toFixed(0)}%`, [profile.targetMidRange[0] * 100, profile.targetMidRange[1] * 100], "%",
    metrics.midRatio < profile.targetMidRange[0]
      ? `Mid-range lacking (${(metrics.midRatio * 100).toFixed(0)}%). Try a gentle 1-3kHz boost.`
      : `Mid-range dominant (${(metrics.midRatio * 100).toFixed(0)}%). Cut around 2-4kHz.`);

  pushMinMetric("Treble / Air", metrics.trebleRatio * 100, `${(metrics.trebleRatio * 100).toFixed(0)}%`, profile.minTrebleRatio * 100, "%",
    `High-end dull (${(metrics.trebleRatio * 100).toFixed(0)}%). Try shelf boost above 8kHz.`);

  const corrMin = profile.minStereoCorrelation, corrMax = 0.95;
  const sPassed = metrics.stereoCorrelation >= corrMin && metrics.stereoCorrelation <= corrMax;
  const sScore = sPassed ? 100 : metrics.stereoCorrelation < corrMin ? Math.round((metrics.stereoCorrelation / corrMin) * 100) : Math.round(Math.max(0, 100 - ((metrics.stereoCorrelation - corrMax) / 0.05) * 100));
  metricResults.push({ name: "Stereo Correlation", value: metrics.stereoCorrelation.toFixed(2), score: sScore, passed: sPassed, threshold: `${corrMin.toFixed(1)} - ${corrMax.toFixed(1)}`,
    tip: metrics.stereoCorrelation < corrMin ? `Low stereo correlation (${metrics.stereoCorrelation.toFixed(2)}). Check phase on bass.` : metrics.stereoCorrelation > corrMax ? `High correlation (${metrics.stereoCorrelation.toFixed(2)}). Mix may sound mono.` : undefined });

  pushMinMetric("Sample Rate", metrics.sampleRate, `${(metrics.sampleRate / 1000).toFixed(0)} kHz`, 44100, "Hz",
    `Sample rate ${(metrics.sampleRate / 1000).toFixed(0)} kHz — below CD quality. Export at 44.1kHz+.`);

  const weights: Record<string, number> = { "Loudness (RMS)": 0.15, "Clipping": 0.20, "Dynamic Range": 0.15, "Bandwidth": 0.10, "Bass Energy": 0.10, "Mid Range": 0.08, "Treble / Air": 0.07, "Stereo Correlation": 0.07, "Sample Rate": 0.08 };
  let wSum = 0, wTotal = 0;
  for (const m of metricResults) { const w = weights[m.name] || 0.05; wSum += m.score * w; wTotal += w; }
  const overallScore = wTotal > 0 ? Math.round(wSum / wTotal) : 0;
  const passed = overallScore >= 90;

  const critical = metricResults.filter(m => !m.passed).sort((a, b) => a.score - b.score);
  const enhancementTips = [
    ...critical.map(m => m.tip).filter(Boolean) as string[],
    overallScore >= 90 ? `Your track meets industry standards for ${profile.label}. Ready to upload! 🎵` :
    overallScore >= 70 ? `Your track is close to ${profile.label} standards. Worth fixing the issues above.` :
    `Significant issues detected. Address critical items before uploading.`
  ];

  const summary = overallScore >= 90 ? `✅ Excellent quality! Score: ${overallScore}/100 — meets ${profile.label} standards.` :
    overallScore >= 70 ? `⚠️ Fair quality — Score: ${overallScore}/100. Some improvements recommended for ${profile.label}.` :
    `❌ Below industry standard — Score: ${overallScore}/100. Significant issues for ${profile.label}.`;

  return { overallScore, passed, genre: profile, metrics: metricResults, summary, enhancementTips, dashboard: metrics };
}

/** Main entry: decode a File and return full analysis */
export async function analyzeAudioFile(file: File, genre: string = "Default"): Promise<AnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    audioCtx.close();
  }
  const profile = getGenreProfile(genre);
  const metrics = analyzeAudioBuffer(audioBuffer);
  return analyzeQuality(metrics, genre);
}
