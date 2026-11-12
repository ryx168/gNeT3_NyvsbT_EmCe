// SCREENPLAY / TITLES department — 晨光列車 / First Light Express
// All on-screen text for the film: opening title, bilingual subtitle cues, the 新的一天 card and the credits.
//
// Contract (do not change): the engine calls `update({ overlay, shot, local, global, t, fps, width, height })`
// after every rendered frame with the 1920×1080 HTML overlay div (CJK system font already set on it).
// Everything here is a pure function of `local` (frame index inside the shot): no CSS transitions, no
// animations, no timers, no randomness. The overlay is rebuilt from scratch every frame, so a given frame
// always produces the same DOM.
//
// Cue times are LOCAL frames (0-based inside the shot), inclusive. `from`/`to` are the first/last frame on
// which the cue is visible at all; `fadeIn`/`fadeOut` are the ramp lengths in frames (default 8).

// single quotes only: these land inside double-quoted style="" attributes
const FONT_CJK = "'Microsoft JhengHei Light', 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans CJK TC', 'Hiragino Sans', sans-serif";
const FONT_LATIN = "'Segoe UI Light', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** cue table: shot id -> array of { from, to, fadeIn, fadeOut, kind, text, en } in local frames */
export const CUES = {
  shot01: [
    { from: 20, to: 88, fadeIn: 25, fadeOut: 18, kind: 'title', text: '晨光列車', en: 'First Light Express' },
    { from: 30, to: 84, fadeIn: 20, fadeOut: 14, kind: 'vertical', text: '雨夜 · 始發站', en: 'Rainy night · first station' },
  ],
  shot03: [
    { from: 16, to: 64, kind: 'sub', text: '我想看看，雨以外的天空。', en: 'I want to see the sky beyond the rain.' },
  ],
  shot07: [
    { from: 18, to: 70, kind: 'sub', text: '晚安，這座城市。', en: 'Good night, city.' },
  ],
  shot12: [
    { from: 14, to: 52, kind: 'sub', text: '這封信，我讀了一百遍。', en: 'I have read this letter a hundred times.' },
    { from: 58, to: 92, kind: 'sub', text: '這一次，換我回信。', en: 'This time, I will write back.' },
  ],
  shot15: [
    { from: 30, to: 90, kind: 'sub', text: '海，比想像中還要亮。', en: 'The sea is brighter than I imagined.' },
  ],
  shot16: [
    { from: 18, to: 70, kind: 'sub', text: '謝謝你，陪我到這裡。', en: 'Thank you for coming this far with me.' },
  ],
  shot17: [
    { from: 40, to: 125, fadeIn: 30, fadeOut: 30, kind: 'card', text: '新的一天', en: 'A new day' },
  ],
  shot18: [
    { from: 10, to: 96, fadeIn: 14, fadeOut: 12, kind: 'credit', role: 'title', text: '晨光列車', en: 'First Light Express' },
    { from: 30, to: 96, fadeIn: 14, fadeOut: 12, kind: 'credit', role: 'line', text: 'Directed by one agent' },
    { from: 40, to: 96, fadeIn: 14, fadeOut: 12, kind: 'credit', role: 'label', text: 'Seven departments in parallel' },
    { from: 46, to: 96, fadeIn: 14, fadeOut: 12, kind: 'credit', role: 'list', text: 'Screenplay · Characters · Environments · Look · VFX · Layout A · Layout B' },
    { from: 56, to: 96, fadeIn: 14, fadeOut: 12, kind: 'credit', role: 'line', text: 'Pure Three.js · 18 shots · 1,896 frames · 24 fps' },
    { from: 66, to: 96, fadeIn: 14, fadeOut: 12, kind: 'credit', role: 'line', text: 'Rendered in a terminal' },
  ],
};

// ---------- deterministic helpers ----------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, x) => a + (b - a) * x;

/** 0..1 visibility envelope of a cue on `local` (smoothstep ramps, inclusive range). */
function env(cue, local) {
  if (local < cue.from || local > cue.to) return 0;
  const fi = cue.fadeIn || 8, fo = cue.fadeOut || 8;
  const a = (local - cue.from + 1) / fi;
  const b = (cue.to - local + 1) / fo;
  return smooth(Math.min(1, a, b));
}
/** 0..1 progress of `local` through the whole life of a cue. */
function life(cue, local) { return clamp01((local - cue.from) / Math.max(1, cue.to - cue.from)); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const px = (v) => `${v.toFixed(2)}px`;
const op = (v) => clamp01(v).toFixed(4);

// ---------- renderers (each returns an HTML string) ----------

/** Opening title for shot01: large letter-spaced 晨光列車 over a thin rule, English small beneath. */
function renderTitle(cue, local, W, H) {
  const a = env(cue, local);
  if (a <= 0) return '';
  const p = life(cue, local);
  const inP = smooth((local - cue.from + 1) / (cue.fadeIn || 8));   // 0..1 during fade-in
  const cx = W / 2, cy = H * 0.46;
  const ls = lerp(0.40, 0.47, p);                                   // slow breathing expansion
  const rise = (1 - inP) * 10;                                      // settles down 10px as it appears
  const ruleW = lerp(0, 420, smooth((local - cue.from - 6) / 34));  // rule draws in just behind the glyphs
  const glow = `0 0 2px rgba(255,255,255,.55), 0 0 18px rgba(255,255,255,.45), 0 0 46px rgba(120,200,255,.38), 0 0 110px rgba(255,63,164,.16)`;
  return `
<div style="position:absolute;left:0;top:${px(cy - 120 + rise)};width:${W}px;text-align:center;opacity:${op(a)};">
  <div style="font-family:${FONT_CJK};font-weight:300;font-size:132px;line-height:1;color:#f4f7ff;letter-spacing:${ls.toFixed(3)}em;padding-left:${ls.toFixed(3)}em;text-shadow:${glow};">${esc(cue.text)}</div>
</div>
<div style="position:absolute;left:${px(cx - ruleW / 2)};top:${px(cy + 46 + rise)};width:${px(ruleW)};height:1px;background:rgba(255,255,255,.62);box-shadow:0 0 8px rgba(160,220,255,.5);opacity:${op(a)};"></div>
<div style="position:absolute;left:0;top:${px(cy + 64 + rise * 1.4)};width:${W}px;text-align:center;opacity:${op(a * 0.92)};">
  <div style="font-family:${FONT_LATIN};font-weight:300;font-size:26px;line-height:1;color:#e8f1ff;letter-spacing:0.48em;padding-left:0.48em;text-transform:uppercase;text-shadow:0 0 12px rgba(140,210,255,.5), 0 1px 2px rgba(0,0,0,.4);">${esc(cue.en)}</div>
</div>`;
}

/** Small vertical kanji-style side text (shot01). */
function renderVertical(cue, local, W, H) {
  const a = env(cue, local);
  if (a <= 0) return '';
  const inP = smooth((local - cue.from + 1) / (cue.fadeIn || 8));
  return `
<div style="position:absolute;right:150px;top:${px(H * 0.30 - (1 - inP) * 14)};writing-mode:vertical-rl;font-family:${FONT_CJK};font-weight:300;font-size:22px;line-height:1;color:#dfe9ff;letter-spacing:0.5em;opacity:${op(a * 0.7)};text-shadow:0 0 10px rgba(120,200,255,.45), 0 0 2px rgba(0,0,0,.6);">${esc(cue.text)}</div>`;
}

/** Bilingual subtitle at the bottom: ~40px Chinese line over ~24px English line. */
function renderSub(cue, local, W, H) {
  const a = env(cue, local);
  if (a <= 0) return '';
  const inP = smooth((local - cue.from + 1) / (cue.fadeIn || 8));
  const rise = (1 - inP) * 6;
  const shadow = '0 2px 2px rgba(0,0,0,.9), 0 0 14px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.8)';
  return `
<div style="position:absolute;left:0;bottom:${px(78 - rise)};width:${W}px;text-align:center;opacity:${op(a)};">
  <div style="font-family:${FONT_CJK};font-weight:300;font-size:40px;line-height:1.25;color:#ffffff;letter-spacing:0.14em;padding-left:0.14em;text-shadow:${shadow};">${esc(cue.text)}</div>
  <div style="font-family:${FONT_LATIN};font-weight:300;font-size:24px;line-height:1.3;margin-top:6px;color:#f6f8ff;letter-spacing:0.08em;padding-left:0.08em;text-shadow:${shadow};">${esc(cue.en)}</div>
</div>`;
}

/** Centered card (shot17 新的一天): white with a soft dark glow so it survives the fade to white. */
function renderCard(cue, local, W, H) {
  const a = env(cue, local);
  if (a <= 0) return '';
  const p = life(cue, local);
  const ls = lerp(0.50, 0.66, p);                                   // the characters drift apart as they dissolve
  const cy = H * 0.45;
  const glow = '0 0 2px rgba(30,40,70,.7), 0 3px 10px rgba(30,40,70,.55), 0 0 36px rgba(40,50,90,.5), 0 0 80px rgba(40,50,90,.35)';
  return `
<div style="position:absolute;left:0;top:${px(cy - 60)};width:${W}px;text-align:center;opacity:${op(a)};">
  <div style="font-family:${FONT_CJK};font-weight:300;font-size:108px;line-height:1;color:#ffffff;letter-spacing:${ls.toFixed(3)}em;padding-left:${ls.toFixed(3)}em;text-shadow:${glow};">${esc(cue.text)}</div>
  <div style="font-family:${FONT_LATIN};font-weight:300;font-size:26px;line-height:1;margin-top:34px;color:#ffffff;letter-spacing:0.42em;padding-left:0.42em;text-transform:uppercase;text-shadow:${glow};opacity:0.92;">${esc(cue.en)}</div>
</div>`;
}

/** Credits card on black (shot18): a centred column, lines staggered in, all gone before the engine's fade. */
function renderCredits(cues, local, W, H) {
  let anyVisible = false;
  let y = 0;                                                        // vertical rhythm: px from the column top
  const items = cues.map((c) => {
    const a = env(c, local);
    if (a > 0) anyVisible = true;
    const inP = smooth((local - c.from + 1) / (c.fadeIn || 8));
    const rise = (1 - inP) * 10;
    let h, html;
    if (c.role === 'title') {
      h = 150;
      html = `
<div style="position:absolute;left:0;top:${px(y + rise)};width:${W}px;text-align:center;opacity:${op(a)};">
  <div style="font-family:${FONT_CJK};font-weight:300;font-size:76px;line-height:1;color:#f4f7ff;letter-spacing:0.42em;padding-left:0.42em;text-shadow:0 0 16px rgba(255,255,255,.35), 0 0 40px rgba(120,200,255,.25);">${esc(c.text)}</div>
  <div style="font-family:${FONT_LATIN};font-weight:300;font-size:22px;line-height:1;margin-top:26px;color:#dfe9ff;letter-spacing:0.5em;padding-left:0.5em;text-transform:uppercase;text-shadow:0 0 12px rgba(140,210,255,.35);">${esc(c.en)}</div>
  <div style="margin:34px auto 0;width:220px;height:1px;background:rgba(255,255,255,.4);"></div>
</div>`;
    } else if (c.role === 'label') {
      h = 34;
      html = `
<div style="position:absolute;left:0;top:${px(y + rise)};width:${W}px;text-align:center;opacity:${op(a * 0.72)};font-family:${FONT_LATIN};font-weight:300;font-size:20px;line-height:1;color:#b9c6e2;letter-spacing:0.32em;padding-left:0.32em;text-transform:uppercase;">${esc(c.text)}</div>`;
    } else if (c.role === 'list') {
      h = 64;
      html = `
<div style="position:absolute;left:0;top:${px(y + rise)};width:${W}px;text-align:center;opacity:${op(a)};font-family:${FONT_LATIN};font-weight:300;font-size:22px;line-height:1;color:#f1f5ff;letter-spacing:0.14em;padding-left:0.14em;text-shadow:0 0 10px rgba(140,210,255,.25);">${esc(c.text)}</div>`;
    } else {
      h = 56;
      html = `
<div style="position:absolute;left:0;top:${px(y + rise)};width:${W}px;text-align:center;opacity:${op(a)};font-family:${FONT_LATIN};font-weight:300;font-size:24px;line-height:1;color:#f1f5ff;letter-spacing:0.22em;padding-left:0.22em;text-shadow:0 0 10px rgba(140,210,255,.25);">${esc(c.text)}</div>`;
    }
    y += h;
    return html;
  });
  if (!anyVisible) return '';
  const top = (H - y) / 2 - 10;
  return `<div style="position:absolute;left:0;top:${px(top)};width:${W}px;height:${px(y)};">${items.join('')}</div>`;
}

/**
 * update({ overlay, shot, local, global, t, fps, width, height })
 * Fully describes the overlay for this frame (idempotent): the DOM is rebuilt from the cue table every call.
 */
export function update({ overlay, shot, local, width = 1920, height = 1080 }) {
  const id = shot && shot.id;
  const cues = (id && CUES[id]) || null;
  if (!cues || !cues.length) { overlay.innerHTML = ''; return; }
  const W = width, H = height;
  let html = '';
  const credits = cues.filter((c) => c.kind === 'credit');
  for (const cue of cues) {
    switch (cue.kind) {
      case 'title': html += renderTitle(cue, local, W, H); break;
      case 'vertical': html += renderVertical(cue, local, W, H); break;
      case 'sub': html += renderSub(cue, local, W, H); break;
      case 'card': html += renderCard(cue, local, W, H); break;
      default: break;
    }
  }
  if (credits.length) html += renderCredits(credits, local, W, H);
  overlay.innerHTML = html;
}
