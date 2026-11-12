// Studio engine: deterministic frame stepping for headless capture.
// window.__studio.seek(frame) builds the right shot, warms up, updates, renders, applies fades + overlay.
import * as THREE from 'three';
import * as ease from './ease.js';
import { createRig } from './camrig.js';
import * as characters from '../lib/characters.js';
import * as environments from '../lib/environments.js';
import * as vfx from '../lib/vfx.js';
import * as look from '../lib/look.js';
import * as titles from '../lib/titles.js';

const manifest = await (await fetch('/bible/shots.json', { cache: 'no-store' })).json();
const { fps, width, height, frameCount } = manifest;
for (const s of manifest.shots) s.frames = s.end - s.start + 1;

const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const fadeEl = document.getElementById('fade');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(width, height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.insertBefore(renderer.domElement, overlay);

const lib = { characters, environments, vfx, look, titles };
const ctxBase = { THREE, renderer, width, height, fps, lib, overlay, ease, camrig: createRig, rng: ease.rng };

const log = [];
const errors = [];
window.addEventListener('error', e => errors.push(String(e.message || e)));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason && e.reason.stack || e.reason)));

let current = null;   // { shot, inst, post, lastLocal }

function shotFor(frame) {
  return manifest.shots.find(s => frame >= s.start && frame <= s.end);
}

async function ensureShot(shot) {
  if (current && current.shot.id === shot.id) return current;
  if (current) {
    try { current.inst.dispose && current.inst.dispose(); } catch (e) { errors.push('dispose ' + current.shot.id + ': ' + e.message); }
    try { current.post && current.post.dispose && current.post.dispose(); } catch (e) {}
    overlay.innerHTML = '';
  }
  const mod = await import(`../shots/${shot.id}.js?v=${manifest.v || 0}`);
  const ctx = { ...ctxBase, shot };
  const inst = await mod.default.build(ctx);
  if (!inst || !inst.scene || !inst.camera) throw new Error(shot.id + ' build() must return {scene, camera, update}');
  inst.camera.aspect = width / height; inst.camera.updateProjectionMatrix();
  let post = null;
  try {
    post = look.createPostStack({ renderer, scene: inst.scene, camera: inst.camera, width, height, preset: inst.post || 'neutral' });
  } catch (e) { errors.push('post stack ' + shot.id + ': ' + (e.stack || e.message)); post = null; }
  current = { shot, inst, post, lastLocal: -1 };
  return current;
}

function applyFade(shot, local) {
  let a = 0, color = '#000000';
  if (shot.fadeIn && local < shot.fadeIn) { a = 1 - (local + 1) / shot.fadeIn; color = shot.fadeInColor || '#000000'; }
  const fromEnd = shot.end - shot.start - local;   // frames remaining after this one
  if (shot.fadeOut && fromEnd < shot.fadeOut) { const b = 1 - (fromEnd + 1) / shot.fadeOut; if (b > a) { a = b; color = shot.fadeColor || '#000000'; } }
  fadeEl.style.background = color;
  fadeEl.style.opacity = a.toFixed(4);
}

async function seek(frame) {
  frame = Math.max(0, Math.min(frameCount - 1, frame | 0));
  const shot = shotFor(frame);
  const cur = await ensureShot(shot);
  const local = frame - shot.start;
  // warm-up: replay earlier frames if we jumped
  if (cur.lastLocal >= local) { // went backwards: rebuild for determinism
    current = null; await ensureShot(shot); return seek(frame);
  }
  for (let f = cur.lastLocal + 1; f < local; f++) cur.inst.update && cur.inst.update(f, f / fps, shot.start + f);
  cur.inst.update && cur.inst.update(local, local / fps, frame);
  cur.lastLocal = local;
  if (cur.post) cur.post.render(local, frame); else renderer.render(cur.inst.scene, cur.inst.camera);
  try { titles.update({ overlay, shot, local, global: frame, t: local / fps, fps, width, height }); }
  catch (e) { errors.push('titles ' + shot.id + ': ' + e.message); }
  applyFade(shot, local);
  return { frame, shot: shot.id, local };
}

/** drop the current shot so the next seek rebuilds it from local 0 (used after a warm-up frame) */
function reset() { if (current) { try { current.inst.dispose && current.inst.dispose(); } catch (e) {} overlay.innerHTML = ''; current = null; } }

window.__studio = {
  manifest, fps, width, height, frameCount, seek, shotFor, reset,
  errors, log,
  gl: (() => { const gl = renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })(),
  ready: true
};
console.log('[studio] ready', window.__studio.gl);
