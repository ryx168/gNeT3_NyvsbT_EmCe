// SOUND department — procedural score + ambience for 晨光列車 / First Light Express
//   node audio/synth.mjs          -> audio/score.wav   (16-bit stereo, 44.1 kHz, exactly 79.000 s)
// Pure Node, no npm deps, fully deterministic (seeded noise). Structured to bible/shots.json:
//   0–11 s   rain + distant city hum                              (shots 01–03, night city)
//   11–27 s  train arrives / door hiss / clack rhythm + minor pad  (shots 04–07, night ride)
//   27–49 s  swelling warm pad + plucked piano melody, reverb      (shots 08–11, tunnel → dawn → sakura)
//   49–69 s  major-key resolution + sea waves + gull chirps        (shots 12–16, coast → the throw)
//   69–79 s  held chord resolves, everything fades to silence      (shots 17–18, new day → credits)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const DUR = 79.0;
const N = Math.round(SR * DUR);               // 3,483,900 frames
const L = new Float64Array(N);
const R = new Float64Array(N);
const TWO_PI = Math.PI * 2;

// ---------- utilities ----------
function rng(seed) {                           // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
/** piecewise-linear envelope over absolute seconds: [[t, v], ...] */
function pwl(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) { const [t0, v0] = points[i - 1], [t1, v1] = points[i]; return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0)); }
    }
    return points[points.length - 1][1];
  };
}
const lpCoef = (fc) => 1 - Math.exp(-TWO_PI * fc / SR);
function mix(i, v, pan = 0) {                  // pan -1..1, equal-power
  const th = (pan + 1) * Math.PI / 4;
  L[i] += v * Math.cos(th); R[i] += v * Math.sin(th);
}

// ---------- 1. rain + city (0–15 s, full until 11 s, gone inside the train) ----------
function rain() {
  const r = rng(101);
  const amp = pwl([[0, 0], [1.6, 1], [10.5, 1], [12.5, 0.45], [15.0, 0]]);
  let lpL = 0, lpR = 0, hpL = 0, hpR = 0, lp2L = 0, lp2R = 0;
  const aLP = lpCoef(3800), aHP = lpCoef(420), aLP2 = lpCoef(9000);
  let dropL = 0, dropR = 0;                    // droplet transient states
  const end = Math.min(N, 15.2 * SR | 0);
  for (let i = 0; i < end; i++) {
    const t = i / SR;
    const a = amp(t);
    if (a <= 0) continue;
    // steady sheet of rain: band-limited noise with slow density flutter
    const wL = r() * 2 - 1, wR = r() * 2 - 1;
    lpL += aLP * (wL - lpL); lpR += aLP * (wR - lpR);
    hpL += aHP * (lpL - hpL); hpR += aHP * (lpR - hpR);
    const flutter = 0.82 + 0.18 * Math.sin(TWO_PI * t * 0.23) * Math.sin(TWO_PI * t * 0.071 + 1.3);
    let sL = (lpL - hpL) * 0.11 * flutter, sR = (lpR - hpR) * 0.11 * flutter;
    // droplets on glass / umbrella: short bright ticks
    if (r() < 38 / SR) dropL = 0.18 + 0.25 * r();
    if (r() < 38 / SR) dropR = 0.18 + 0.25 * r();
    const dL = (r() * 2 - 1) * dropL, dR = (r() * 2 - 1) * dropR;
    lp2L += aLP2 * (dL - lp2L); lp2R += aLP2 * (dR - lp2R);
    dropL *= 0.9985; dropR *= 0.9985;
    sL += lp2L * 0.9; sR += lp2R * 0.9;
    L[i] += sL * a; R[i] += sR * a;
  }
}
function cityHum() {
  const r = rng(202);
  const amp = pwl([[0, 0], [2.0, 1], [10.0, 1], [13.0, 0.5], [15.5, 0]]);
  let lp = 0, hp = 0; const aLP = lpCoef(600), aHP = lpCoef(180);
  const end = Math.min(N, 15.6 * SR | 0);
  for (let i = 0; i < end; i++) {
    const t = i / SR; const a = amp(t); if (a <= 0) continue;
    const hum = Math.sin(TWO_PI * 49.5 * t) * 0.022 + Math.sin(TWO_PI * 99.5 * t + 0.4) * 0.012 + Math.sin(TWO_PI * 61 * t) * 0.01;
    const w = r() * 2 - 1; lp += aLP * (w - lp); hp += aHP * (lp - hp);
    const traffic = (lp - hp) * 0.05 * (0.6 + 0.4 * Math.sin(TWO_PI * t * 0.09 + 2));
    const v = (hum + traffic) * a;
    L[i] += v * 0.9; R[i] += v * 1.0;
  }
}

// ---------- 2. train: clack rhythm, rumble, hiss, tunnel whoosh ----------
function clackAt(t0, strength, pan) {
  // one "ka-tak": two low filtered-noise thumps 85 ms apart + a 58 Hz body knock
  const r = rng(Math.floor(t0 * 1000) + 7);
  for (let k = 0; k < 2; k++) {
    const st = t0 + k * 0.085, s0 = Math.floor(st * SR), len = Math.floor(0.11 * SR);
    const g = strength * (k === 0 ? 1 : 0.7);
    let lp = 0; const aLP = lpCoef(k === 0 ? 260 : 420);
    for (let n = 0; n < len; n++) {
      const i = s0 + n; if (i >= N) break;
      const e = Math.exp(-n / (SR * 0.028));
      const w = r() * 2 - 1; lp += aLP * (w - lp);
      const knock = Math.sin(TWO_PI * 58 * (n / SR)) * Math.exp(-n / (SR * 0.05)) * 0.6;
      mix(i, (lp * 1.6 + knock) * e * g, pan);
    }
  }
}
function train() {
  // arrival (shot04 at 11 s): decelerating clacks, stop at ~13.2 s
  let t = 11.0, iv = 0.55;
  while (t < 13.2) { clackAt(t, 0.32 * (1 - (t - 11) / 2.6 * 0.5), -0.3 + (t - 11) * 0.2); iv *= 1.22; t += iv; }
  // departure (shot05 15 s): accelerating to cruise 0.42 s, then cruise until the seaside station (53 s)
  t = 15.6; iv = 1.5;
  const level = pwl([[15, 0.2], [20, 0.34], [27, 0.34], [28, 0.22], [49, 0.22], [52, 0.16], [53.5, 0.0]]);
  while (t < 53.5) { clackAt(t, level(t), Math.sin(t * 0.7) * 0.25); iv = Math.max(0.42, iv * 0.86); t += iv; }
  // pulls away behind Yuki (shot14, 55–60 s): accelerating, receding
  t = 55.2; iv = 1.2;
  while (t < 60.5) { clackAt(t, 0.16 * (1 - (t - 55.2) / 5.3), 0.6); iv = Math.max(0.42, iv * 0.82); t += iv; }

  // rolling rumble while moving
  const r = rng(303);
  const rum = pwl([[11, 0.35], [13.2, 0.1], [15.5, 0.1], [19, 1], [25.5, 1], [26.6, 1.9], [27.2, 1.1], [28, 0.65], [49, 0.65], [53, 0.0], [55.2, 0.0], [56, 0.3], [60.5, 0]]);
  let lp = 0, lp2 = 0; const a1 = lpCoef(90), a2 = lpCoef(140);
  for (let i = Math.floor(11 * SR); i < Math.min(N, 61 * SR | 0); i++) {
    const t = i / SR; const g = rum(t); if (g <= 0) continue;
    const w = r() * 2 - 1; lp += a1 * (w - lp); lp2 += a2 * (lp - lp2);
    const v = lp2 * 1.4 * 0.08 * g;
    L[i] += v; R[i] += v * 0.95;
  }
  // brake / door hiss at the platform (12.6–14.6 s) and door at the seaside station (53.3–54.6 s)
  hiss(12.6, 2.0, 0.07, 404);
  hiss(53.3, 1.3, 0.045, 405);
  // tunnel mouth whoosh (26.4–27.6 s): wideband swell as the train bursts into the blue hour
  const r2 = rng(505); let h1 = 0, h2 = 0; const b1 = lpCoef(1800), b2 = lpCoef(300);
  const wh = pwl([[26.3, 0], [27.0, 1], [27.7, 0]]);
  for (let i = Math.floor(26.3 * SR); i < Math.floor(27.8 * SR); i++) {
    const t = i / SR; const g = wh(t); if (g <= 0) continue;
    const w = r2() * 2 - 1; h1 += b1 * (w - h1); h2 += b2 * (h1 - h2);
    const v = (h1 - h2) * 0.16 * g;
    L[i] += v * (1 - g * 0.3); R[i] += v * (0.7 + g * 0.3);
  }
}
function hiss(t0, dur, amp, seed) {
  const r = rng(seed); let lp = 0, hp = 0; const a = lpCoef(6000), b = lpCoef(1500);
  const s0 = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  for (let n = 0; n < len; n++) {
    const i = s0 + n; if (i >= N) break;
    const p = n / len; const e = Math.sin(Math.PI * Math.pow(p, 0.6));
    const w = r() * 2 - 1; lp += a * (w - lp); hp += b * (lp - hp);
    const v = (lp - hp) * amp * e;
    L[i] += v * 0.8; R[i] += v;
  }
}

// ---------- 3. pads ----------
/** soft additive pad note; `warm` 0..1 adds upper harmonics (night pad is dark, dawn pad is warm) */
function padNote(t0, t1, m, amp, attack, release, warm, seed) {
  const f = midi(m);
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, Math.floor((t1 + release) * SR));
  const h2 = 0.18 + 0.25 * warm, h3 = 0.05 + 0.12 * warm, h4 = 0.02 + 0.06 * warm;
  const det = [-0.0032, 0, 0.0032];                      // three detuned voices ≈ ±5.5 cents
  const pans = [-0.55, 0, 0.55];
  let ph = [0, 0, 0];
  const lfoRate = 0.11 + (seed % 7) * 0.013, lfoPh = seed * 1.7;
  for (let i = s0; i < s1; i++) {
    const t = i / SR;
    const e = Math.min(1, (t - t0) / attack) * (t > t1 ? Math.max(0, 1 - (t - t1) / release) : 1);
    const env = smooth(e);
    if (env <= 0) continue;
    const vib = 1 + 0.0015 * Math.sin(TWO_PI * lfoRate * t + lfoPh);
    for (let v = 0; v < 3; v++) {
      ph[v] += TWO_PI * f * (1 + det[v]) * vib / SR;
      const p = ph[v];
      const s = Math.sin(p) + h2 * Math.sin(2 * p) + h3 * Math.sin(3 * p) + h4 * Math.sin(4 * p);
      mix(i, s * amp * env / 3, pans[v]);
    }
  }
}
function chord(t0, t1, notes, amp, attack, release, warm) {
  notes.forEach((m, k) => padNote(t0, t1, m, amp * (k === 0 ? 0.8 : 1), attack, release, warm, (t0 * 10 | 0) + k));
}
function pads() {
  // night ride, A minor, dark (15–27 s)
  const night = [
    [15.0, 19.0, [45, 57, 60, 64]],   // Am
    [19.0, 23.0, [41, 57, 60, 65]],   // Fmaj7
    [23.0, 27.0, [50, 57, 62, 65]],   // Dm
  ];
  for (const [a, b, n] of night) chord(a, b, n, 0.046, 2.2, 2.6, 0.1);
  // dawn, swelling warm (27–49 s)
  const dawn = [
    [27.0, 31.0, [45, 57, 60, 64], 0.055],  // Am
    [31.0, 35.0, [41, 57, 60, 65], 0.062],  // F
    [35.0, 39.0, [48, 55, 60, 64], 0.072],  // C
    [39.0, 43.0, [43, 55, 59, 62], 0.080],  // G
    [43.0, 46.5, [45, 57, 60, 64], 0.086],  // Am
    [46.5, 49.0, [41, 57, 60, 65], 0.090],  // F
  ];
  for (const [a, b, n, g] of dawn) chord(a, b, n, g, 1.6, 2.2, 0.75);
  // sea morning, bright major (49–69 s)
  const sea = [
    [49.0, 53.0, [48, 55, 60, 64, 67], 0.095],  // C
    [53.0, 57.0, [43, 55, 59, 62, 67], 0.090],  // G
    [57.0, 61.0, [45, 57, 60, 64, 67], 0.088],  // Am7
    [61.0, 65.0, [41, 57, 60, 65, 69], 0.090],  // Fmaj7
    [65.0, 69.0, [48, 55, 60, 64, 67], 0.092],  // C
  ];
  for (const [a, b, n, g] of sea) chord(a, b, n, g, 1.2, 1.8, 1.0);
  // held chord: G/F suspension (69–72.5) resolving to Cadd9 (72.5–78), release into silence
  chord(69.0, 72.5, [43, 53, 57, 62, 67], 0.085, 1.5, 1.2, 0.8);
  chord(72.5, 77.0, [48, 55, 62, 64, 67, 74], 0.090, 1.4, 2.0, 0.7);
}

// ---------- 4. piano-like plucks -> reverb bus ----------
const PL = new Float64Array(N), PR = new Float64Array(N);
function pluck(t0, m, dur, vel, pan = 0) {
  const f = midi(m);
  const s0 = Math.floor(t0 * SR);
  const tau = clamp(0.35 + dur * 0.45, 0.4, 1.6);
  const len = Math.min(N - s0, Math.floor((dur + 1.8) * SR));
  const H = [1, 0.5, 0.28, 0.17, 0.1, 0.06];
  const th = (pan + 1) * Math.PI / 4, gL = Math.cos(th), gR = Math.sin(th);
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const att = Math.min(1, t / 0.004);
    const rel = t > dur ? Math.exp(-(t - dur) / 0.35) : 1;
    let s = 0;
    for (let h = 0; h < H.length; h++) {
      const k = h + 1;
      s += H[h] * Math.sin(TWO_PI * f * k * (1 + 0.0004 * k * k) * t) * Math.exp(-t / (tau / Math.sqrt(k)));
    }
    s *= att * rel * vel * 0.16;
    // soft hammer: a touch of filtered noise in the first 6 ms
    const v = s;
    PL[s0 + n] += v * gL; PR[s0 + n] += v * gR;
  }
}
function melody() {
  // dawn melody (A minor / C major pentatonic), unhurried
  const dawn = [
    [28.0, 76, 1.2, 0.55], [29.5, 74, 0.5, 0.45], [30.0, 72, 1.5, 0.6],
    [32.0, 69, 0.8, 0.5], [33.0, 72, 0.8, 0.55], [34.0, 74, 1.8, 0.62],
    [36.0, 76, 1.2, 0.66], [37.5, 79, 0.5, 0.55], [38.0, 76, 1.8, 0.68],
    [40.0, 74, 0.8, 0.6], [41.0, 72, 0.8, 0.6], [42.0, 74, 1.8, 0.66],
    [44.0, 76, 1.0, 0.7], [45.0, 79, 1.0, 0.72], [46.0, 81, 2.0, 0.78],
    [48.0, 79, 1.0, 0.7],
  ];
  // sea melody: brighter, an octave up, resolves on C
  const sea = [
    [49.5, 84, 1.0, 0.8], [50.5, 83, 0.5, 0.6], [51.0, 79, 1.5, 0.72],
    [53.0, 76, 1.0, 0.62], [54.0, 79, 1.0, 0.66], [55.0, 81, 1.8, 0.74],
    [57.0, 79, 1.0, 0.66], [58.0, 76, 1.0, 0.62], [59.0, 74, 1.5, 0.64],
    [61.0, 72, 1.0, 0.6], [62.0, 74, 1.0, 0.62], [63.0, 76, 2.0, 0.7],
    [65.0, 79, 1.0, 0.7], [66.0, 76, 1.0, 0.64], [67.0, 74, 1.5, 0.62],
    [69.0, 72, 3.0, 0.66],                                   // lands on C as the chord holds
    [72.5, 72, 3.0, 0.5], [72.5, 76, 3.0, 0.42], [72.5, 79, 3.0, 0.4],   // soft resolving triad
    [74.6, 84, 3.5, 0.42],                                   // one last high C, left to ring
  ];
  for (const [t, m, d, v] of dawn) pluck(t, m, d, v, (m - 76) / 14);
  for (const [t, m, d, v] of sea) pluck(t, m, d, v, (m - 78) / 14);
  // left hand: root of each chord, an octave below, soft
  const bass = [[27, 45], [31, 41], [35, 48], [39, 43], [43, 45], [46.5, 41], [49, 48], [53, 43], [57, 45], [61, 41], [65, 48], [69, 43], [72.5, 48]];
  for (const [t, m] of bass) pluck(t + 0.02, m, 2.4, 0.5, -0.15);
}
/** Schroeder-style reverb: 4 feedback comb delays (with lowpass in the loop) + 2 allpasses, per channel. */
function reverb(inL, inR, wet, roomScale = 1.0) {
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => Math.floor(d * roomScale * SR));
  const aps = [0.005, 0.0017].map((d) => Math.floor(d * SR));
  const fb = 0.84, damp = lpCoef(3200), apg = 0.7;
  const run = (input, out, offset) => {
    const cb = combs.map((n) => ({ buf: new Float64Array(n + offset), n: n + offset, i: 0, lp: 0 }));
    const ab = aps.map((n) => ({ buf: new Float64Array(n), n, i: 0 }));
    for (let s = 0; s < N; s++) {
      const x = input[s];
      let y = 0;
      for (const c of cb) {
        const r = c.buf[c.i];
        c.lp += damp * (r - c.lp);
        c.buf[c.i] = x + c.lp * fb;
        c.i = (c.i + 1) % c.n;
        y += r;
      }
      y *= 0.25;
      for (const a of ab) {                      // Schroeder allpass: out = -x + buf; buf = x + g*buf
        const r = a.buf[a.i];
        const o = -y + r;
        a.buf[a.i] = y + r * apg;
        a.i = (a.i + 1) % a.n;
        y = o;
      }
      out[s] += x + y * wet;
    }
  };
  run(inL, L, 0); run(inR, R, 23);               // slightly different comb lengths per side -> stereo tail
}

// ---------- 5. sea, wind, gulls ----------
function sea() {
  const r = rng(606);
  const amp = pwl([[48.5, 0], [52.5, 1], [69, 1], [73, 0.7], [78.2, 0]]);
  let p0 = 0, p1 = 0, p2 = 0, lp = 0, hp = 0;
  const a0 = lpCoef(40), a1 = lpCoef(400), a2 = lpCoef(2400), aLP = lpCoef(1100), aHP = lpCoef(90);
  let lpR = 0;
  for (let i = Math.floor(48.5 * SR); i < Math.min(N, 78.3 * SR | 0); i++) {
    const t = i / SR; const g = amp(t); if (g <= 0) continue;
    // pink-ish noise (three one-poles summed) -> band
    const w = r() * 2 - 1;
    p0 += a0 * (w - p0); p1 += a1 * (w - p1); p2 += a2 * (w - p2);
    const pink = (p0 * 3.2 + p1 * 1.4 + p2 * 0.6 + w * 0.15);
    lp += aLP * (pink - lp); hp += aHP * (lp - hp);
    // slow swell: a 8.5 s wave with a 13 s underswell; rises fast, falls slow
    const ph = (t * (1 / 8.5)) % 1, ph2 = (t * (1 / 13.0) + 0.4) % 1;
    const wave = Math.pow(0.5 + 0.5 * Math.sin(TWO_PI * ph - Math.PI / 2), 1.7);
    const under = 0.5 + 0.5 * Math.sin(TWO_PI * ph2);
    const swell = 0.35 + 0.65 * (wave * 0.75 + under * 0.25);
    const brightness = 0.3 + 0.7 * wave;        // foam hiss rides the crest
    const v = (lp - hp) * 0.19 * swell * g;
    lpR += 0.5 * ((lp - hp) - lpR);              // decorrelate the right channel a little
    L[i] += v; R[i] += (lpR * 0.19 * swell * g) * (0.9 + 0.1 * brightness);
  }
}
function wind() {
  const r = rng(707); let lp = 0, hp = 0; const a = lpCoef(1400), b = lpCoef(260);
  const amp = pwl([[52.5, 0], [54.5, 1], [60, 1], [62, 0.35], [69, 0.35], [74, 0]]);
  for (let i = Math.floor(52.5 * SR); i < Math.min(N, 74.1 * SR | 0); i++) {
    const t = i / SR; const g = amp(t); if (g <= 0) continue;
    const w = r() * 2 - 1; lp += a * (w - lp); hp += b * (lp - hp);
    const gust = 0.55 + 0.45 * Math.sin(TWO_PI * t * 0.13 + 1) * Math.sin(TWO_PI * t * 0.047);
    const v = (lp - hp) * 0.05 * gust * g;
    L[i] += v * 1.0; R[i] += v * 0.85;
  }
}
function gull(t0, pan, seed) {
  const r = rng(seed);
  const n = 1 + Math.floor(r() * 3);             // 1–3 cries
  for (let k = 0; k < n; k++) {
    const st = t0 + k * (0.22 + r() * 0.12), dur = 0.14 + r() * 0.1;
    const f0 = 2300 + r() * 500, f1 = f0 * (0.62 + r() * 0.12);
    const s0 = Math.floor(st * SR), len = Math.floor(dur * SR);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const p = i / len; const t = i / SR;
      const f = f0 + (f1 - f0) * Math.pow(p, 0.8) + 70 * Math.sin(TWO_PI * 38 * t);
      ph += TWO_PI * f / SR;
      const e = Math.pow(Math.sin(Math.PI * p), 1.4);
      const s = (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * e * 0.05 * (0.7 + 0.3 * r());
      if (s0 + i < N) mix(s0 + i, s, pan);
    }
  }
}
function gulls() {
  const r = rng(808);
  const times = [53.6, 55.1, 56.9, 58.4, 60.2, 62.0, 63.7, 65.3, 66.6, 68.1];
  times.forEach((t, k) => gull(t + r() * 0.3, (r() * 2 - 1) * 0.8, 900 + k));
}

// ---------- render ----------
console.time('synth');
rain(); cityHum();
train();
pads();
melody();
reverb(PL, PR, 0.42);
sea(); wind(); gulls();

// master: gentle soft-knee, normalise to -1.5 dBFS, global fades
let peak = 0;
for (let i = 0; i < N; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > peak) peak = a; if (b > peak) peak = b; }
const target = Math.pow(10, -1.5 / 20);          // 0.841
const g = peak > 0 ? target / peak : 1;
const fadeIn = pwl([[0, 0], [0.6, 1]]), fadeOut = pwl([[DUR - 2.0, 1], [DUR - 0.05, 0]]);
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8);
out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 4, 40);
let outPeak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, f = fadeIn(t) * fadeOut(t);
  let l = L[i] * g * f, r = R[i] * g * f;
  // safety soft clip (never engages below the target peak)
  if (l > 0.95) l = 0.95 + Math.tanh(l - 0.95) * 0.04; else if (l < -0.95) l = -0.95 - Math.tanh(-l - 0.95) * 0.04;
  if (r > 0.95) r = 0.95 + Math.tanh(r - 0.95) * 0.04; else if (r < -0.95) r = -0.95 - Math.tanh(-r - 0.95) * 0.04;
  const al = Math.abs(l), ar = Math.abs(r); if (al > outPeak) outPeak = al; if (ar > outPeak) outPeak = ar;
  out.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'score.wav');
fs.writeFileSync(outPath, out);
console.timeEnd('synth');
console.log(`wrote ${outPath}: ${(out.length / 1e6).toFixed(2)} MB, ${N} frames = ${(N / SR).toFixed(3)} s, raw peak ${peak.toFixed(3)} -> ${(20 * Math.log10(outPeak)).toFixed(2)} dBFS`);
