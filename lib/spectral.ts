/**
 * Pure TypeScript FFT and spectral analysis helpers.
 * No native dependencies.
 */

export interface Complex {
  re: number;
  im: number;
}

export interface FingerprintResult {
  hashes: number[];
  durationSeconds: number;
}

// Cooley-Tukey iterative FFT
export function fft(signal: number[]): Complex[] {
  const n = signal.length;
  if (n <= 1) return [{ re: signal[0] || 0, im: 0 }];

  // Bit-reversal permutation
  const result: Complex[] = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = { re: signal[i], im: 0 };
  }

  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    let k = n >> 1;
    while (k > 0 && j & k) {
      j ^= k;
      k >>= 1;
    }
    j |= k;
  }

  // Butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wlen = { re: Math.cos(angle), im: Math.sin(angle) };
    for (let i = 0; i < n; i += len) {
      let w: Complex = { re: 1, im: 0 };
      for (let k = 0; k < len / 2; k++) {
        const u = result[i + k];
        const vIdx = i + k + len / 2;
        const t: Complex = {
          re: w.re * result[vIdx].re - w.im * result[vIdx].im,
          im: w.re * result[vIdx].im + w.im * result[vIdx].re,
        };
        result[i + k] = { re: u.re + t.re, im: u.im + t.im };
        result[vIdx] = { re: u.re - t.re, im: u.im - t.im };
        const wRe = w.re * wlen.re - w.im * wlen.im;
        w.im = w.re * wlen.im + w.im * wlen.re;
        w.re = wRe;
      }
    }
  }

  return result;
}

// Hanning window
export function applyWindow(frame: number[]): number[] {
  const n = frame.length;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    out[i] = frame[i] * w;
  }
  return out;
}

// Magnitude spectrum from FFT complex output
export function magnitudeSpectrum(complex: Complex[]): number[] {
  return complex.map((c) => Math.sqrt(c.re * c.re + c.im * c.im));
}

// Find local spectral peaks in a single frame
// Returns array of bin indices
export function findPeaks(magnitudes: number[], _sampleRate: number, binCountToConsider?: number): number[] {
  const peaks: { bin: number; magnitude: number }[] = [];
  const n = binCountToConsider || magnitudes.length;
  for (let i = 1; i < n - 1; i++) {
    if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
      peaks.push({ bin: i, magnitude: magnitudes[i] });
    }
  }
  // Sort by magnitude descending, keep top 6
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  const top = peaks.slice(0, 6);
  return top.map((p) => p.bin);
}

// Hash pairs of peaks into a compact integer fingerprint
export function hashPeakPairs(peaks: number[], timeOffset: number): number[] {
  const hashes: number[] = [];
  const len = peaks.length;
  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      // Combine two peak bins and time offset into a 32-bit hash
      const h = ((peaks[i] * 9973 + peaks[j] * 73856093 + timeOffset * 19349663) & 0x7fffffff);
      hashes.push(h);
    }
  }
  return hashes;
}

// Main fingerprinting pipeline:
//   pcmFloats: Array of float samples (mono, [-1, 1])
//   sampleRate: e.g. 22050
// Returns { hashes: number[], durationSeconds: number }
export function fingerprint(pcmFloats: number[], sampleRate = 22050): FingerprintResult {
  const frameSize = 2048;
  const hopSize = 1024;
  const durationSeconds = pcmFloats.length / sampleRate;

  const allHashes: number[] = [];
  let timeFrame = 0;

  for (let start = 0; start + frameSize <= pcmFloats.length; start += hopSize) {
    const frame = pcmFloats.slice(start, start + frameSize);
    const windowed = applyWindow(frame);
    const complex = fft(windowed);
    const mags = magnitudeSpectrum(complex);
    // Consider only lower half of spectrum (0 - nyquist)
    const binCount = frameSize / 2;
    const peaks = findPeaks(mags, sampleRate, binCount);
    const hashes = hashPeakPairs(peaks, timeFrame);
    allHashes.push(...hashes);
    timeFrame++;
  }

  return {
    hashes: allHashes,
    durationSeconds,
  };
}

// Jaccard-ish similarity between two hash arrays
// Uses the proportion of matching hashes in the smaller set
export function similarity(aHashes: number[], bHashes: number[]): number {
  if (!aHashes.length || !bHashes.length) return 0;
  const setA = new Set(aHashes);
  const setB = new Set(bHashes);
  let intersection = 0;
  for (const h of setA) {
    if (setB.has(h)) intersection++;
  }
  const minSize = Math.min(setA.size, setB.size);
  if (minSize === 0) return 0;
  return intersection / minSize;
}
