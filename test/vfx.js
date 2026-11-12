// VFX test bench: one scene per effect, selected by ?fx=<name>. Exposes window.__studio like the engine does
// (seek(frame) replays update() from the last frame, bench(n) times update+render) so render/browser.mjs works unchanged.
import * as THREE from 'three';
import * as ease from '../src/engine/ease.js';
import * as look from '../src/lib/look.js';
import * as vfx from '../src/lib/vfx.js';

const W = 1920, H = 1080, FPS = 24;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.getElementById('stage').insertBefore(renderer.domElement, document.getElementById('overlay'));
const ctx = { THREE, renderer, width: W, height: H, fps: FPS, lib: { look, vfx }, ease, rng: ease.rng };
const errors = [];
window.addEventListener('error', e => errors.push(String(e.message || e)));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason && e.reason.stack || e.reason)));

const cam = () => new THREE.PerspectiveCamera(35, W / H, 0.1, 3000);
function lights(scene, { hemi = 0.7, key = 1.4, keyPos = [5, 10, 6], keyColor = 0xffffff, skyColor = 0xbcc8ff, groundColor = 0x3a2f4a } = {}) {
  scene.add(new THREE.HemisphereLight(skyColor, groundColor, hemi));
  const k = new THREE.DirectionalLight(keyColor, key); k.position.set(...keyPos); scene.add(k);
}
function ground(scene, color, y = 0, size = 600) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), look.toonMaterial({ color, steps: 3 })); m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m; }
function sunDisc(scene, pos, radius = 30, color = 0xfff3c8) { const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), look.flatMaterial({ color })); m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m); return m; }
const dark = scene => { scene.add(look.createSkyDome({ top: 0x0d0e24, horizon: 0x2a1e48, bottom: 0x07070f }).mesh); lights(scene, { hemi: 0.35, key: 0.6, keyColor: 0x9fb3ff }); };
const dawn = scene => { scene.add(look.createSkyDome({ top: 0x2b3f9e, horizon: 0xffb878, bottom: 0x9fd8ff }).mesh); lights(scene, { hemi: 0.6, key: 1.5, keyColor: 0xffe0b0, keyPos: [3, 4, -10], skyColor: 0xcfe0ff, groundColor: 0x6a5a7a }); };
const lit = scene => { scene.add(look.createSkyDome({ top: 0x6fb6ff, horizon: 0xfff0e0, bottom: 0xc8e8ff }).mesh); lights(scene, { hemi: 0.8, key: 1.6, keyColor: 0xfff4e0, keyPos: [6, 12, 4] }); };

const SCENES = {
  rain() {
    const scene = new THREE.Scene(); dark(scene); ground(scene, 0x151830);
    for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(4 + (i % 3) * 2, 10 + (i * 7) % 20, 4), look.toonMaterial({ color: 0x1b1e3c, steps: 3 })); b.position.set(-24 + i * 6, 5 + ((i * 7) % 20) / 2, -22 - (i % 2) * 8); scene.add(b); }
    const bokeh = vfx.createBokehLights(ctx, { count: 60, area: [50, 14, 10], center: [0, 8, -30], sizeRange: [0.4, 1.4] }); scene.add(bokeh.group);
    const lamp = new THREE.PointLight(0xffb347, 40, 30); lamp.position.set(3, 4, -2); scene.add(lamp);
    const rain = vfx.createRain(ctx, { count: 8000, area: [50, 30, 50], center: [0, 14, -8], wind: 2.5, ground: 0 }); scene.add(rain.group);
    const camera = cam(); camera.position.set(0, 3.5, 14); camera.lookAt(0, 5, -10);
    return { scene, camera, update(f) { rain.update(f); bokeh.update(f); } };
  },
  rainOnGlass() {
    const scene = new THREE.Scene();
    const glass = vfx.createRainOnGlass(ctx, { width: 2, height: 1.125 }); scene.add(glass.mesh);
    const camera = cam(); camera.position.set(0, 0, 0.5625 / Math.tan(THREE.MathUtils.degToRad(17.5)));
    return { scene, camera, update(f) { glass.update(f); } };
  },
  rainOnGlassColor() {
    const scene = new THREE.Scene(); dark(scene);
    const bokeh = vfx.createBokehLights(ctx, { count: 90, area: [30, 16, 8], center: [0, 0, -16], sizeRange: [0.4, 1.6], opacity: 0.7 }); scene.add(bokeh.group);
    const glass = vfx.createRainOnGlass(ctx, { width: 2, height: 1.125, background: 0x101a33, tintAmount: 0.2 }); scene.add(glass.mesh);
    const camera = cam(); camera.position.set(0, 0, 0.5625 / Math.tan(THREE.MathUtils.degToRad(17.5)));
    return { scene, camera, update(f) { glass.update(f); bokeh.update(f); } };
  },
  mist() {
    const scene = new THREE.Scene(); dawn(scene); ground(scene, 0x1e3a2e, 0, 800);
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 0.25), look.toonMaterial({ color: 0x2a2440 })); p.position.set(-30 + i * 5, 3, -40 - (i % 3) * 15); scene.add(p); }
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), look.toonMaterial({ color: 0x24324a })); t.position.set(-40 + i * 16, 3, -90); scene.add(t); }
    const mist = vfx.createMist(ctx, { area: [220, 220], height: 2.6, center: [0, 1.3, -50], density: 1 }); scene.add(mist.group);
    const camera = cam(); camera.position.set(0, 4, 20); camera.lookAt(0, 1.5, -40);
    return { scene, camera, update(f) { mist.update(f); camera.position.x = f * 0.08; } };
  },
  petals() {
    const scene = new THREE.Scene(); lit(scene); ground(scene, 0x7f9f5a);
    for (let i = 0; i < 10; i++) { for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.SphereGeometry(4 + (i % 3), 12, 10), look.toonMaterial({ color: 0xffbdd6, steps: 3 })); t.position.set(s * 9, 6, 8 - i * 7); scene.add(t); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 5, 8), look.toonMaterial({ color: 0x4a3a3a })); k.position.set(s * 9, 2.5, 8 - i * 7); scene.add(k); } }
    const petals = vfx.createPetals(ctx, { count: 6000, area: [40, 14, 70], center: [0, 6, -15], wind: [0.8, 0, 2.5] }); scene.add(petals.group);
    petals.burst(30, [0, 1, -5], 16, { strength: 10, lift: 6 });
    const camera = cam(); camera.position.set(0, 3, 22); camera.lookAt(0, 4, -10);
    return { scene, camera, update(f) { petals.update(f); } };
  },
  speedLines() {
    const scene = new THREE.Scene(); dark(scene); ground(scene, 0x151830);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), look.toonMaterial({ color: 0xff3fa4 })); look.addOutline(box); box.position.y = 1; scene.add(box);
    const camera = cam(); camera.position.set(0, 2, 7); camera.lookAt(0, 1, 0); scene.add(camera);
    const sl = vfx.createSpeedLines(ctx, {}); camera.add(sl.mesh); sl.mesh.position.z = -1; sl.setIntensity(0.85);
    return { scene, camera, update(f) { sl.update(f); box.rotation.y = f * 0.05; } };
  },
  sea() {
    const scene = new THREE.Scene(); dawn(scene);
    const sunDir = new THREE.Vector3(0.25, 0.28, -1).normalize(); sunDisc(scene, sunDir.clone().multiplyScalar(900).toArray(), 40);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), look.toonMaterial({ color: 0xe9d6ab, steps: 3 })); sand.rotation.x = -Math.PI / 2; sand.position.set(340, -0.4, 0); scene.add(sand);
    const sea = vfx.createSea(ctx, { shoreX: 40, foamWidth: 35, sunDir: sunDir.toArray() }); scene.add(sea.mesh);
    const camera = cam(); camera.position.set(0, 9, 60); camera.lookAt(18, 0, -80);
    return { scene, camera, update(f) { sea.update(f); } };
  },
  seaClose() {
    const scene = new THREE.Scene(); dawn(scene);
    const sunDir = new THREE.Vector3(-0.3, 0.3, -1).normalize(); sunDisc(scene, sunDir.clone().multiplyScalar(900).toArray(), 40);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), look.toonMaterial({ color: 0xe9d6ab, steps: 3 })); sand.rotation.x = -Math.PI / 2; sand.position.set(340, -0.4, 0); scene.add(sand);
    const sea = vfx.createSea(ctx, { shoreX: 40, foamWidth: 30, sunDir: sunDir.toArray(), waveHeight: 0.6 }); scene.add(sea.mesh);
    const camera = cam(); camera.position.set(48, 2.2, 10); camera.lookAt(20, 0, -30);
    return { scene, camera, update(f) { sea.update(f); } };
  },
  gulls() {
    const scene = new THREE.Scene(); dawn(scene);
    const gulls = vfx.createGulls(ctx, { count: 7, center: [0, 12, -25], radius: 10, size: 1.6 }); scene.add(gulls.group);
    const camera = cam(); camera.position.set(0, 9, 4); camera.lookAt(0, 12, -25);
    return { scene, camera, update(f) { gulls.update(f); } };
  },
  gullClose() {
    const scene = new THREE.Scene(); dawn(scene);
    const gulls = vfx.createGulls(ctx, { count: 1, center: [0, 1, 0], radius: 0.001, size: 1 }); scene.add(gulls.group);
    const camera = cam(); camera.position.set(2.5, 2.2, 3); camera.lookAt(0, 1, 0);
    return { scene, camera, update(f) { gulls.update(f); } };
  },
  paperPlane() {
    const scene = new THREE.Scene(); dawn(scene); ground(scene, 0xe9d6ab, -2);
    const plane = vfx.createPaperPlane(ctx, { scale: 2 }); scene.add(plane.group);
    plane.setPath(vfx.glidePath({ from: [-8, 2, -4], to: [10, 6, -16], apex: [0, 8.5, -10], frames: 96, wobble: 0.5 }));
    const camera = cam(); camera.position.set(0, 4, 8); camera.lookAt(1, 5, -10);
    return { scene, camera, update(f) { plane.update(f); } };
  },
  paperPlaneClose() {
    const scene = new THREE.Scene(); dawn(scene);
    const plane = vfx.createPaperPlane(ctx, { scale: 1 }); scene.add(plane.group);
    plane.setPath(f => ({ pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(Math.sin(f * 0.02), 0.1, Math.cos(f * 0.02)), roll: 0.2 }));
    const camera = cam(); camera.position.set(1.2, 0.6, 1.4); camera.lookAt(0, 0, 0);
    return { scene, camera, update(f) { plane.update(f); } };
  },
  godRays() {
    const scene = new THREE.Scene(); dawn(scene);
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(90 + (i % 3) * 30, 70 + (i % 2) * 30, 5), look.toonMaterial({ color: 0x2a2a52, steps: 2 })); m.position.set(-280 + i * 95, 20, -260 - (i % 2) * 40); scene.add(m); }
    sunDisc(scene, [0, 62, -520], 26);
    const rays = vfx.createGodRays(ctx, { origin: [0, 58, -420], direction: [0, -0.12, 1], length: 420, width: 55, count: 14, spread: 0.5 }); scene.add(rays.group);
    const camera = cam(); camera.position.set(0, 4, 0); camera.lookAt(0, 45, -400);
    return { scene, camera, update(f) { rays.update(f); } };
  },
  lensFlare() {
    const scene = new THREE.Scene(); dawn(scene);
    const sea = vfx.createSea(ctx, { sunDir: [0.15, 0.1, -1] }); sea.mesh.position.y = -3; scene.add(sea.mesh);
    const sunPos = [70, 45, -500]; sunDisc(scene, sunPos, 22);
    const flare = vfx.createLensFlare(ctx, { sun: sunPos }); scene.add(flare.group);
    const camera = cam(); camera.position.set(0, 2, 0);
    return { scene, camera, update(f) { camera.lookAt(20 + f * 0.9, 25, -500); sea.update(f); flare.update(f, camera); } };
  },
  steam() {
    const scene = new THREE.Scene(); dark(scene); ground(scene, 0x202436);
    const lamp = new THREE.PointLight(0xffd9a0, 60, 40); lamp.position.set(0, 6, 2); scene.add(lamp);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 3.2, 1), look.toonMaterial({ color: 0x3a4a6a, steps: 3 })); wall.position.set(0, 1.6, -3); scene.add(wall);
    const steam = vfx.createSteam(ctx, { max: 600 }); scene.add(steam.group);
    steam.emit(0, [-3, 0.4, -1.5], { count: 26, speed: 2.2, dir: [0.4, 0.5, 1], size: 1.2, life: 3 });
    steam.emit(24, [3, 0.4, -1.5], { count: 26, speed: 2.2, dir: [-0.4, 0.5, 1], size: 1.2, life: 3 });
    const camera = cam(); camera.position.set(0, 2.2, 9); camera.lookAt(0, 1.3, -1);
    return { scene, camera, update(f) { if (f % 10 === 0) steam.emit(f, [0, 0.3, -2], { count: 6, speed: 1.2, size: 0.8, life: 2.2 }); steam.update(f); } };
  },
  bokeh() {
    const scene = new THREE.Scene(); dark(scene);
    const bokeh = vfx.createBokehLights(ctx, { count: 110, area: [34, 18, 12], center: [0, 0, -18], sizeRange: [0.3, 1.7], opacity: 0.6 }); scene.add(bokeh.group);
    const camera = cam(); camera.position.set(0, 0, 6); camera.lookAt(0, 0, -20);
    return { scene, camera, update(f) { bokeh.update(f); } };
  },
  clouds() {
    const scene = new THREE.Scene(); dawn(scene);
    const clouds = vfx.createClouds(ctx, { count: 16, center: [0, 70, -420], spread: [700, 30, 160], sunDir: [0.3, 0.5, 0.8] }); scene.add(clouds.group);
    const camera = cam(); camera.position.set(0, 10, 0); camera.lookAt(0, 60, -420);
    return { scene, camera, update(f) { clouds.update(f); } };
  },
  stars() {
    const scene = new THREE.Scene(); scene.add(look.createSkyDome({ top: 0x070818, horizon: 0x2a1e48, bottom: 0x07070f }).mesh);
    const stars = vfx.createStars(ctx, { count: 2500 }); scene.add(stars.group);
    const camera = cam(); camera.position.set(0, 0, 0); camera.lookAt(0, 45, -100);
    return { scene, camera, update(f) { stars.update(f); } };
  },
  lightSweep() {
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0x8090c0, 0x302838, 0.3));
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), look.toonMaterial({ color: 0x5a4a6a, steps: 3 })); wall.position.set(0, 2, -1.5); scene.add(wall);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), look.toonMaterial({ color: 0xffe9dc, steps: 3 })); head.position.set(0, 1.6, 0); look.addOutline(head); scene.add(head);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.0, 6, 12), look.toonMaterial({ color: 0x2a3060, steps: 3 })); body.position.set(0, 0.4, 0); scene.add(body);
    const sweep = vfx.createLightSweep(ctx, { position: [0, 3.5, 6], target: [-4, 1.5, 0], beam: true, barWidth: 0.3 }); scene.add(sweep.group);
    sweep.setSweep(0, 80, [-5, 1.5, 0], [5, 1.5, 0], { fade: 10 });
    const camera = cam(); camera.position.set(0.5, 2, 5); camera.lookAt(0, 1.3, 0);
    return { scene, camera, update(f) { sweep.update(f); } };
  },
};

const fx = new URLSearchParams(location.search).get('fx') || 'rain';
if (!SCENES[fx]) throw new Error('unknown fx ' + fx);
let inst = SCENES[fx](); let last = -1;
function seek(frame) {
  if (frame <= last) { inst = SCENES[fx](); last = -1; }
  for (let f = last + 1; f <= frame; f++) inst.update(f);
  last = frame;
  renderer.render(inst.scene, inst.camera);
  return { frame, shot: fx, local: frame };
}
function bench(n = 48) {
  inst = SCENES[fx](); last = -1;
  for (let f = 0; f < 4; f++) { inst.update(f); renderer.render(inst.scene, inst.camera); }  // warm (shader compile)
  const t0 = performance.now();
  for (let f = 4; f < 4 + n; f++) { inst.update(f); renderer.render(inst.scene, inst.camera); }
  renderer.getContext().finish();
  const t1 = performance.now();
  let tris = 0; inst.scene.traverse(o => { if (o.isMesh || o.isPoints) { const g = o.geometry; const idx = g.index ? g.index.count : g.attributes.position.count; tris += (idx / 3) * (g.instanceCount || 1); } });
  last = 4 + n - 1;
  return { msPerFrame: (t1 - t0) / n, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, sceneTris: tris };
}
window.__studio = { fx, list: Object.keys(SCENES), seek, bench, errors, log: [], ready: true, fps: FPS, width: W, height: H,
  gl: (() => { const gl = renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() };
console.log('[vfx-bench] ready', fx);
