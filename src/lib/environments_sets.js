// ENVIRONMENTS department, part 2 — the ten sets the first pass never reached. Re-exported from environments.js.
// Conventions (same as the environments.js header):
//   createStationPlatform platform top y=0 spanning x∈[-2,6], z∈[-40,40]; track centre x=-3.5, rail top y=-1.
//   createTrainExterior  origin at the front coupler, cars extend along -Z, rail top y=0; car i centred at z=-10-20i.
//   createTrainInterior  seat at origin (x -0.95..0.15, top y=0.5), window plane at (-1.35,1.3,0) facing +X, wall at x=-1.4.
//   createBridge         deck top y=0 along -Z for `length`; river at y=-25.
//   createCountryside    track along -Z at x=0, ground y=0; tunnel mouth at z=+20 (train exits toward -Z).
//   createMountains      valley floor y=0; ridges stacked at z=-150, -270, ... (farther = higher, lighter).
//   createSakuraLane     track along -Z at x=0 from z=0 to -length; trees at |x|≈5..7.
//   createCoast          track along -Z at x=0 on a ledge; sea to -X at y=-30; cliff rises on +X.
//   createSeasideStation platform top y=0 spanning x∈[-1,5], z∈[-20,20]; track centre x=-3.5; stairs down on +X.
//   createBeach          sand ≈ y=0 at x=0 sloping down toward -X; water line at x≈-30, sea plane y=-0.3.
import * as THREE from 'three';
import * as look from './look.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CJK = '"Microsoft JhengHei", "PingFang TC", "Noto Sans CJK TC", "Hiragino Sans", "Yu Gothic", sans-serif';
function canvasTex(w, h, draw, { repeat = [1, 1], wrap = THREE.RepeatWrapping } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = wrap; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t;
}
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
function box(w, h, d, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 10) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z); }
function plane(w, h, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z); }
function nol(m) { m.userData.noOutline = true; return m; }
function merged(items) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const list = items.map(it => { const g = it.geo.clone(); e.set(...(it.rot || [0, 0, 0])); q.setFromEuler(e); m4.compose(V3(...(it.pos || [0, 0, 0])), q, V3(...(it.scale || [1, 1, 1]))); g.applyMatrix4(m4); return g; });
  const out = mergeGeometries(list, false); list.forEach(g => g.dispose()); return out;
}
function textPlane(lines, { w = 2, h = 0.6, px = 128, color = '#ffffff', bg = null, font = 'bold', glow = 0 } = {}) {
  const arr = Array.isArray(lines) ? lines : [lines]; const cw = Math.round(px * (w / h));
  const t = canvasTex(cw, px, (g, W, H) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = Math.round(Math.min(H * 0.6 / arr.length, W / (Math.max(...arr.map(s => s.length)) * 0.95)));
    g.font = `${font} ${fs}px ${CJK}`; if (glow) { g.shadowColor = color; g.shadowBlur = fs * glow; } g.fillStyle = color;
    arr.forEach((s, i) => g.fillText(s, W / 2, H / 2 + (i - (arr.length - 1) / 2) * fs * 1.25));
  }, { wrap: THREE.ClampToEdgeWrapping });
  const m = plane(w, h, look.flatMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); m.material.depthWrite = false; return nol(m);
}
function glow(size, color, x, y, z) {
  const t = glow._t || (glow._t = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, { wrap: THREE.ClampToEdgeWrapping }));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); s.position.set(x, y, z); return nol(s);
}
function ground(color, size = 600, y = 0) { const m = plane(size, size, look.toonMaterial({ color })); m.rotation.x = -PI / 2; m.position.y = y; return nol(m); }
function ridgeShape(r, width, baseY, amp, segs = 64, noise = 3) {
  const s = new THREE.Shape(); s.moveTo(-width / 2, -200);
  const ph = Array.from({ length: noise }, () => r() * 10);
  for (let i = 0; i <= segs; i++) { const x = -width / 2 + width * i / segs; let y = baseY; for (let k = 0; k < noise; k++) y += amp / (k + 1) * Math.abs(Math.sin(x * 0.004 * (k + 1) * 1.7 + ph[k])); s.lineTo(x, y); }
  s.lineTo(width / 2, -200); return s;
}

/* ------------------------------------------------------------------ station platform (night) */
export function createStationPlatform(ctx, { seed = 4 } = {}) {
  const group = new THREE.Group(); group.name = 'station';
  const concrete = look.toonMaterial({ color: 0x3f4358 }), dark = look.toonMaterial({ color: 0x23253a }), steel = look.toonMaterial({ color: 0x7a7f92 }), cream = look.toonMaterial({ color: 0xd9d2c2 });
  const plat = nol(box(8, 1, 80, look.toonMaterial({ color: 0x3a3e54 }), 2, -0.5, 0));
  const sheen = canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,220,170,0.28)'); gr.addColorStop(0.35, 'rgba(120,110,190,0.10)'); gr.addColorStop(1, 'rgba(40,40,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { wrap: THREE.ClampToEdgeWrapping });
  const wet = nol(plane(8, 80, look.flatMaterial({ map: sheen, transparent: true }))); wet.rotation.x = -PI / 2; wet.position.set(2, 0.004, 0); wet.material.depthWrite = false;
  const edge = nol(box(0.5, 0.06, 80, look.toonMaterial({ color: 0xe8c24a }), -1.3, 0.03, 0));
  const tactile = nol(box(0.3, 0.02, 80, look.toonMaterial({ color: 0xc8c8d0 }), -1.75, 0.01, 0));
  const trackBed = nol(box(5, 0.3, 80, dark, -3.5, -1.3, 0));
  const lamps = [], glows = new THREE.Group();
  const pillarGeo = [], canopyGeo = [];
  for (let i = -3; i <= 3; i++) {
    const z = i * 12;
    pillarGeo.push({ geo: new THREE.CylinderGeometry(0.14, 0.16, 4.2, 10), pos: [4.5, 2.1, z] });
    canopyGeo.push({ geo: new THREE.BoxGeometry(0.12, 0.3, 11.5), pos: [4.5, 4.3, z + 6] });
    const strip = nol(box(0.2, 0.08, 2.4, look.flatMaterial({ color: 0xfff1d8 }), 1.5, 4.05, z)); group.add(strip);
    group.add(glow(0.9, 0xfff1d8, 1.5, 4.0, z));
    const l = new THREE.PointLight(0xffe2b0, 2, 22, 1.5); l.position.set(1.5, 3.8, z); lamps.push(l); group.add(l);
  }
  const canopy = nol(box(9, 0.14, 80, look.toonMaterial({ color: 0x2c2f44 }), 2.5, 4.45, 0));
  const canopyUnder = nol(box(8.9, 0.02, 79.8, look.toonMaterial({ color: 0x5a5570 }), 2.5, 4.37, 0));
  group.add(new THREE.Mesh(merged(pillarGeo), steel), new THREE.Mesh(merged(canopyGeo), steel), canopy, canopyUnder);
  // back wall with posters, a hanging sign, benches, vending machine
  const wall = nol(box(0.3, 4.4, 80, look.toonMaterial({ color: 0x4a4d64 }), 6, 2.2, 0));
  const sign = textPlane(['晨光駅', 'First Light'], { w: 3.2, h: 1.1, color: '#1b2140', bg: '#f2efe6', px: 160 }); sign.position.set(1.4, 3.0, -6); sign.rotation.y = -PI / 2;
  const signFrame = box(0.06, 1.2, 3.3, dark, 1.4, 3.0, -6); const signRod = cyl(0.03, 0.03, 0.8, steel, 1.4, 3.95, -6, 6);
  const r = ctx.rng(seed);
  for (let i = 0; i < 6; i++) { const p = textPlane([['海', '旅'][i % 2]], { w: 1.0, h: 1.4, color: ['#ff3fa4', '#3ff0ff', '#ffb347'][i % 3], bg: ['#1a1b3a', '#2a1850', '#101828'][i % 3], px: 96, font: 'normal' }); p.position.set(5.84, 2.1, -30 + i * 11 + r() * 3); p.rotation.y = -PI / 2; group.add(p); }
  const benchGeo = [], benchMat = look.toonMaterial({ color: 0x6d6250 });
  for (const z of [-20, 4, 26]) benchGeo.push({ geo: new THREE.BoxGeometry(0.45, 0.08, 1.8), pos: [5.2, 0.48, z] }, { geo: new THREE.BoxGeometry(0.08, 0.48, 0.4), pos: [5.2, 0.24, z - 0.7] }, { geo: new THREE.BoxGeometry(0.08, 0.48, 0.4), pos: [5.2, 0.24, z + 0.7] });
  const benches = new THREE.Mesh(merged(benchGeo), benchMat);
  const vend = new THREE.Group(); vend.position.set(5.3, 0, -10);
  vend.add(box(0.8, 1.9, 1.1, look.toonMaterial({ color: 0xd84a5a }), 0, 0.95, 0), nol(box(0.02, 1.0, 0.8, look.flatMaterial({ color: 0xfff6e0 }), -0.42, 1.2, 0)), glow(0.7, 0xfff0d0, -0.6, 1.2, 0));
  const vendLight = new THREE.PointLight(0xfff0d0, 1.2, 6); vendLight.position.set(4.6, 1.2, -10); group.add(vendLight);
  const clock = nol(plane(0.5, 0.5, look.flatMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(32, 32, 30, 0, PI * 2); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 12); g.moveTo(32, 32); g.lineTo(46, 36); g.stroke(); }, { wrap: THREE.ClampToEdgeWrapping }) }))); clock.position.set(1.4, 3.7, 10); clock.rotation.y = -PI / 2;
  group.add(plat, wet, edge, tactile, trackBed, wall, sign, signFrame, signRod, benches, vend, clock);
  look.addOutline(group, { thickness: 0.014 });
  return { group, lamps, plat, canopy, sign, update(f) { lamps.forEach((l, i) => { l.intensity = 2 + 0.18 * Math.sin(f * 0.7 + i * 1.3); }); } };
}

/* ------------------------------------------------------------------ train exterior */
export function createTrainExterior(ctx, { cars = 4 } = {}) {
  const group = new THREE.Group(); group.name = 'train';
  const bodyMat = look.toonMaterial({ color: 0xbfc9d8 }), navy = look.toonMaterial({ color: 0x24305e }), gold = look.toonMaterial({ color: 0xffc46a, emissive: 0x664400, emissiveIntensity: 0.25 });
  const glass = look.flatMaterial({ color: 0xffd9a0 }); const dark = look.toonMaterial({ color: 0x1c1d2a }), steel = look.toonMaterial({ color: 0x5a5f72 });
  const list = [], doors = [];
  const winTex = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#ffd9a0'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,30,20,0.35)'; for (let i = 0; i < 16; i++) { g.fillRect(i * 32 + 28, 0, 4, h); } g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, 10); }, { repeat: [1, 1] });
  for (let i = 0; i < cars; i++) {
    const car = new THREE.Group(); const z = -10 - i * 20;
    // body: box + rounded roof
    car.add(box(3, 2.4, 19, bodyMat, 0, 1.9, z));
    const roof = mesh(new THREE.CylinderGeometry(1.5, 1.5, 19, 24, 1, false, -PI / 2, PI), look.toonMaterial({ color: 0xcfd6e0 })); roof.rotation.x = PI / 2; roof.rotation.y = 0; roof.position.set(0, 3.1, z); roof.scale.set(1, 0.42, 1); car.add(roof);
    car.add(nol(box(3.02, 0.5, 19.02, navy, 0, 0.95, z)), nol(box(3.03, 0.08, 19.02, gold, 0, 1.24, z)));
    // window strip both sides
    for (const sx of [-1, 1]) { const w = nol(plane(17, 0.95, look.flatMaterial({ map: winTex }))); w.position.set(sx * 1.52, 2.25, z); w.rotation.y = sx * PI / 2; car.add(w); }
    // doors (sliding, both sides) at the front and rear of each car
    for (const dz of [z + 6.5, z - 6.5]) for (const sx of [-1, 1]) {
      const d = box(0.06, 2.0, 1.3, look.toonMaterial({ color: 0xd3dae6 }), sx * 1.53, 1.75, dz);
      const dw = nol(plane(0.5, 0.8, glass)); dw.position.set(sx * 0.04, 0.45, 0); dw.rotation.y = sx * PI / 2; d.add(dw);
      d.userData.baseZ = dz; d.userData.open = (t) => { d.position.z = dz + 1.25 * t; }; d.open = d.userData.open; car.add(d); doors.push(d);
    }
    // bogies + wheels, underframe, roof equipment
    const bg = []; for (const bz of [z + 6, z - 6]) { bg.push({ geo: new THREE.BoxGeometry(2.4, 0.5, 2.6), pos: [0, 0.45, bz] }); for (const wx of [-1, 1]) for (const wz of [-0.9, 0.9]) bg.push({ geo: new THREE.CylinderGeometry(0.45, 0.45, 0.2, 14), pos: [wx * 0.75, 0.45, bz + wz], rot: [0, 0, PI / 2] }); }
    car.add(new THREE.Mesh(merged(bg), dark));
    car.add(box(1.2, 0.3, 3, steel, 0, 3.75, z - 3), box(0.4, 0.25, 1.2, steel, 0, 3.72, z + 5));
    group.add(car); list.push(car);
  }
  // nose: tapered front, cab windscreen, headlights, tail lights
  const nose = mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 24, 1, false, -PI / 2, PI), bodyMat); nose.rotation.x = PI / 2; nose.position.set(0, 1.9, -0.2); nose.scale.set(1, 0.9, 1); nose.rotation.z = 0; group.add(nose);
  const front = mesh(new THREE.SphereGeometry(1.5, 24, 16, 0, PI * 2, 0, PI / 2), bodyMat); front.rotation.x = -PI / 2; front.position.set(0, 1.9, -0.2); front.scale.set(1, 1.0, 1.2); group.add(front);
  const screen = nol(plane(2.0, 0.9, look.flatMaterial({ color: 0x1a2a40 }))); screen.position.set(0, 2.45, 1.08); screen.rotation.x = -0.35; group.add(screen);
  const headlights = new THREE.PointLight(0xfff2cc, 4, 50, 1.6); headlights.position.set(0, 1.3, 1.2); group.add(headlights);
  for (const x of [-0.95, 0.95]) group.add(nol(plane(0.42, 0.42, look.flatMaterial({ color: 0xfff6dc }))).translateX(x).translateY(1.15).translateZ(1.02), glow(0.7, 0xfff2cc, x, 1.15, 1.2));
  const tail = new THREE.PointLight(0xff3a3a, 1.2, 20); tail.position.set(0, 1.2, -cars * 20 + 0.5); group.add(tail);
  for (const x of [-0.95, 0.95]) group.add(glow(1.2, 0xff4040, x, 1.15, -cars * 20 + 0.2));
  group.add(nol(box(3.1, 0.5, 0.3, navy, 0, 0.95, 1.0)));
  look.addOutline(group, { thickness: 0.02 });
  let doorT = 0;
  return { group, cars: list, headlights, tail, doors, setDoors(t) { doorT = t; doors.forEach(d => d.userData.open(t)); }, update() {} };
}

/* ------------------------------------------------------------------ train interior */
export function createTrainInterior(ctx) {
  const group = new THREE.Group(); group.name = 'interior';
  const wallMat = look.toonMaterial({ color: 0xece7dc }), floorMat = look.toonMaterial({ color: 0x4e4a56 }), seatMat = look.toonMaterial({ color: 0x3f6b7a }), seatDk = look.toonMaterial({ color: 0x2f5260 }), steel = look.toonMaterial({ color: 0x9aa0b0 });
  const L = 18;
  group.add(nol(box(2.8, 0.1, L, floorMat, 0, -0.05, 0)), nol(box(0.1, 2.6, L, wallMat, -1.4, 1.3, 0)), nol(box(0.1, 2.6, L, wallMat, 1.4, 1.3, 0)), nol(box(2.9, 0.1, L, look.toonMaterial({ color: 0xf4f1ea }), 0, 2.6, 0)));
  // window on -X with frame; windowMesh is the plane a shot may texture
  const windowMesh = nol(plane(1.6, 1.1, new THREE.MeshBasicMaterial({ color: 0x0a0c1a }))); windowMesh.position.set(-1.35, 1.3, 0); windowMesh.rotation.y = PI / 2;
  const windowGlass = nol(plane(1.6, 1.1, look.flatMaterial({ color: 0x9fc0ff, opacity: 0.08, transparent: true }))); windowGlass.position.set(-1.34, 1.3, 0); windowGlass.rotation.y = PI / 2; windowGlass.material.depthWrite = false;
  const frameGeo = merged([{ geo: new THREE.BoxGeometry(0.06, 0.08, 1.75), pos: [-1.36, 0.72, 0] }, { geo: new THREE.BoxGeometry(0.06, 0.08, 1.75), pos: [-1.36, 1.88, 0] }, { geo: new THREE.BoxGeometry(0.06, 1.2, 0.08), pos: [-1.36, 1.3, -0.84] }, { geo: new THREE.BoxGeometry(0.06, 1.2, 0.08), pos: [-1.36, 1.3, 0.84] }]);
  group.add(windowMesh, windowGlass, new THREE.Mesh(frameGeo, steel));
  // more windows along the wall (plain dark glass), both sides
  for (let i = -2; i <= 2; i++) { if (i === 0) continue; for (const sx of [-1, 1]) { const w = nol(plane(1.6, 1.1, new THREE.MeshBasicMaterial({ color: 0x0b0d1c }))); w.position.set(sx * 1.35, 1.3, i * 3.5); w.rotation.y = -sx * PI / 2; group.add(w); } }
  // seats: the hero seat at origin + rows
  const seat = new THREE.Group();
  seat.add(box(1.1, 0.5, 0.9, seatMat, -0.4, 0.25, 0), box(1.1, 0.95, 0.18, seatDk, -0.4, 0.95, -0.52), box(0.12, 0.35, 0.9, seatDk, 0.18, 0.62, 0));
  group.add(seat);
  for (let i = -2; i <= 2; i++) { if (i === 0) continue; for (const sx of [-1, 1]) { const s = new THREE.Group(); s.add(box(1.1, 0.5, 0.9, seatMat, sx * 0.85, 0.25, 0), box(1.1, 0.95, 0.18, seatDk, sx * 0.85, 0.95, -0.52)); s.position.z = i * 3.5; if (sx > 0 && i === 0) continue; group.add(s); } }
  // rack, rails, straps, lamps
  const rack = merged([{ geo: new THREE.BoxGeometry(0.5, 0.03, L - 1), pos: [-1.05, 2.05, 0] }, { geo: new THREE.BoxGeometry(0.5, 0.03, L - 1), pos: [1.05, 2.05, 0] }, { geo: new THREE.CylinderGeometry(0.02, 0.02, L - 1, 6), pos: [-0.7, 1.95, 0], rot: [PI / 2, 0, 0] }, { geo: new THREE.CylinderGeometry(0.02, 0.02, L - 1, 6), pos: [0.7, 1.95, 0], rot: [PI / 2, 0, 0] }]);
  group.add(new THREE.Mesh(rack, steel));
  const strapGeo = []; for (let i = 0; i < 12; i++) strapGeo.push({ geo: new THREE.TorusGeometry(0.08, 0.015, 6, 14), pos: [-0.7 + (i % 2) * 1.4, 1.7, -7 + i * 1.3] }, { geo: new THREE.BoxGeometry(0.03, 0.2, 0.01), pos: [-0.7 + (i % 2) * 1.4, 1.86, -7 + i * 1.3] });
  group.add(new THREE.Mesh(merged(strapGeo), look.toonMaterial({ color: 0xd9d4c8 })));
  const lamps = [];
  for (let i = -2; i <= 2; i++) { const panel = nol(box(0.9, 0.03, 1.6, look.flatMaterial({ color: 0xfff0d0 }), 0, 2.57, i * 3.5)); group.add(panel); const l = new THREE.PointLight(0xfff0d0, 1.2, 6, 1.4); l.position.set(0, 2.3, i * 3.5); lamps.push(l); group.add(l); }
  const poster = textPlane(['晨光列車', '海へ'], { w: 0.6, h: 0.85, color: '#2a3a6a', bg: '#f6efe0', px: 128 }); poster.position.set(1.34, 1.8, 1.9); poster.rotation.y = -PI / 2; group.add(poster);
  const ad = textPlane(['早晨', '咖啡'], { w: 0.6, h: 0.85, color: '#ffffff', bg: '#c0523a', px: 128 }); ad.position.set(1.34, 1.8, -1.9); ad.rotation.y = -PI / 2; group.add(ad);
  look.addOutline(group, { thickness: 0.01 });
  return { group, seat, windowMesh, windowGlass, lamps, setOutside(c) { if (c && c.isTexture) { windowMesh.material.map = c; windowMesh.material.color.set(0xffffff); } else windowMesh.material.color.set(c); windowMesh.material.needsUpdate = true; }, update() {} };
}

/* ------------------------------------------------------------------ bridge */
export function createBridge(ctx, { length = 300 } = {}) {
  const group = new THREE.Group(); group.name = 'bridge';
  const steel = look.toonMaterial({ color: 0x2c3140 }), steelLt = look.toonMaterial({ color: 0x3d4356 });
  group.add(nol(box(7, 1, length, steel, 0, -0.5, -length / 2)));
  const truss = [];
  for (let z = 0; z < length; z += 10) {
    for (const x of [-3.6, 3.6]) truss.push({ geo: new THREE.BoxGeometry(0.3, 7, 0.3), pos: [x, 3.5, -z] }, { geo: new THREE.BoxGeometry(0.2, 10.4, 0.2), pos: [x, 3.5, -z - 5], rot: [-PI / 4 * 1.0, 0, 0] });
    truss.push({ geo: new THREE.BoxGeometry(7.6, 0.3, 0.3), pos: [0, 7, -z] });
  }
  for (const x of [-3.6, 3.6]) truss.push({ geo: new THREE.BoxGeometry(0.35, 0.35, length), pos: [x, 7, -length / 2] }, { geo: new THREE.BoxGeometry(0.35, 0.35, length), pos: [x, 0.2, -length / 2] });
  group.add(new THREE.Mesh(merged(truss), steelLt));
  // piers down to the water
  const piers = []; for (let z = 20; z < length; z += 60) piers.push({ geo: new THREE.BoxGeometry(5, 26, 3), pos: [0, -13, -z] });
  group.add(new THREE.Mesh(merged(piers), steel));
  // catenary poles + wire
  const poles = []; for (let z = 5; z < length; z += 30) poles.push({ geo: new THREE.CylinderGeometry(0.08, 0.1, 6, 6), pos: [2.2, 3, -z] }, { geo: new THREE.BoxGeometry(2.2, 0.06, 0.06), pos: [1.2, 5.8, -z] });
  group.add(new THREE.Mesh(merged(poles), steelLt));
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, 5.6, 0), V3(0, 5.6, -length)]), new THREE.LineBasicMaterial({ color: 0x111622 })); group.add(wire);
  // river with reflected light dots
  const riverTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#0b1030'; g.fillRect(0, 0, w, h); const r = ctx.rng(66); const cols = ['#ff3fa4', '#3ff0ff', '#ffb347', '#ffffff', '#8f7bff']; for (let i = 0; i < 900; i++) { g.fillStyle = cols[i % 5]; g.globalAlpha = 0.15 + r() * 0.5; g.fillRect(r() * w, r() * h, 1 + r() * 3, 6 + r() * 30); } }, { repeat: [3, 3] });
  const river = nol(plane(900, 900, look.flatMaterial({ map: riverTex }))); river.rotation.x = -PI / 2; river.position.set(0, -25, -length / 2); group.add(river);
  const bank = nol(box(900, 6, 40, look.toonMaterial({ color: 0x14162a }), 0, -22, 18)); group.add(bank);
  look.addOutline(group, { thickness: 0.02 });
  return { group, river, update(f) { riverTex.offset.y = f * 0.0008; } };
}

/* ------------------------------------------------------------------ countryside (blue hour) */
export function createCountryside(ctx, { seed = 3 } = {}) {
  const group = new THREE.Group(); group.name = 'countryside'; const r = ctx.rng(seed);
  group.add(ground(0x1b2738, 1200, -0.6));
  // stepped rice paddies: reflective planes with low dykes, left and right of the track
  const paddyMat = look.flatMaterial({ color: 0x5a6a9a }); paddyMat.transparent = true; paddyMat.opacity = 0.85;
  const dykes = [], dykeMat = look.toonMaterial({ color: 0x2a3444 });
  for (let i = 0; i < 40; i++) for (const sx of [-1, 1]) {
    const w = 18 + r() * 30, d = 14 + r() * 22, x = sx * (6 + r() * 140), z = -i * 20 - r() * 10;
    const p = nol(plane(w, d, paddyMat)); p.rotation.x = -PI / 2; p.position.set(x, -0.5 + (r() * 0.4), z); group.add(p);
    dykes.push({ geo: new THREE.BoxGeometry(w + 0.6, 0.5, 0.6), pos: [x, -0.3, z - d / 2] }, { geo: new THREE.BoxGeometry(0.6, 0.5, d), pos: [x - w / 2, -0.3, z] });
  }
  group.add(new THREE.Mesh(merged(dykes), dykeMat));
  // power poles with wires
  const poles = []; const wirePts = [];
  for (let i = 0; i < 24; i++) { const z = -i * 30, x = 9; poles.push({ geo: new THREE.CylinderGeometry(0.12, 0.16, 9, 6), pos: [x, 4.5, z] }, { geo: new THREE.BoxGeometry(2.2, 0.1, 0.1), pos: [x, 8.3, z] }); wirePts.push(V3(x - 1, 8.3, z), V3(x - 1, 8.3, z - 30), V3(x + 1, 8.3, z), V3(x + 1, 8.3, z - 30)); }
  group.add(new THREE.Mesh(merged(poles), look.toonMaterial({ color: 0x2a2a36 })));
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x0e1020 })));
  // farmhouses with one lit window
  for (let i = 0; i < 8; i++) {
    const h = new THREE.Group(); const x = (r() < 0.5 ? -1 : 1) * (30 + r() * 110), z = -40 - r() * 500;
    h.add(box(7, 3.2, 6, look.toonMaterial({ color: 0x3a3340 }), 0, 1.6, 0));
    const roof = mesh(new THREE.ConeGeometry(5.6, 2.6, 4), look.toonMaterial({ color: 0x2a2634 })); roof.rotation.y = PI / 4; roof.position.y = 4.5; roof.scale.set(1, 1, 0.85); h.add(roof);
    const win = nol(plane(0.9, 0.7, look.flatMaterial({ color: 0xffd9a0 }))); win.position.set(-1.5, 1.6, 3.02); h.add(win, glow(1.4, 0xffd9a0, -1.5, 1.6, 3.2));
    const wl = new THREE.PointLight(0xffd9a0, 1.5, 18); wl.position.set(-1.5, 1.6, 4); h.add(wl);
    h.position.set(x, 0, z); h.rotation.y = r() * 0.6 - 0.3; group.add(h);
  }
  // trees (dark lollipops) and low hills
  const trees = []; for (let i = 0; i < 60; i++) { const x = (r() < 0.5 ? -1 : 1) * (14 + r() * 200), z = -r() * 600, s = 1.5 + r() * 3; trees.push({ geo: new THREE.CylinderGeometry(0.15, 0.2, 2, 5), pos: [x, 1, z], scale: [s, s, s] }, { geo: new THREE.SphereGeometry(1.4, 8, 6), pos: [x, 2.6 * s, z], scale: [s, s * 1.1, s] }); }
  group.add(new THREE.Mesh(merged(trees), look.toonMaterial({ color: 0x1a2a2c })));
  const hills = []; for (let i = 0; i < 9; i++) hills.push({ geo: new THREE.SphereGeometry(1, 20, 10), pos: [(r() - 0.5) * 1000, -20, -350 - r() * 500], scale: [120 + r() * 160, 60 + r() * 50, 120] });
  group.add(nol(new THREE.Mesh(merged(hills), look.toonMaterial({ color: 0x1f2a44 }))));
  // tunnel portal at z=+20 (train exits toward -Z): arch face + hill behind it
  const tunnel = new THREE.Group(); tunnel.position.z = 20;
  const face = new THREE.Shape(); face.moveTo(-14, -1); face.lineTo(14, -1); face.lineTo(14, 9); face.lineTo(-14, 9); face.lineTo(-14, -1);
  const hole = new THREE.Path(); hole.absarc(0, 2.2, 3.4, 0, PI, false); hole.lineTo(-3.4, -1); hole.lineTo(3.4, -1); face.holes.push(hole);
  tunnel.add(new THREE.Mesh(new THREE.ShapeGeometry(face, 24), look.toonMaterial({ color: 0x3a3340 })));
  const hill = mesh(new THREE.SphereGeometry(60, 24, 16), look.toonMaterial({ color: 0x1e2838 })); hill.position.set(0, -10, 50); tunnel.add(hill);
  const bore = mesh(new THREE.CylinderGeometry(3.4, 3.4, 60, 20, 1, true), look.toonMaterial({ color: 0x07070c, side: THREE.BackSide })); bore.rotation.x = PI / 2; bore.position.set(0, 2.2, 30); tunnel.add(nol(bore));
  group.add(tunnel);
  look.addOutline(group, { thickness: 0.02 });
  return { group, tunnel, update() {} };
}

/* ------------------------------------------------------------------ mountains (dawn) */
export function createMountains(ctx, { seed = 4 } = {}) {
  const group = new THREE.Group(); group.name = 'mountains'; const r = ctx.rng(seed); const ridges = [];
  const cols = [0x1b2050, 0x2a2f68, 0x3c3f80, 0x565a9a, 0x7678b4, 0x9a9bcc, 0xbdbde0];
  for (let i = 0; i < 7; i++) {
    const shape = ridgeShape(r, 2600 + i * 700, 10 + i * 26, 50 + i * 30, 90, 3);
    const m = nol(new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), look.flatMaterial({ color: cols[i] })));
    m.position.set((r() - 0.5) * 200, 0, -420 - i * 170); group.add(m); ridges.push(m);
  }
  group.add(ground(0x253142, 3000, 0));
  // valley floor detail: a thin river thread and dark forest clumps
  const riv = nol(plane(6, 1200, look.flatMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55 }))); riv.rotation.x = -PI / 2; riv.position.set(-40, 0.05, -500); riv.rotation.z = 0.08; group.add(riv);
  const forest = []; for (let i = 0; i < 160; i++) { const s = 3 + r() * 6; forest.push({ geo: new THREE.ConeGeometry(1, 2.4, 6), pos: [(r() - 0.5) * 500, s * 1.2, -40 - r() * 400], scale: [s, s, s] }); }
  group.add(new THREE.Mesh(merged(forest), look.toonMaterial({ color: 0x15202e })));
  return { group, ridges, update() {} };
}

/* ------------------------------------------------------------------ sakura lane */
export function createSakuraLane(ctx, { seed = 5, length = 200 } = {}) {
  const group = new THREE.Group(); group.name = 'sakura'; const r = ctx.rng(seed); const trees = [];
  group.add(ground(0x6f8f58, 800, -0.5));
  const petalGround = nol(plane(26, length + 40, look.toonMaterial({ color: 0xf2c6d6 }))); petalGround.rotation.x = -PI / 2; petalGround.position.set(0, -0.45, -length / 2); group.add(petalGround);
  const trunkMat = look.toonMaterial({ color: 0x4a3328 }), crowns = [0xffc9d9, 0xffb3c9, 0xffe0ea].map(c => look.toonMaterial({ color: c, lit: 0xfff4f8 }));
  const trunkGeo = [], crownGeo = [[], [], []];
  for (let i = 0; i < length / 7; i++) for (const side of [-1, 1]) {
    const x = side * (5.2 + r() * 2.2), z = -i * 7 - r() * 3, s = 0.85 + r() * 0.5;
    trunkGeo.push({ geo: new THREE.CylinderGeometry(0.22, 0.45, 3.2, 7), pos: [x, 1.1, z], scale: [s, s, s] });
    for (let b = 0; b < 3; b++) trunkGeo.push({ geo: new THREE.CylinderGeometry(0.08, 0.16, 2.4, 5), pos: [x + (r() - 0.5) * 1.6 * s, 3.4 * s, z + (r() - 0.5) * 1.2], rot: [(r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2], scale: [s, s, s] });
    for (let c = 0; c < 7; c++) { const k = c % 3; crownGeo[k].push({ geo: new THREE.SphereGeometry(1.6 + r() * 1.2, 9, 7), pos: [x + (r() - 0.5) * 3.6 * s, (4.2 + r() * 2.4) * s, z + (r() - 0.5) * 3.2 * s] }); }
    const t = new THREE.Group(); t.position.set(x, 0, z); trees.push(t);
  }
  group.add(new THREE.Mesh(merged(trunkGeo), trunkMat));
  crownGeo.forEach((g, k) => { if (g.length) group.add(new THREE.Mesh(merged(g), crowns[k])); });
  // wooden fence along both sides, a tiny rural platform
  const fence = []; for (let z = 0; z < length; z += 3) for (const sx of [-1, 1]) fence.push({ geo: new THREE.BoxGeometry(0.1, 1.1, 0.1), pos: [sx * 3.6, 0.55, -z] });
  for (const sx of [-1, 1]) fence.push({ geo: new THREE.BoxGeometry(0.06, 0.08, length), pos: [sx * 3.6, 0.95, -length / 2] }, { geo: new THREE.BoxGeometry(0.06, 0.08, length), pos: [sx * 3.6, 0.55, -length / 2] });
  group.add(new THREE.Mesh(merged(fence), look.toonMaterial({ color: 0x8a6a4a })));
  const platform = nol(box(3, 0.6, 14, look.toonMaterial({ color: 0xcfc6b4 }), 4.5, -0.2, -length / 2)); group.add(platform);
  look.addOutline(group, { thickness: 0.02 });
  return { group, trees, update() {} };
}

/* ------------------------------------------------------------------ coast */
export function createCoast(ctx, { seed = 6 } = {}) {
  const group = new THREE.Group(); group.name = 'coast'; const r = ctx.rng(seed);
  const rockA = look.toonMaterial({ color: 0x7a7462 }), rockB = look.toonMaterial({ color: 0x5f5a4c }), grass = look.toonMaterial({ color: 0x6f9a5a });
  // ledge the track runs on, cliff rising on +X, drop to the sea on -X
  group.add(nol(box(12, 2, 700, rockA, 3, -1, -250)));
  group.add(nol(box(10, 1.2, 700, grass, 4, 0.2, -250)).translateX(6));
  const cliff = new THREE.Group();
  const layers = []; for (let i = 0; i < 5; i++) layers.push({ geo: new THREE.BoxGeometry(40 + i * 14, 9, 700), pos: [25 + i * 10, 4 + i * 8.5, -250 - i * 12] });
  cliff.add(new THREE.Mesh(merged(layers), rockB));
  const bumps = []; for (let i = 0; i < 90; i++) bumps.push({ geo: new THREE.DodecahedronGeometry(1, 0), pos: [12 + r() * 40, 1 + r() * 36, -r() * 650], scale: [4 + r() * 8, 3 + r() * 6, 4 + r() * 8] });
  cliff.add(new THREE.Mesh(merged(bumps), rockA));
  const under = []; for (let i = 0; i < 40; i++) under.push({ geo: new THREE.BoxGeometry(14, 30, 30), pos: [-6 + r() * 4, -17, -i * 18], rot: [0, (r() - 0.5) * 0.3, (r() - 0.5) * 0.2] });
  cliff.add(new THREE.Mesh(merged(under), rockB));
  group.add(cliff);
  // guard rail
  const rail = []; for (let z = 0; z < 700; z += 4) rail.push({ geo: new THREE.BoxGeometry(0.08, 1.0, 0.08), pos: [-2.6, 0.5, -z] });
  rail.push({ geo: new THREE.BoxGeometry(0.05, 0.05, 700), pos: [-2.6, 1.0, -350] }); group.add(new THREE.Mesh(merged(rail), look.toonMaterial({ color: 0xd8dde8 })));
  // sea fallback plane, far lighthouse on a headland
  const sea = nol(plane(3000, 3000, look.flatMaterial({ color: 0x2f8fd6 }))); sea.rotation.x = -PI / 2; sea.position.set(-1500, -30, -300); group.add(sea);
  const head = new THREE.Group(); head.position.set(-140, -30, -620);
  head.add(nol(mesh(new THREE.ConeGeometry(70, 48, 7), rockB)).translateY(24), cyl(2.2, 3, 16, look.toonMaterial({ color: 0xf4f1ea }), 0, 56, 0, 10), cyl(2.6, 2.6, 2.2, look.toonMaterial({ color: 0xc0404a }), 0, 65, 0, 10), glow(10, 0xfff0c0, 0, 65, 0));
  group.add(head);
  look.addOutline(group, { thickness: 0.03 });
  return { group, sea, cliff, update() {} };
}

/* ------------------------------------------------------------------ seaside station */
export function createSeasideStation(ctx, { seed = 7 } = {}) {
  const group = new THREE.Group(); group.name = 'seaside'; const r = ctx.rng(seed);
  const cream = look.toonMaterial({ color: 0xd9d0bc }), wood = look.toonMaterial({ color: 0x9a7a58 }), dark = look.toonMaterial({ color: 0x2a2a36 });
  group.add(nol(box(6, 1, 40, cream, 2, -0.5, 0)), nol(box(0.4, 0.05, 40, look.toonMaterial({ color: 0xe8c24a }), -0.6, 0.03, 0)), nol(box(5, 0.3, 40, dark, -3.5, -1.3, 0)));
  group.add(ground(0xe9d8b0, 400, -1.4));
  const bench = new THREE.Group(); bench.position.set(3.6, 0, 2);
  bench.add(box(0.5, 0.08, 1.8, wood, 0, 0.45, 0), box(0.08, 0.6, 1.8, wood, 0.25, 0.75, 0), box(0.1, 0.45, 0.1, dark, -0.15, 0.22, -0.8), box(0.1, 0.45, 0.1, dark, -0.15, 0.22, 0.8));
  const sign = textPlane(['海岸駅', 'Seaside'], { w: 2.4, h: 1.0, color: '#2a3a5a', bg: '#f7f3ea', px: 160 }); sign.position.set(1.2, 2.3, -5); const post1 = cyl(0.05, 0.05, 2.3, dark, 0.1, 1.15, -5, 6), post2 = cyl(0.05, 0.05, 2.3, dark, 2.3, 1.15, -5, 6);
  const hut = new THREE.Group(); hut.position.set(4.2, 0, -12);
  hut.add(box(3.4, 2.6, 4, look.toonMaterial({ color: 0xe9e2d2 }), 0, 1.3, 0));
  const roof = mesh(new THREE.ConeGeometry(3.3, 1.5, 4), look.toonMaterial({ color: 0x8a4a46 })); roof.rotation.y = PI / 4; roof.position.y = 3.3; roof.scale.set(1.1, 1, 1.25); hut.add(roof);
  hut.add(nol(plane(0.8, 0.8, look.flatMaterial({ color: 0x9fd0ff }))).translateX(-1.71).translateY(1.6), box(0.9, 2.0, 0.08, wood, 0, 1.0, 2.02));
  const bike = new THREE.Group(); bike.position.set(3.0, 0, -8.5); bike.rotation.y = 0.2;
  bike.add(mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 18), dark).translateZ(-0.5).translateY(0.33), mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 18), dark).translateZ(0.5).translateY(0.33), box(0.05, 0.05, 1.0, look.toonMaterial({ color: 0xd05050 }), 0, 0.6, 0), box(0.05, 0.5, 0.05, look.toonMaterial({ color: 0xd05050 }), 0, 0.6, -0.1));
  // stairs down on +X to the beach, vending machine, a palm-ish tree
  const stairs = []; for (let i = 0; i < 6; i++) stairs.push({ geo: new THREE.BoxGeometry(1.2, 0.25, 2.6), pos: [5.6 + i * 1.0, -0.12 - i * 0.25, 8] });
  group.add(new THREE.Mesh(merged(stairs), cream));
  const vend = new THREE.Group(); vend.position.set(4.3, 0, 6); vend.add(box(0.8, 1.9, 1.1, look.toonMaterial({ color: 0x3a6fd0 }), 0, 0.95, 0), nol(plane(0.8, 1.0, look.flatMaterial({ color: 0xffffff }))).translateX(-0.41).translateY(1.2).rotateY(-PI / 2));
  const tree = new THREE.Group(); tree.position.set(6.5, 0, -18);
  tree.add(cyl(0.15, 0.25, 5, wood, 0, 2.5, 0, 7)); for (let i = 0; i < 7; i++) { const leaf = mesh(new THREE.BoxGeometry(0.4, 0.05, 2.4), look.toonMaterial({ color: 0x4f9a52 })); leaf.position.set(0, 5, 0); leaf.rotation.y = i * PI * 2 / 7; leaf.rotation.x = 0.5; leaf.translateZ(1.1); tree.add(leaf); }
  group.add(bench, sign, post1, post2, hut, bike, vend, tree);
  look.addOutline(group, { thickness: 0.015 });
  return { group, sign, bench, hut, update() {} };
}

/* ------------------------------------------------------------------ beach */
export function createBeach(ctx, { seed = 8 } = {}) {
  const group = new THREE.Group(); group.name = 'beach'; const r = ctx.rng(seed);
  // sloped sand: displaced plane with ripples, darker wet band toward the water (-X)
  const geo = new THREE.PlaneGeometry(400, 400, 80, 80); geo.rotateX(-PI / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); const dry = new THREE.Color(0xf1dcb0), wet = new THREE.Color(0xc9a97a);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const y = Math.max(-0.9, -x * 0.012) + Math.sin(z * 0.6 + x * 0.3) * 0.025 + (r() - 0.5) * 0.03; pos.setY(i, Math.min(y, 1.5)); const t = THREE.MathUtils.smoothstep(-x, 18, 34); const c = dry.clone().lerp(wet, t); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const sandMat = look.toonMaterial({ color: 0xffffff }); sandMat.vertexColors = true;
  const sand = nol(new THREE.Mesh(geo, sandMat)); group.add(sand);
  const sea = nol(plane(3000, 3000, look.flatMaterial({ color: 0x2f8fd6 }))); sea.rotation.x = -PI / 2; sea.position.set(-1530, -0.3, 0); group.add(sea);
  // rocks, driftwood, dune grass, distant pier
  const rocks = []; for (let i = 0; i < 14; i++) rocks.push({ geo: new THREE.DodecahedronGeometry(1, 0), pos: [-10 + r() * 60, 0.2, (r() - 0.5) * 160], scale: [0.6 + r() * 2.5, 0.4 + r() * 1.4, 0.6 + r() * 2.5], rot: [0, r() * 3, 0] });
  group.add(new THREE.Mesh(merged(rocks), look.toonMaterial({ color: 0x6e6a60 })));
  const wood = []; for (let i = 0; i < 5; i++) wood.push({ geo: new THREE.CylinderGeometry(0.15, 0.25, 3 + r() * 3, 6), pos: [-5 + r() * 30, 0.3, (r() - 0.5) * 120], rot: [0, 0, PI / 2 + (r() - 0.5) * 0.3] });
  group.add(new THREE.Mesh(merged(wood), look.toonMaterial({ color: 0x8a7658 })));
  const grassG = []; for (let i = 0; i < 300; i++) { const x = 20 + r() * 40, z = (r() - 0.5) * 200; grassG.push({ geo: new THREE.ConeGeometry(0.06, 0.9 + r() * 0.6, 3), pos: [x, 0.3 - x * 0.012 + 0.45, z], rot: [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5] }); }
  group.add(new THREE.Mesh(merged(grassG), look.toonMaterial({ color: 0x9fb06a })));
  const pier = []; for (let i = 0; i < 12; i++) pier.push({ geo: new THREE.BoxGeometry(0.5, 4, 0.5), pos: [-40 - i * 8, -1, -140] }); pier.push({ geo: new THREE.BoxGeometry(100, 0.4, 3), pos: [-85, 1.2, -140] });
  group.add(new THREE.Mesh(merged(pier), look.toonMaterial({ color: 0x5a4a3a })));
  look.addOutline(group, { thickness: 0.02 });
  return { group, sand, sea, update() {} };
}
