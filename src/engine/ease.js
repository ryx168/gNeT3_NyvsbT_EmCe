// Deterministic easing + math helpers shared by every department.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (x, a, b, c, d, doClamp = true) => {
  const t = (x - a) / (b - a);
  return lerp(c, d, doClamp ? clamp(t) : t);
};
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const inQuad = t => t * t;
export const outQuad = t => 1 - (1 - t) * (1 - t);
export const inOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const inOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const outCubic = t => 1 - Math.pow(1 - t, 3);
export const inCubic = t => t * t * t;
export const outExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const outBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const outElastic = t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
/** progress 0..1 of frame f between frames a and b (inclusive), eased */
export const seg = (f, a, b, fn = inOut) => fn(clamp((f - a) / Math.max(1, b - a)));
/** seeded deterministic RNG (mulberry32). Use instead of Math.random(). */
export function rng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 1D value noise, deterministic */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = n => { let s = Math.sin((n + seed * 131.7) * 12.9898) * 43758.5453; return s - Math.floor(s); };
  return lerp(h(i), h(i + 1), f * f * (3 - 2 * f));
}
