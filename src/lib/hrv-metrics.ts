// ===== HRV METRICS ENGINE =====
// All computation runs client-side from raw RR interval arrays
// This module is the candidate for extraction to a shared npm package
// consumed by both the capacity-assessment-app and the neuroreport-app

export interface HRVMetrics {
  // Time domain
  meanRR: number;
  meanHR: number;
  rmssd: number;
  sdnn: number;
  pnn50: number;
  nn50: number;
  // Frequency domain (simplified — production should use proper FFT)
  totalPower: number;
  lfPower: number;
  hfPower: number;
  vlfPower: number;
  lfHfRatio: number;
  lfNu: number;
  hfNu: number;
  // Respiratory
  breathRate: number;
  // Nonlinear
  sampEn: number;
  dfaA1: number;
  // Composite
  coherence: number;
  stressIdx: number;
  // Meta
  rrCount: number;
}

export function sampleEntropy(data: number[], m = 2, rFactor = 0.2): number {
  const n = data.length;
  if (n < 20) return 1.5;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(data.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n);
  const r = rFactor * sd;
  if (r === 0) return 0;

  let A = 0, B = 0;
  for (let i = 0; i < n - m; i++) {
    for (let j = i + 1; j < n - m; j++) {
      let match = true;
      for (let k = 0; k < m; k++) {
        if (Math.abs(data[i + k] - data[j + k]) > r) { match = false; break; }
      }
      if (match) {
        B++;
        if (i + m < n && j + m < n && Math.abs(data[i + m] - data[j + m]) <= r) A++;
      }
    }
  }
  if (B === 0 || A === 0) return 2.0;
  return Math.round(-Math.log(A / B) * 100) / 100;
}

export function dfaAlpha1(data: number[]): number {
  const n = data.length;
  if (n < 20) return 1.0;
  const mean = data.reduce((a, b) => a + b, 0) / n;

  // Integrate
  const y: number[] = [];
  let cum = 0;
  for (let i = 0; i < n; i++) { cum += data[i] - mean; y.push(cum); }

  const boxSizes = [4, 5, 6, 7, 8, 10, 12, 16];
  const logN: number[] = [], logF: number[] = [];

  for (const bs of boxSizes) {
    if (bs > n / 4) continue;
    const nb = Math.floor(n / bs);
    let totalFluc = 0;
    for (let b = 0; b < nb; b++) {
      const s = b * bs;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < bs; i++) {
        sx += i; sy += y[s + i]; sxy += i * y[s + i]; sx2 += i * i;
      }
      const slope = (bs * sxy - sx * sy) / (bs * sx2 - sx * sx);
      const intercept = (sy - slope * sx) / bs;
      let fluc = 0;
      for (let i = 0; i < bs; i++) fluc += (y[s + i] - (slope * i + intercept)) ** 2;
      totalFluc += fluc / bs;
    }
    logN.push(Math.log(bs));
    logF.push(Math.log(Math.sqrt(totalFluc / nb)));
  }

  if (logN.length < 2) return 1.0;
  const nn = logN.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < nn; i++) {
    sx += logN[i]; sy += logF[i]; sxy += logN[i] * logF[i]; sx2 += logN[i] * logN[i];
  }
  return Math.round((nn * sxy - sx * sy) / (nn * sx2 - sx * sx) * 100) / 100;
}

export function coherenceRatio(rr: number[]): number {
  const n = rr.length;
  if (n < 20) return 50;
  const mean = rr.reduce((a, b) => a + b, 0) / n;
  const totalVar = rr.map(r => (r - mean) ** 2).reduce((a, b) => a + b, 0) / n;
  if (totalVar === 0) return 0;

  let maxCorr = 0;
  for (let lag = 3; lag < Math.min(n / 2, 30); lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += (rr[i] - mean) * (rr[i + lag] - mean);
    corr /= (n - lag);
    if (corr > maxCorr) maxCorr = corr;
  }
  return Math.round(Math.max(0, Math.min(100, (maxCorr / totalVar) * 100)) * 10) / 10;
}

export function stressIndex(rr: number[]): number {
  if (rr.length < 10) return 0;
  const binWidth = 50;
  const bins: Record<number, number> = {};
  let minRR = Infinity, maxRR = -Infinity;

  for (const r of rr) {
    const bin = Math.round(r / binWidth) * binWidth;
    bins[bin] = (bins[bin] || 0) + 1;
    minRR = Math.min(minRR, r);
    maxRR = Math.max(maxRR, r);
  }

  let modeBin = 0, modeCount = 0;
  for (const [bin, count] of Object.entries(bins)) {
    if (count > modeCount) { modeCount = count; modeBin = Number(bin); }
  }

  const Mo = modeBin / 1000;
  const AMo = (modeCount / rr.length) * 100;
  const MxDMn = (maxRR - minRR) / 1000;
  if (Mo === 0 || MxDMn === 0) return 0;
  return Math.round(AMo / (2 * Mo * MxDMn));
}

export function computeAllMetrics(rr: number[]): HRVMetrics | null {
  if (!rr || rr.length < 10) return null;

  const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
  const meanHR = 60000 / meanRR;
  const diffs: number[] = [];
  for (let i = 1; i < rr.length; i++) diffs.push(rr[i] - rr[i - 1]);

  const rmssd = Math.sqrt(diffs.map(d => d * d).reduce((a, b) => a + b, 0) / diffs.length);
  const sdnn = Math.sqrt(rr.map(r => (r - meanRR) ** 2).reduce((a, b) => a + b, 0) / rr.length);
  const nn50 = diffs.filter(d => Math.abs(d) > 50).length;
  const pnn50 = (nn50 / diffs.length) * 100;

  // Frequency domain (simplified)
  const totalPower = sdnn * sdnn;
  const hfPower = rmssd * rmssd * 0.38;
  const lfPower = totalPower * 0.34;
  const vlfPower = Math.max(0, totalPower - lfPower - hfPower);
  const lfHfRatio = hfPower > 0.01 ? lfPower / hfPower : 0;
  const lfNu = lfPower + hfPower > 0 ? (lfPower / (lfPower + hfPower)) * 100 : 50;

  // Breath rate estimate
  let breathRate = 14;
  if (rr.length > 30) {
    let zeroCrossings = 0;
    const detrended = rr.map(r => r - meanRR);
    for (let i = 1; i < detrended.length; i++) {
      if ((detrended[i] >= 0 && detrended[i - 1] < 0) || (detrended[i] < 0 && detrended[i - 1] >= 0)) zeroCrossings++;
    }
    breathRate = Math.max(6, Math.min(25, (zeroCrossings / 2) / (rr.reduce((a, b) => a + b, 0) / 60000)));
  }

  return {
    meanRR: Math.round(meanRR),
    meanHR: Math.round(meanHR * 10) / 10,
    rmssd: Math.round(rmssd * 10) / 10,
    sdnn: Math.round(sdnn * 10) / 10,
    pnn50: Math.round(pnn50 * 10) / 10,
    nn50,
    totalPower: Math.round(totalPower),
    lfPower: Math.round(lfPower),
    hfPower: Math.round(hfPower),
    vlfPower: Math.round(vlfPower),
    lfHfRatio: Math.round(lfHfRatio * 100) / 100,
    lfNu: Math.round(lfNu * 10) / 10,
    hfNu: Math.round((100 - lfNu) * 10) / 10,
    breathRate: Math.round(breathRate * 10) / 10,
    sampEn: sampleEntropy(rr),
    dfaA1: dfaAlpha1(rr),
    coherence: coherenceRatio(rr),
    stressIdx: stressIndex(rr),
    rrCount: rr.length,
  };
}
