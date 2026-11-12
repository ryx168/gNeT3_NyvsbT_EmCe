// ENVIRONMENTS department — 晨光列車 / First Light Express.
// Every factory returns { group, update(local, t), ...named parts }. Units: metres. +Z is "toward camera" by default;
// the track runs along -Z unless noted. All randomness goes through ctx.rng(seed); update() is a pure function of `local`.
//
// Conventions kept from the stub (shots code against these):
//   createCityNight      towers fill x∈[-extent/2, extent/2], z∈[-20, -20-extent]; ground at y=0.
//   createRooftop        floor top at y=0, 16 (x) × 10 (z); parapet along z=-5 (the city view is toward -Z).
//   createStationPlatform platform top y=0 spanning x∈[-2,6], z∈[-40,40]; track centre x=-3.5, rail top y=-1.
//   createTrainExterior  origin at the front coupler, cars extend along -Z, rail top at y=0; car i centred at z=-10-20i.
//   createTrainInterior  seat at origin (x -0.95..0.15, top y=0.5), window plane at (-1.35,1.3,0) facing +X, wall at x=-1.4.
//   createBridge         deck top y=0 along -Z for `length`; river at y=-25.
//   createCountryside    track along -Z at x=0, ground y=0; tunnel mouth at z=+20 (train exits toward -Z).
//   createMountains      valley floor y=0; ridges stacked at z=-150, -270, ... (farther = higher, lighter).
//   createSakuraLane     track along -Z at x=0 from z=0 to -length; trees at |x|≈5..7.
//   createCoast          track along -Z at x=0 on a ledge; sea to -X at y=-30; cliff rises on +X.
//   createSeasideStation platform top y=0 spanning x∈[-1,5], z∈[-20,20]; track centre x=-3.5; stairs down on +X.
//   createBeach          sand ≈ y=0 at x=0 sloping down toward -X; water line at x≈-30, sea plane y=-0.3.
//   createRails          rail top y=0, rails at x=±0.72, along -Z for `length`.
import * as THREE from 'three';
import * as look from './look.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI, TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CJK = '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", "Hiragino Sans", "Yu Gothic", sans-serif';

/* ------------------------------------------------------------------ helpers */
function canvasTex(w, h, draw, { repeat = [1, 1], wrap = THREE.RepeatWrapping, nearest = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = wrap;
  t.repeat.set(repeat[0], repeat[1]); if (nearest) t.magFilter = t.minFilter = THREE.NearestFilter; t.anisotropy = 4;
  return t;
}
function noOutline(o) { o.traverse(m => { m.userData.noOutline = true; }); return o; }
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
function box(w, h, d, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 10) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z); }
function plane(w, h, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z); }
function groundPlane(color, size = 400, y = 0) { const m = plane(size, size, look.toonMaterial({ color })); m.rotation.x = -PI / 2; m.position.y = y; m.userData.noOutline = true; return m; }
/** merge a list of geometries after applying a matrix each: [{geo, pos:[x,y,z], rot:[x,y,z], scale:[x,y,z]}] */
function merged(items) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const list = items.map(it => {
    const g = it.geo.clone();
    e.set(...(it.rot || [0, 0, 0])); q.setFromEuler(e);
    m4.compose(V3(...(it.pos || [0, 0, 0])), q, V3(...(it.scale || [1, 1, 1]))); g.applyMatrix4(m4);
    return g;
  });
  const out = mergeGeometries(list, false); list.forEach(g => g.dispose()); return out;
}
/** 1D fractal value noise from a seeded table */
function makeNoise(r, n = 256) {
  const tab = new Float32Array(n); for (let i = 0; i < n; i++) tab[i] = r();
  const at = x => { const i = Math.floor(x), f = x - i, a = tab[((i % n) + n) % n], b = tab[(((i + 1) % n) + n) % n]; const s = f * f * (3 - 2 * f); return a + (b - a) * s; };
  return (x, oct = 4, lac = 2.1, gain = 0.5) => { let s = 0, a = 1, f = 1, norm = 0; for (let o = 0; o < oct; o++) { s += at(x * f + o * 17.3) * a; norm += a; a *= gain; f *= lac; } return s / norm; };
}
/** glow sprite texture (radial falloff) */
let _glowTex = null;
function glowTex() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { wrap: THREE.ClampToEdgeWrapping });
  return _glowTex;
}
/** text billboard: PlaneGeometry with a canvas map (transparent). opts: {font, color, bg, glow, w, h, pad, vertical} */
function textPlane(text, { w = 2, h = 0.6, px = 128, color = '#ff3fa4', bg = null, glow = 0, font = 'bold', outline = null, vertical = false, lines = null } = {}) {
  const cw = Math.round(px * (w / h)), ch = px;
  const t = canvasTex(vertical ? ch : cw, vertical ? cw : ch, (g, W, H) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const arr = lines || [text];
    const fs = Math.round(Math.min(H * 0.62 / arr.length, W / (Math.max(...arr.map(s => s.length)) * 0.95)));
    g.font = `${font} ${fs}px ${CJK}`;
    if (glow) { g.shadowColor = color; g.shadowBlur = fs * glow; }
    g.fillStyle = color;
    arr.forEach((s, i) => { const y = H / 2 + (i - (arr.length - 1) / 2) * fs * 1.2; if (outline) { g.lineWidth = fs * 0.08; g.strokeStyle = outline; g.strokeText(s, W / 2, y); } g.fillText(s, W / 2, y); if (glow) g.fillText(s, W / 2, y); });
  }, { wrap: THREE.ClampToEdgeWrapping });
  const m = plane(vertical ? h : w, vertical ? w : h, look.flatMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  m.material.depthWrite = false; m.userData.noOutline = true; return m;
}

/* ------------------------------------------------------------------ rails */
/** Straight rails + sleepers along -Z, rail top at y=0, rails at x=±0.72. -> { group, update, rails, sleepers, ballast } */
export function createRails(ctx, { length = 400, ballast = true, sleeperEvery = 0.65, start = 0 } = {}) {
  const group = new THREE.Group(); group.name = 'rails';
  const railMat = look.toonMaterial({ color: 0x6a6c78 }), railTop = look.toonMaterial({ color: 0xb8bcc8 });
  const rails = [];
  for (const x of [-0.72, 0.72]) {
    const r = box(0.08, 0.14, length, railMat, x, -0.085, start - length / 2); r.userData.noOutline = true;
    const head = box(0.11, 0.03, length, railTop, x, -0.015, start - length / 2); head.userData.noOutline = true;
    group.add(r, head); rails.push(r);
  }
  const n = Math.floor(length / sleeperEvery);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.14, 0.24), look.toonMaterial({ color: 0x4a4038 }), n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeTranslation(0, -0.22, start - i * sleeperEvery - 0.3); sleepers.setMatrixAt(i, m4); }
  sleepers.userData.noOutline = true; group.add(sleepers);
  let bal = null;
  if (ballast) { bal = box(3.6, 0.36, length, look.toonMaterial({ color: 0x55525c }), 0, -0.47, start - length / 2); bal.userData.noOutline = true; group.add(bal); }
  return { group, rails, sleepers, ballast: bal, update() {} };
}

/* ------------------------------------------------------------------ city at night */
const TOWER_VERT = /* glsl */`
  attribute vec4 iRand;            // x,y: window uv offset  z: warm/cool  w: lit density
  attribute vec3 iTint;
  varying vec2 vUv; varying vec3 vN; varying vec4 vR; varying vec3 vTint; varying float vDist; varying vec2 vScale; varying float vH;
  void main(){
    vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vN = normalize(mat3(instanceMatrix) * normal);
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vH = position.y + 0.5;
    // uv in metres: side faces use x (or z) across and y up
    float across = abs(vN.x) > 0.5 ? sc.z : sc.x;
    vScale = vec2(across, sc.y);
    vUv = uv * vec2(across, sc.y);
    vR = iRand; vTint = iTint;
    vDist = length((viewMatrix * wp).xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const TOWER_FRAG = /* glsl */`
  uniform sampler2D uWin; uniform vec3 uBody, uRoof, uHaze, uWarm, uCool; uniform float uHazeNear, uHazeFar, uWinW, uWinH, uGlow;
  varying vec2 vUv; varying vec3 vN; varying vec4 vR; varying vec3 vTint; varying float vDist; varying vec2 vScale; varying float vH;
  void main(){
    vec3 col = uBody * vTint;
    float top = step(0.6, vN.y);
    vec2 cell = vUv / vec2(uWinW, uWinH) + vR.xy * 64.0;
    vec4 w = texture2D(uWin, cell / 64.0);
    // w.r = lit mask, w.g = warm/cool pick, w.b = brightness jitter
    float lit = step(1.0 - vR.w, w.r);
    vec3 wc = mix(uCool, uWarm, step(0.5, w.g + vR.z - 0.5)) * (0.6 + 0.6 * w.b);
    // edge margin: no windows within 0.6 m of the box edges or below 2 m
    float edge = step(0.5, min(vUv.x, vScale.x - vUv.x)) * step(0.3, vUv.y) * step(0.5, vScale.y - vUv.y);
    col = mix(col, wc * uGlow, lit * edge * (1.0 - top));
    col = mix(col, uRoof, top);
    // vertical gradient: lower floors sink into the street haze
    col = mix(col * 0.65, col, smoothstep(0.0, 0.35, vH));
    float haze = smoothstep(uHazeNear, uHazeFar, vDist);
    col = mix(col, uHaze, haze * (1.0 - 0.5 * lit * edge));
    gl_FragColor = vec4(col, 1.0);
  }`;

/** Dense neon city skyline: thousands of instanced towers with emissive windows, landmarks, neon signs, elevated highway, river.
 *  -> { group, update, towers, landmarks, signs, highway, river, streetLights, aviation, setHaze({color,near,far}), extent } */
export function createCityNight(ctx, { seed = 1, extent = 300, density = 1, signs: wantSigns = true, highway: wantHighway = true, river: wantRiver = true } = {}) {
  const group = new THREE.Group(); group.name = 'cityNight'; const r = ctx.rng(seed);
  // window atlas: 64x64 cells
  const winTex = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h); const d = img.data;
    for (let i = 0; i < w * h; i++) { const lit = r(); d[i * 4] = Math.round(lit * 255); d[i * 4 + 1] = r() < 0.5 ? 0 : 255; d[i * 4 + 2] = Math.round(r() * 255); d[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, { nearest: true });
  winTex.colorSpace = THREE.NoColorSpace;
  const uniforms = {
    uWin: { value: winTex }, uBody: { value: new THREE.Color(0x1c1e3c) }, uRoof: { value: new THREE.Color(0x141632) },
    uHaze: { value: new THREE.Color(0x2a2150) }, uHazeNear: { value: extent * 0.25 }, uHazeFar: { value: extent * 1.6 },
    uWarm: { value: new THREE.Color(0xffc37a) }, uCool: { value: new THREE.Color(0x8fe8ff) }, uWinW: { value: 1.6 }, uWinH: { value: 2.0 }, uGlow: { value: 1.35 },
  };
  const towerMat = new THREE.ShaderMaterial({ uniforms, vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG });
  // layout: a street grid with blocks; several towers per block, a few landmarks
  const cell = 11, cols = Math.floor(extent / cell), rows = Math.floor(extent / cell);
  const placements = [];
  const cx = (i) => -extent / 2 + (i + 0.5) * cell, cz = (j) => -20 - (j + 0.5) * cell;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (i % 5 === 4 || j % 4 === 3) continue;              // streets
    if (r() > 0.92 * density) continue;                      // empty lots
    const dz = j / rows;                                     // downtown rises toward the middle distance
    const bulge = Math.exp(-Math.pow((dz - 0.4) / 0.35, 2)) * Math.exp(-Math.pow((i / cols - 0.5) / 0.4, 2));
    const h = 8 + r() * 22 + bulge * (20 + r() * 70) * (r() < 0.3 ? 1.6 : 1);
    const w = 5 + r() * 4.5, d = 5 + r() * 4.5;
    placements.push({ x: cx(i) + (r() - 0.5) * 2, z: cz(j) + (r() - 0.5) * 2, w, d, h, rot: r() < 0.08 ? (r() - 0.5) * 0.4 : 0 });
  }
  const landmarks = [];
  for (let k = 0; k < 5; k++) {
    const i = Math.floor(cols * (0.3 + r() * 0.4)), j = Math.floor(rows * (0.3 + r() * 0.35));
    const h = 150 + r() * 90, w = 11 + r() * 7;
    placements.push({ x: cx(i), z: cz(j), w, d: w, h, rot: 0, landmark: true, spire: 10 + r() * 25 });
    landmarks.push(placements[placements.length - 1]);
  }
  const n = placements.length;
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), towerMat, n);
  const iRand = new Float32Array(n * 4), iTint = new Float32Array(n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  placements.forEach((p, i) => {
    e.set(0, p.rot, 0); q.setFromEuler(e); m4.compose(V3(p.x, p.h / 2, p.z), q, V3(p.w, p.h, p.d)); towers.setMatrixAt(i, m4);
    iRand.set([r(), r(), r(), p.landmark ? 0.6 : 0.22 + r() * 0.3], i * 4);
    const tint = 0.75 + r() * 0.5; const hueShift = r();
    iTint.set([tint * (hueShift < 0.3 ? 1.15 : 1), tint, tint * (hueShift > 0.7 ? 1.2 : 1)], i * 3);
  });
  towers.geometry.setAttribute('iRand', new THREE.InstancedBufferAttribute(iRand, 4));
  towers.geometry.setAttribute('iTint', new THREE.InstancedBufferAttribute(iTint, 3));
  towers.userData.noOutline = true; towers.frustumCulled = false; group.add(towers);
  // landmark spires + crowns
  const spireMat = look.flatMaterial({ color: 0xffc37a }), crownMat = look.flatMaterial({ color: 0x3ff0ff });
  for (const p of landmarks) {
    const s = cyl(0.3, 1.2, p.spire, spireMat, p.x, p.h + p.spire / 2, p.z, 6); s.userData.noOutline = true; group.add(s);
    const c = box(p.w * 0.7, 1.2, p.d * 0.7, crownMat, p.x, p.h + 0.6, p.z); c.userData.noOutline = true; group.add(c);
  }
  // ground: dark asphalt with faint street grid + wet sheen
  const groundTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0c0d1c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1b1d36'; g.lineWidth = 6;
    const sx = w / (cols / 5), sz = h / (rows / 4);
    for (let i = 0; i <= cols / 5; i++) { g.beginPath(); g.moveTo(i * sx - 3, 0); g.lineTo(i * sx - 3, h); g.stroke(); }
    for (let j = 0; j <= rows / 4; j++) { g.beginPath(); g.moveTo(0, j * sz - 3); g.lineTo(w, j * sz - 3); g.stroke(); }
  });
  const gnd = plane(extent * 4, extent * 4, look.flatMaterial({ color: 0xffffff, map: groundTex })); gnd.material.map.repeat.set(4, 4);
  gnd.rotation.x = -PI / 2; gnd.position.set(0, -0.02, -20 - extent / 2); gnd.userData.noOutline = true; group.add(gnd);
  // street lights (sodium) + neon dots as glow points along the streets
  const slPos = [], slCol = [], slSize = [];
  const warm = new THREE.Color(0xffb347), mag = new THREE.Color(0xff3fa4), cyn = new THREE.Color(0x3ff0ff), wht = new THREE.Color(0xfff4e0);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const street = i % 5 === 4 || j % 4 === 3; if (!street) continue;
    if (r() > 0.55) continue;
    const c = r() < 0.7 ? warm : (r() < 0.5 ? mag : (r() < 0.5 ? cyn : wht));
    slPos.push(cx(i) + (r() - 0.5) * 4, 0.5 + r() * 4, cz(j) + (r() - 0.5) * 4); slCol.push(c.r, c.g, c.b); slSize.push(1.5 + r() * 2.5);
  }
  const streetLights = glowPoints(slPos, slCol, slSize, { size: 1.0 }); group.add(streetLights);
  // aviation lights on tall towers (blink)
  const avPos = [], avPhase = [];
  placements.forEach(p => { if (p.h > 60) { avPos.push(p.x, p.h + (p.landmark ? p.spire : 0) + 0.5, p.z); avPhase.push(r() * TAU); } });
  const aviation = blinkPoints(avPos, avPhase, 0xff3b3b, 2.2); group.add(aviation);
  // neon signs on foreground towers
  const signs = new THREE.Group(); signs.name = 'neon';
  if (wantSigns) {
    const words = ['拉麵', '居酒屋', '24h', 'カラオケ', '薬局', '喫茶', 'ホテル', '寿司', '深夜食堂', 'BAR', '電器', 'パチンコ', '焼肉', '銀座', 'OPEN', '一番', '酒', '夜'];
    const cols2 = ['#ff3fa4', '#3ff0ff', '#ffb347', '#ff6cf0', '#7dff9a', '#ffe36e'];
    const front = placements.filter(p => p.z > -20 - extent * 0.45 && !p.landmark).sort((a, b) => b.z - a.z).slice(0, 140);
    for (let k = 0; k < Math.min(60, front.length); k++) {
      const p = front[Math.floor(r() * front.length)];
      const word = words[Math.floor(r() * words.length)], color = cols2[Math.floor(r() * cols2.length)];
      const vertical = r() < 0.45, big = word.length <= 3;
      const sw = vertical ? 1.3 : (big ? 4 : 6), sh = vertical ? (word.length * 1.3 + 0.4) : 1.4;
      const sgn = textPlane(word, { w: sw, h: sh, color, glow: 0.35, vertical, bg: null, outline: null });
      const side = r() < 0.6 ? 'front' : (r() < 0.5 ? 'left' : 'right');
      const y = 2 + r() * Math.min(p.h - 4, 26);
      if (side === 'front') sgn.position.set(p.x + (r() - 0.5) * (p.w - sw * (vertical ? 1 : 0.6)), y, p.z + p.d / 2 + 0.15);
      else { const sgnx = side === 'left' ? -1 : 1; sgn.position.set(p.x + sgnx * (p.d / 2 + 0.15), y, p.z + (r() - 0.5) * (p.d - 1)); sgn.rotation.y = sgnx * PI / 2; }
      // glow halo behind the sign
      const halo = plane(sw * 1.6, sh * 1.6, look.flatMaterial({ color, map: glowTex(), transparent: true, opacity: 0.35 })); halo.material.blending = THREE.AdditiveBlending; halo.material.depthWrite = false;
      halo.position.copy(sgn.position); halo.rotation.copy(sgn.rotation); halo.translateZ(-0.05); halo.userData.noOutline = true;
      signs.add(halo, sgn);
    }
  }
  group.add(signs);
  // elevated highway crossing the city along X at z=-60, with moving light streaks
  const highway = new THREE.Group(); highway.name = 'highway'; const streaks = { fwd: null, back: null };
  const hwZ = -20 - extent * 0.18, hwY = 11, hwLen = extent * 1.3;
  if (wantHighway) {
    const deckMat = look.toonMaterial({ color: 0x2a2c48 }), pierMat = look.toonMaterial({ color: 0x202238 });
    const deck = box(hwLen, 1.2, 14, deckMat, 0, hwY, hwZ); deck.userData.noOutline = true; highway.add(deck);
    const wall = box(hwLen, 0.9, 0.3, look.toonMaterial({ color: 0x343760 })); const wallGeo = merged([{ geo: wall.geometry, pos: [0, hwY + 1.0, hwZ - 7] }, { geo: wall.geometry, pos: [0, hwY + 1.0, hwZ + 7] }]);
    highway.add(noOutline(new THREE.Mesh(wallGeo, wall.material)));
    const nP = Math.floor(hwLen / 26); const piers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, hwY, 2.4), pierMat, nP);
    for (let i = 0; i < nP; i++) { m4.makeTranslation(-hwLen / 2 + 13 + i * 26, hwY / 2, hwZ); piers.setMatrixAt(i, m4); } piers.userData.noOutline = true; highway.add(piers);
    // lamp posts as sodium glows
    const lp = [], lc = [], ls = []; for (let i = 0; i < nP * 2; i++) { lp.push(-hwLen / 2 + 7 + i * 13, hwY + 6, hwZ + (i % 2 ? 6.5 : -6.5)); lc.push(1, 0.72, 0.35); ls.push(2.2); }
    highway.add(glowPoints(lp, lc, ls, { size: 1.0 }));
    // light streaks: instanced thin boxes, headlights (white, moving +X) and tail lights (red, moving -X)
    const mk = (color, n) => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.18, 0.22), look.flatMaterial({ color }), n); im.userData.noOutline = true; im.frustumCulled = false; return im; };
    streaks.fwd = mk(0xfff6dc, 70); streaks.back = mk(0xff3b3b, 70);
    streaks.seeds = []; for (let i = 0; i < 70; i++) streaks.seeds.push({ o: r() * hwLen, s: 0.9 + r() * 0.6, lane: r() < 0.5 ? 2.2 : 4.6, hop: Math.floor(r() * 3) });
    highway.add(streaks.fwd, streaks.back);
  }
  group.add(highway);
  // river crossing the far-middle of the city with smeared reflections
  let river = null;
  if (wantRiver) {
    const rz = -20 - extent * 0.62, rw = extent * 0.14;
    const rTex = canvasTex(1024, 256, (g, w, h) => {
      g.fillStyle = '#07081a'; g.fillRect(0, 0, w, h);
      const cs = ['#ff3fa4', '#3ff0ff', '#ffb347', '#fff2cc', '#8a4cff'];
      for (let i = 0; i < 260; i++) { const x = r() * w, ww = 1 + r() * 4, hh = 20 + r() * 150, c = cs[Math.floor(r() * cs.length)];
        const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.25 + r() * 0.5; g.fillStyle = gr; g.save(); g.translate(x, 0); g.fillRect(-ww / 2, 0, ww, hh); g.restore(); }
      g.globalAlpha = 1;
    });
    river = plane(extent * 1.6, rw, look.flatMaterial({ color: 0xffffff, map: rTex })); river.material.map.repeat.set(3, 1);
    river.rotation.x = -PI / 2; river.position.set(0, 0.05, rz); river.userData.noOutline = true; group.add(river);
    // embankment walls
    const em = look.toonMaterial({ color: 0x1a1c36 }); const e1 = box(extent * 1.6, 1.5, 0.8, em, 0, 0.75, rz - rw / 2), e2 = box(extent * 1.6, 1.5, 0.8, em, 0, 0.75, rz + rw / 2); noOutline(e1); noOutline(e2); group.add(e1, e2);
    // keep towers out of the river: push any tower in the river band below ground (cheap cull)
    placements.forEach((p, i) => { if (Math.abs(p.z - rz) < rw / 2 + 1) { m4.makeTranslation(p.x, -200, p.z); towers.setMatrixAt(i, m4); } });
    towers.instanceMatrix.needsUpdate = true;
  }
  function update(local) {
    aviation.material.uniforms.uTime.value = local / 24;
    if (streaks.fwd) {
      const seeds = streaks.seeds;
      for (let i = 0; i < seeds.length; i++) {
        const sd = seeds[i]; const dist = (sd.o + local * 1.1 * sd.s) % hwLen;
        m4.makeTranslation(-hwLen / 2 + dist, hwY + 0.9, hwZ + sd.lane); streaks.fwd.setMatrixAt(i, m4);
        m4.makeTranslation(hwLen / 2 - ((sd.o * 1.7 + local * 1.0 * sd.s) % hwLen), hwY + 0.9, hwZ - sd.lane); streaks.back.setMatrixAt(i, m4);
      }
      streaks.fwd.instanceMatrix.needsUpdate = true; streaks.back.instanceMatrix.needsUpdate = true;
    }
  }
  const setHaze = ({ color, near, far } = {}) => { if (color !== undefined) uniforms.uHaze.value.set(color); if (near !== undefined) uniforms.uHazeNear.value = near; if (far !== undefined) uniforms.uHazeFar.value = far; };
  update(0);
  return { group, towers, landmarks, signs, highway, river, streetLights, aviation, setHaze, extent, towerMaterial: towerMat, update };
}
/** additive glow points with per-point colour + size */
function glowPoints(pos, col, size, { size: base = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: glowTex() }, uBase: { value: base } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uBase; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uBase * aSize * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * t.a, t.a * 0.9); }' });
  const p = new THREE.Points(g, mat); p.userData.noOutline = true; p.frustumCulled = false; return p;
}
/** blinking points: per-point phase, uniform uTime (seconds) */
function blinkPoints(pos, phase, color, size = 2) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: glowTex() }, uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aPhase; uniform float uTime, uSize; varying float vA; void main(){ float b = smoothstep(0.55, 0.75, sin(uTime * 2.4 + aPhase)); vA = 0.15 + b; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * (0.8 + b) * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uTex; uniform vec3 uColor; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor * t.a * vA, t.a * vA); }' });
  const p = new THREE.Points(g, mat); p.userData.noOutline = true; p.frustumCulled = false; return p;
}

/* ------------------------------------------------------------------ rooftop */
/** Apartment rooftop: parapet, water tank, AC units, antenna, door hut, wet floor + puddles. Floor top y=0, 16×10, view toward -Z.
 *  -> { group, update, parapet, tank, hut, antenna, acUnits, puddles, floor } */
export function createRooftop(ctx, { seed = 2 } = {}) {
  const group = new THREE.Group(); group.name = 'rooftop'; const r = ctx.rng(seed);
  const concrete = look.toonMaterial({ color: 0x3a3d52 }), concreteLt = look.toonMaterial({ color: 0x4a4e66 }), metal = look.toonMaterial({ color: 0x5c6072 }), dark = look.toonMaterial({ color: 0x23253a });
  // wet floor: dark toon slab + a glossy sheen plane (unlit, faint sky colour) + puddles
  const floor = box(16, 0.4, 10, look.toonMaterial({ color: 0x262a40 }), 0, -0.2, 0); floor.userData.noOutline = true;
  const sheenTex = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(120,110,190,0.35)'); gr.addColorStop(0.5, 'rgba(60,50,110,0.12)'); gr.addColorStop(1, 'rgba(20,20,40,0.0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${(r() * 0.05).toFixed(3)})`; g.fillRect(r() * w, r() * h, 2 + r() * 20, 1); }
  }, { wrap: THREE.ClampToEdgeWrapping });
  const sheen = plane(16, 10, look.flatMaterial({ map: sheenTex, transparent: true })); sheen.rotation.x = -PI / 2; sheen.position.y = 0.005; sheen.material.depthWrite = false; sheen.userData.noOutline = true;
  const puddles = new THREE.Group();
  const pudTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(150,130,220,0.8)'); gr.addColorStop(0.6, 'rgba(70,60,140,0.55)'); gr.addColorStop(1, 'rgba(40,30,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { wrap: THREE.ClampToEdgeWrapping });
  for (let i = 0; i < 9; i++) {
    const p = plane(1, 1, look.flatMaterial({ map: pudTex, transparent: true })); p.material.depthWrite = false;
    p.rotation.x = -PI / 2; p.rotation.z = r() * PI; p.scale.set(1.2 + r() * 2.6, 0.7 + r() * 1.6, 1); p.position.set((r() - 0.5) * 13, 0.01 + i * 0.0005, (r() - 0.5) * 8); p.userData.noOutline = true; puddles.add(p);
  }
  // parapet: back + sides, with a coping stone
  const parapet = box(16, 1, 0.3, concrete, 0, 0.5, -5);
  const coping = box(16.2, 0.12, 0.44, concreteLt, 0, 1.06, -5);
  const sideL = box(0.3, 1, 10, concrete, -7.85, 0.5, 0), sideR = box(0.3, 1, 10, concrete, 7.85, 0.5, 0);
  const copL = box(0.44, 0.12, 10, concreteLt, -7.85, 1.06, 0), copR = box(0.44, 0.12, 10, concreteLt, 7.85, 1.06, 0);
  // railing on top of the back parapet (thin bars)
  const railGeo = merged([
    { geo: new THREE.BoxGeometry(16, 0.05, 0.05), pos: [0, 1.65, -5] },
    ...Array.from({ length: 9 }, (_, i) => ({ geo: new THREE.BoxGeometry(0.05, 0.6, 0.05), pos: [-8 + 1 + i * 1.75, 1.4, -5] })),
  ]);
  const railing = new THREE.Mesh(railGeo, metal);
  // water tank on a steel frame
  const tank = new THREE.Group(); tank.position.set(-5.2, 0, -2.8);
  const tankBody = cyl(1.0, 1.0, 1.7, look.toonMaterial({ color: 0x6e6450 }), 0, 2.25, 0, 14); const tankTop = cyl(0.3, 1.0, 0.35, look.toonMaterial({ color: 0x5a5240 }), 0, 3.27, 0, 14);
  const legs = merged([[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([x, z]) => ({ geo: new THREE.BoxGeometry(0.1, 1.4, 0.1), pos: [x, 0.7, z] })).concat([{ geo: new THREE.BoxGeometry(1.6, 0.08, 1.6), pos: [0, 1.4, 0] }]));
  tank.add(tankBody, tankTop, new THREE.Mesh(legs, metal), cyl(0.05, 0.05, 1.5, metal, 0.9, 0.75, 0.6, 6));
  // AC units with fan grilles
  const acUnits = new THREE.Group();
  const grille = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a9ca8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4e5060'; g.lineWidth = 3; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(64, 64, 8 + i * 5.5, 0, TAU); g.stroke(); } g.fillStyle = '#3a3c48'; g.beginPath(); g.arc(64, 64, 8, 0, TAU); g.fill(); }, { wrap: THREE.ClampToEdgeWrapping });
  for (let i = 0; i < 4; i++) {
    const u = new THREE.Group(); const bodyMat = look.toonMaterial({ color: 0x9c9fae });
    u.add(box(1.1, 0.8, 0.45, bodyMat, 0, 0.55, 0), box(1.2, 0.1, 0.6, dark, 0, 0.1, 0));
    const face = plane(0.7, 0.7, look.flatMaterial({ map: grille })); face.position.set(0, 0.55, 0.23); face.userData.noOutline = true; u.add(face);
    u.position.set(2 + (i % 2) * 1.5, 0, -3.6 + Math.floor(i / 2) * 1.2); acUnits.add(u);
  }
  // door hut with a sloped roof, a door and a small lamp
  const hut = new THREE.Group(); hut.position.set(5.2, 0, 1.6);
  hut.add(box(2.6, 2.4, 2.2, concreteLt, 0, 1.2, 0), box(2.9, 0.18, 2.5, dark, 0, 2.45, 0));
  const door = box(0.9, 1.9, 0.08, look.toonMaterial({ color: 0x5a6a7c }), -0.3, 0.95, 1.12); hut.add(door);
  const lampShade = cyl(0.12, 0.22, 0.14, look.toonMaterial({ color: 0x8a8c96 }), 0.6, 2.2, 1.2, 8); hut.add(lampShade);
  const hutLight = new THREE.PointLight(0xffd9a0, 1.4, 7); hutLight.position.set(0.6, 2.05, 1.5); hut.add(hutLight);
  const bulb = plane(0.5, 0.5, look.flatMaterial({ color: 0xffd9a0, map: glowTex(), transparent: true })); bulb.material.blending = THREE.AdditiveBlending; bulb.material.depthWrite = false; bulb.position.set(0.6, 2.05, 1.35); bulb.userData.noOutline = true; hut.add(bulb);
  // antenna mast with cross bars, and a few cables
  const antenna = new THREE.Group(); antenna.position.set(-2.4, 0, -4.2);
  const mastGeo = merged([
    { geo: new THREE.CylinderGeometry(0.03, 0.05, 5, 6), pos: [0, 2.5, 0] },
    ...[1.2, 1.8, 2.5, 3.2, 3.9].map((y, i) => ({ geo: new THREE.BoxGeometry(1.6 - i * 0.22, 0.04, 0.04), pos: [0, y + 0.6, 0] })),
    { geo: new THREE.BoxGeometry(0.05, 1.8, 0.05), pos: [0.5, 4.2, 0] }, { geo: new THREE.BoxGeometry(0.05, 1.8, 0.05), pos: [-0.5, 4.2, 0] },
  ]);
  antenna.add(new THREE.Mesh(mastGeo, metal));
  const guyMat = new THREE.LineBasicMaterial({ color: 0x1a1a2a });
  for (const [dx, dz] of [[1.5, 1], [-1.5, 1], [0.4, 1.8]]) { const g = new THREE.BufferGeometry().setFromPoints([V3(0, 4.6, 0), V3(dx, 0, dz)]); antenna.add(new THREE.Line(g, guyMat)); }
  // pipes along the floor, a ladder, a drain and a planter
  const pipeGeo = merged([{ geo: new THREE.CylinderGeometry(0.08, 0.08, 9, 8), pos: [-7.3, 0.12, 0], rot: [PI / 2, 0, 0] }, { geo: new THREE.CylinderGeometry(0.08, 0.08, 3, 8), pos: [-6, 0.12, -4.4], rot: [0, 0, PI / 2] }]);
  const pipes = new THREE.Mesh(pipeGeo, look.toonMaterial({ color: 0x6e6256 }));
  const drain = cyl(0.25, 0.25, 0.03, dark, 1.2, 0.015, 1.5, 12); drain.userData.noOutline = true;
  const planter = new THREE.Group(); planter.position.set(-6.4, 0, 3.6); planter.add(box(1.2, 0.5, 0.5, look.toonMaterial({ color: 0x7a5a48 }), 0, 0.25, 0));
  for (let i = 0; i < 5; i++) { const leaf = mesh(new THREE.SphereGeometry(0.18 + r() * 0.1, 7, 5), look.toonMaterial({ color: 0x3f7a4a }), -0.45 + i * 0.22, 0.6 + r() * 0.15, (r() - 0.5) * 0.3); planter.add(leaf); }
  const bench = new THREE.Group(); bench.position.set(0.6, 0, 3.4); bench.add(box(1.6, 0.08, 0.45, look.toonMaterial({ color: 0x6a5a4a }), 0, 0.45, 0), box(0.08, 0.45, 0.4, metal, -0.7, 0.22, 0), box(0.08, 0.45, 0.4, metal, 0.7, 0.22, 0));
  group.add(floor, sheen, puddles, parapet, coping, sideL, sideR, copL, copR, railing, tank, acUnits, hut, antenna, pipes, drain, planter, bench);
  look.addOutline(group, { thickness: 0.015 });
  return { group, parapet, tank, hut, antenna, acUnits, puddles, floor, hutLight, update() {} };
}
