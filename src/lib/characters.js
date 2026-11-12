// CHARACTERS department — 晨光列車 / First Light Express.
// Yuki: a procedural anime girl (primitives + canvas face), toon shaded and outlined, with a joint hierarchy,
// named poses (pure functions of the frame), expression crossfades, look-at, blinks, hair/skirt sway and props.
// API (the contract): createYuki(ctx, { withUmbrella, withBag, scale }) -> rig
//   rig.group (feet at y=0, faces +Z, ~1.6 tall), rig.parts {...}, rig.pose(name, f, opts), rig.setExpression(name, blend),
//   rig.lookAt(vec3|null), rig.update(f), rig.holdLetter(bool), rig.holdPlane(bool), rig.umbrellaOpen(0..1), rig.throwRelease = 20
// createExtra(ctx, { seed, scale }) -> { group, update(f) }
import * as THREE from 'three';
import * as look from './look.js';

const PI = Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** draw an anime face (eyes, brows, nose, mouth) for an expression -> CanvasTexture */
function faceTexture(expr) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(128, 132, 112, 118, 0, 0, PI * 2); g.fill();
  const closed = expr === 'closed' || expr === 'sleep';
  const sad = expr === 'sad', smile = expr === 'smile', surprise = expr === 'surprise', calm = expr === 'calm', det = expr === 'determined';
  const eyeH = surprise ? 1.25 : calm ? 0.8 : sad ? 0.85 : det ? 0.78 : 1;
  const drawEye = (cx, dir) => {
    const w = 30, h = 36 * eyeH, y = 120;
    if (closed) { g.strokeStyle = '#2a2240'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - w, y + 2); g.quadraticCurveTo(cx, y + 14, cx + w, y + 2); g.stroke(); return; }
    // white
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, y, w, h, 0, 0, PI * 2); g.fill();
    // iris (dark navy -> violet gradient)
    const gr = g.createLinearGradient(cx, y - h, cx, y + h); gr.addColorStop(0, '#1b1a3a'); gr.addColorStop(0.55, '#3b3f8a'); gr.addColorStop(1, '#8a7ad0');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, y + 4, w * 0.62, h * 0.8, 0, 0, PI * 2); g.fill();
    g.fillStyle = '#12112a'; g.beginPath(); g.ellipse(cx, y + 6, w * 0.3, h * 0.42, 0, 0, PI * 2); g.fill();
    // highlights
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx - 9 * dir, y - 8, 7, 8, 0, 0, PI * 2); g.fill(); g.beginPath(); g.ellipse(cx + 7 * dir, y + 12, 3.5, 3.5, 0, 0, PI * 2); g.fill();
    // upper lid line + lashes
    g.strokeStyle = '#2a2240'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - w - 2, y - h * 0.25); g.quadraticCurveTo(cx, y - h - 8, cx + w + 2, y - h * 0.3); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + (w + 2) * dir, y - h * 0.3); g.lineTo(cx + (w + 9) * dir, y - h * 0.45); g.stroke();
    if (sad) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx, y + h * 0.7, w * 0.8, 6, 0, 0, PI * 2); g.fill(); }
  };
  drawEye(88, -1); drawEye(168, 1);
  // brows
  g.strokeStyle = '#2a2240'; g.lineWidth = 3.5; g.lineCap = 'round';
  const browY = surprise ? 62 : 74, tilt = sad ? -6 : det ? 7 : 0;
  g.beginPath(); g.moveTo(62, browY + 4 + tilt); g.quadraticCurveTo(88, browY - 6, 112, browY + 2 - tilt); g.stroke();
  g.beginPath(); g.moveTo(144, browY + 2 - tilt); g.quadraticCurveTo(168, browY - 6, 194, browY + 4 + tilt); g.stroke();
  // nose + mouth
  g.fillStyle = '#d9a58f'; g.beginPath(); g.ellipse(128, 160, 2.5, 3.5, 0, 0, PI * 2); g.fill();
  g.strokeStyle = '#b05a6a'; g.lineWidth = 3;
  g.beginPath();
  if (smile) { g.moveTo(112, 184); g.quadraticCurveTo(128, 198, 144, 184); }
  else if (sad) { g.moveTo(116, 190); g.quadraticCurveTo(128, 182, 140, 190); }
  else if (surprise) { g.ellipse(128, 188, 7, 9, 0, 0, PI * 2); g.fillStyle = '#7a2a3a'; g.fill(); }
  else { g.moveTo(118, 186); g.quadraticCurveTo(128, 190, 138, 186); }
  g.stroke();
  // blush
  if (smile || surprise) { g.fillStyle = 'rgba(255,140,150,0.35)'; g.beginPath(); g.ellipse(70, 160, 16, 8, 0, 0, PI * 2); g.fill(); g.beginPath(); g.ellipse(186, 160, 16, 8, 0, 0, PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const faceCache = {};
const face = expr => faceCache[expr] || (faceCache[expr] = faceTexture(expr));

function capsule(r, len, mat, seg = 10) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, seg), mat); return m; }
/** limb segment: a group pivoting at its top, with a capsule hanging down `len` */
function limb(r, len, mat) { const g = new THREE.Group(); const m = capsule(r, len, mat); m.position.y = -len / 2 - r * 0.3; g.add(m); g.userData.len = len + r * 0.6; return g; }

export function createYuki(ctx, { withUmbrella = false, withBag = true, scale = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'yuki';
  const skin = look.toonMaterial({ color: 0xf6dccb, lit: 0xffe8d8, litBoost: 0, shadeTint: 0xb98f9a });
  const hairM = look.toonMaterial({ color: 0x1e2140, shade: 0x12142a, spec: true, sheen: { color: 0x7d86d8, intensity: 0.5, offset: 0.3, width: 0.08 } });
  const blouse = look.toonMaterial({ color: 0xf6f1e6 }), cardigan = look.toonMaterial({ color: 0x2b3560, shade: 0x1b2140 }), skirtM = look.toonMaterial({ color: 0x2a2d4a, shade: 0x1a1c30 }), shoe = look.toonMaterial({ color: 0x3a2a2a }), sock = look.toonMaterial({ color: 0xf2f2f2 });

  // ---- hierarchy: hips -> torso -> chest -> neck -> head
  const hips = new THREE.Group(); hips.position.y = 0.78; group.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = capsule(0.14, 0.18, blouse, 14); body.position.y = 0.26; torso.add(body);
  const cardi = capsule(0.158, 0.14, cardigan, 14); cardi.position.y = 0.24; cardi.scale.set(1, 1.05, 0.95); torso.add(cardi);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 14), blouse); collar.rotation.x = PI / 2; collar.position.y = 0.47; torso.add(collar);
  // skirt: pleated lathe (zigzag profile)
  const prof = []; for (let i = 0; i <= 24; i++) { const a = i / 24; prof.push(new THREE.Vector2(0.17 + a * 0.12, -a * 0.36)); }
  const skirtGeo = new THREE.LatheGeometry(prof, 28); const skirt = new THREE.Mesh(skirtGeo, skirtM); skirt.position.y = 0.08;
  const pos = skirtGeo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), ang = Math.atan2(z, x); const k = 1 + 0.05 * Math.sign(Math.sin(ang * 14)) * (-(pos.getY(i)) / 0.36); pos.setXYZ(i, x * k, pos.getY(i), z * k); } skirtGeo.computeVertexNormals();
  hips.add(skirt);
  const neck = new THREE.Group(); neck.position.y = 0.5; torso.add(neck);
  neck.add(capsule(0.04, 0.05, skin, 8).translateY(0.0));
  const head = new THREE.Group(); head.position.y = 0.06; neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 28, 20), skin); skull.position.y = 0.14; skull.scale.set(0.95, 1.0, 0.92); head.add(skull);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), skin); chin.position.set(0, 0.06, 0.02); chin.scale.set(0.85, 0.8, 0.8); head.add(chin);
  // face: two crossfading planes (neutral + expression)
  // curved face patch wrapped on the skull (partial sphere: three.js maps the whole texture across the patch)
  const faceGeo = new THREE.SphereGeometry(0.1935, 32, 24, PI / 2 - 1.0, 2.0, PI / 2 - 0.85, 1.7);
  const faceA = new THREE.Mesh(faceGeo, look.toonMaterial({ color: 0xf6dccb, lit: 0xffe8d8, litBoost: 0, shadeTint: 0xb98f9a, map: face('neutral'), transparent: true })); faceA.position.set(0, 0.14, 0); faceA.scale.set(0.95, 1.0, 0.92); faceA.userData.noOutline = true;
  const faceB = new THREE.Mesh(faceGeo, look.toonMaterial({ color: 0xf6dccb, lit: 0xffe8d8, litBoost: 0, shadeTint: 0xb98f9a, map: face('calm'), transparent: true, opacity: 0 })); faceB.position.set(0, 0.14, 0); faceB.scale.set(0.952, 1.002, 0.922); faceB.userData.noOutline = true;
  head.add(faceA, faceB);
  // hair: cap + fringe + side locks + back
  const hair = new THREE.Group(); head.add(hair);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 28, 20, 0, PI * 2, 0, PI * 0.5), hairM); cap.position.y = 0.15; cap.scale.set(1, 1.05, 1); hair.add(cap);
  for (let i = 0; i < 7; i++) { const a = (i - 3) / 3; const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.07 + 0.03 * (1 - Math.abs(a)), 3, 8), hairM); f.position.set(a * 0.15, 0.25 - 0.02 * Math.abs(a), 0.14 - 0.03 * Math.abs(a)); f.rotation.z = a * 0.35; f.rotation.x = 0.3; hair.add(f); }
  const lockL = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.3, 3, 8), hairM); lockL.position.set(-0.2, 0.02, 0.06); hair.add(lockL);
  const lockR = lockL.clone(); lockR.position.x = 0.2; hair.add(lockR);
  const back = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0.12), new THREE.Vector2(0.21, -0.05), new THREE.Vector2(0.17, -0.25), new THREE.Vector2(0.1, -0.42), new THREE.Vector2(0.02, -0.46)], 20), hairM); back.position.set(0, 0.1, -0.07); hair.add(back);
  // arms: shoulder -> upper -> elbow -> fore -> hand
  const mkArm = (sx) => { const sh = new THREE.Group(); sh.position.set(sx * 0.19, 0.42, 0); torso.add(sh); const up = limb(0.045, 0.2, cardigan); sh.add(up); const el = new THREE.Group(); el.position.y = -0.27; up.add(el); const fo = limb(0.038, 0.18, skin); el.add(fo); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); hand.position.y = -0.27; hand.scale.set(0.8, 1, 0.5); fo.add(hand); return { sh, up, el, fo, hand }; };
  const armL = mkArm(1), armR = mkArm(-1);
  // legs: hip -> thigh -> knee -> shin -> foot
  const mkLeg = (sx) => { const hp = new THREE.Group(); hp.position.set(sx * 0.08, 0.0, 0); hips.add(hp); const th = limb(0.055, 0.3, skin); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.37; th.add(kn); const sh = limb(0.045, 0.3, sock); kn.add(sh); const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), shoe); foot.position.set(0, -0.4, 0.04); sh.add(foot); return { hp, th, kn, sh, foot }; };
  const legL = mkLeg(1), legR = mkLeg(-1);
  // props
  let bag = null, umbrella = null, canopy = null;
  if (withBag) { bag = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.07), look.toonMaterial({ color: 0x6b7a4a })); b.position.set(0.2, 0.05, 0.02); const flap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.075), look.toonMaterial({ color: 0x5a6a3c })); flap.position.set(0.2, 0.1, 0.02); const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 20, PI), look.toonMaterial({ color: 0x4a3a2a })); strap.position.set(0.0, 0.26, 0); strap.rotation.set(0, 0, 0.1); bag.add(b, flap, strap); bag.position.y = -0.02; torso.add(bag); }
  if (withUmbrella) {
    umbrella = new THREE.Group(); canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 10, 0, PI * 2, 0, PI * 0.42), look.toonMaterial({ color: 0xd4ecff, opacity: 0.45, transparent: true, shade: 0x8fb0e0 })); canopy.position.y = 0.52; canopy.userData.noOutline = true;
    const ribs = new THREE.Mesh(new THREE.SphereGeometry(0.625, 8, 1, 0, PI * 2, 0.0, PI * 0.42), new THREE.MeshBasicMaterial({ color: 0x8aa0c0, wireframe: true })); ribs.position.y = 0.52; ribs.userData.noOutline = true;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), look.toonMaterial({ color: 0x2a3050 })); shaft.position.y = 0.4;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10, PI), look.toonMaterial({ color: 0x6a4a3a })); handle.position.y = -0.08; handle.rotation.z = PI;
    umbrella.add(canopy, ribs, shaft, handle); umbrella.userData.ribs = ribs;
    armL.fo.add(umbrella); umbrella.position.y = -0.28; umbrella.rotation.x = 0;
  }
  const letter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.004), look.toonMaterial({ color: 0xfbf7ee })); letter.visible = false; armR.fo.add(letter); letter.position.set(0.08, -0.3, 0.03); letter.rotation.x = -0.5;
  const planeG = new THREE.Group(); { const g = new THREE.ConeGeometry(0.05, 0.2, 3); g.rotateX(PI / 2); const m = new THREE.Mesh(g, look.flatMaterial({ color: 0xffffff })); m.scale.y = 0.35; planeG.add(m); const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x3a3d5c })); l.scale.y = 0.35; planeG.add(l); }
  planeG.visible = false; armR.fo.add(planeG); planeG.position.set(0.02, -0.3, 0.06);

  look.addOutline(group, { thickness: 0.009 });
  group.scale.setScalar(scale);

  const parts = { head, hair, torso, hips, neck, armL: armL.sh, armR: armR.sh, handL: armL.hand, handR: armR.hand, legL: legL.hp, legR: legR.hp, bag, umbrella, canopy, eyeL: faceA, eyeR: faceB, mouth: faceA, plane: planeG, letter, skull, faceA, faceB, arms: { L: armL, R: armR }, legs: { L: legL, R: legR } };

  // ---- pose machinery
  const J = { hips, torso, head, neck, aLs: armL.sh, aLe: armL.el, aRs: armR.sh, aRe: armR.el, lLh: legL.hp, lLk: legL.kn, lRh: legR.hp, lRk: legR.kn };
  const zeroPose = () => { for (const k in J) J[k].rotation.set(0, 0, 0); hips.position.set(0, 0.78, 0); group.userData.poseName = ''; };
  const set = (o, x, y = 0, z = 0) => o.rotation.set(x, y, z);
  const POSES = {
    idle(f) { const s = f / 24; set(J.aLs, 0.05 + Math.sin(s) * 0.02, 0, 0.12); set(J.aRs, 0.05 - Math.sin(s) * 0.02, 0, -0.12); set(J.aLe, -0.2); set(J.aRe, -0.2); },
    stand(f) { POSES.idle(f); },
    lookUp(f) { POSES.idle(f); set(J.neck, -0.25); },
    walk(f) { const s = f / 24 * 2 * PI * 1.6; const sw = Math.sin(s); set(J.lLh, sw * 0.55); set(J.lRh, -sw * 0.55); set(J.lLk, Math.max(0, -Math.cos(s)) * 0.9); set(J.lRk, Math.max(0, Math.cos(s)) * 0.9); set(J.aLs, -sw * 0.35, 0, 0.1); set(J.aRs, sw * 0.35, 0, -0.1); set(J.aLe, -0.35); set(J.aRe, -0.35); hips.position.y = 0.78 + Math.abs(Math.cos(s)) * 0.02; set(J.torso, 0.06, sw * 0.05, 0); },
    sit(f) { set(J.lLh, -PI / 2 + 0.05); set(J.lRh, -PI / 2 + 0.05); set(J.lLk, PI / 2 - 0.1); set(J.lRk, PI / 2 - 0.1); hips.position.y = 0.47; set(J.aLs, -0.5, 0, 0.1); set(J.aRs, -0.5, 0, -0.1); set(J.aLe, -0.9); set(J.aRe, -0.9); set(J.torso, 0.05); },
    sitIdle(f) { POSES.sit(f); const s = f / 24; set(J.torso, 0.05 + Math.sin(s * 0.8) * 0.01); },
    sleep(f, o = {}) { POSES.sit(f); const b = o.blend === undefined ? 1 : o.blend; set(J.torso, 0.18 * b, 0.1 * b, 0.22 * b); set(J.neck, 0.1 * b, 0.25 * b, 0.35 * b); set(J.aLs, -0.3, 0, 0.1); set(J.aRs, -0.6, 0, -0.1); },
    wake(f) { const t = smooth(0, 40, f); POSES.sleep(f, { blend: 1 - t }); const st = Math.sin(clamp(f / 40, 0, 1) * PI); set(J.aRs, lerp(-0.6, -0.5, t) - st * 1.4, 0, -0.1 - st * 0.4); set(J.aRe, -0.9 + st * 0.6); set(J.neck, lerp(0.1, -0.12 * st, t), lerp(0.25, 0, t), lerp(0.35, 0, t)); },
    closeUmbrella(f) { const t = smooth(0, 30, f); set(J.aLs, lerp(-2.6, -0.9, t), 0, lerp(0.25, 0.1, t)); set(J.aLe, lerp(-0.4, -1.3, t)); set(J.aRs, 0.1, 0, -0.1); set(J.aRe, -0.3); if (umbrella) umbrella.rotation.x = lerp(0, 0.4, t); },
    touchGlass(f) { const t = smooth(0, 30, f); POSES.idle(f); set(J.aLs, lerp(0, -1.1, t), lerp(0, 0.9, t), lerp(0.12, 0.3, t)); set(J.aLe, lerp(-0.2, -0.3, t)); set(J.neck, 0, 0.5 * t); },
    readLetter(f) { POSES.sit(f); set(J.aLs, -0.95, -0.42, 0.1); set(J.aLe, -0.8); set(J.aRs, -0.95, 0.42, -0.1); set(J.aRe, -0.8); set(J.neck, 0.4); },
    foldPlane(f) { POSES.readLetter(f); const s = f / 24; set(J.aLs, -0.95 + Math.sin(s * 3) * 0.08, -0.5, 0.15); set(J.aRs, -0.95 - Math.sin(s * 3 + 1) * 0.08, 0.5, -0.15); set(J.aRe, -0.75 + Math.sin(s * 4) * 0.15); },
    throw(f) { const w = smooth(0, 14, f), r = smooth(14, 20, f), fol = smooth(20, 36, f); set(J.aRs, lerp(-0.4, -2.4, w) + lerp(0, 1.9, r) + lerp(0, -0.4, fol), 0, lerp(-0.1, -0.5, w) + lerp(0, 0.3, r)); set(J.aRe, lerp(-0.3, -1.6, w) + lerp(0, 1.5, r)); set(J.aLs, -0.2, 0, 0.2); set(J.torso, lerp(0, -0.15, w) + lerp(0, 0.35, r) - lerp(0, 0.1, fol), lerp(0, -0.3, w) + lerp(0, 0.5, r), 0); set(J.lLh, -0.2 * r); set(J.lRh, 0.25 * w - 0.1 * r); hips.position.y = 0.78 - 0.03 * w; },
    stepDown(f) { const t = clamp(f / 36, 0, 1); const s = t * PI; set(J.lLh, -Math.sin(s) * 0.9); set(J.lLk, Math.sin(s) * 1.1); set(J.lRh, Math.sin(s * 0.5) * 0.3); set(J.aLs, -0.3, 0, 0.3); set(J.aRs, 0.2, 0, -0.2); set(J.aRe, -0.4); set(J.torso, 0.12 * Math.sin(s)); hips.position.y = 0.78 - 0.08 * Math.sin(s); },
  };
  let poseName = 'idle';
  const rig = {
    group, parts, throwRelease: 20,
    pose(name, f = 0, opts) { zeroPose(); (POSES[name] || POSES.idle)(f, opts); poseName = name; return rig; },
    setExpression(name, blend = 1) { const tex = face(faceCache[name] || ['neutral', 'sad', 'calm', 'surprise', 'smile', 'closed', 'determined', 'sleep'].includes(name) ? name : 'neutral'); if (faceB.material.map !== tex) { faceB.material.map = tex; faceB.material.needsUpdate = true; } faceB.material.opacity = clamp(blend, 0, 1); return rig; },
    lookAt(v) { rig._look = v ? (v.isVector3 ? v.clone() : new THREE.Vector3(...v)) : null; return rig; },
    holdLetter(b) { letter.visible = !!b; return rig; },
    holdPlane(b) { planeG.visible = !!b; return rig; },
    umbrellaOpen(t) { if (!canopy) return rig; t = clamp(t, 0, 1); canopy.scale.set(0.15 + 0.85 * t, 0.3 + 0.7 * t, 0.15 + 0.85 * t); umbrella.userData.ribs.scale.copy(canopy.scale); return rig; },
    update(f) {
      // blink: deterministic schedule, ~every 90-130 frames, 5 frames long
      const period = 110, ph = ((f + 37) % period); const blink = ph < 5 ? Math.sin(ph / 5 * PI) : 0;
      faceA.scale.y = faceB.scale.y = 1 - 0.0 * blink; // face planes keep shape; blink via lid texture swap below
      if (blink > 0.5 && faceB.material.opacity < 0.5) { faceA.material.map = face('closed'); } else faceA.material.map = face('neutral');
      faceA.material.needsUpdate = true;
      // breathing + hair/skirt sway
      const s = f / 24; torso.position.y = Math.sin(s * 1.4) * 0.004; torso.scale.y = 1 + Math.sin(s * 1.4) * 0.004;
      hair.rotation.z = Math.sin(s * 1.1) * 0.02; back.rotation.x = -0.05 + Math.sin(s * 1.3) * 0.03; lockL.rotation.z = Math.sin(s * 1.5) * 0.08; lockR.rotation.z = -Math.sin(s * 1.5 + 0.7) * 0.08;
      skirt.rotation.z = Math.sin(s * 1.2) * 0.015; if (poseName === 'walk') skirt.rotation.x = Math.sin(s * 2 * PI * 1.6) * 0.06;
      // look-at: yaw/pitch the head (and a little chest) toward a world point, clamped
      if (rig._look) {
        const hp = new THREE.Vector3(); head.getWorldPosition(hp); const d = rig._look.clone().sub(hp); const q = new THREE.Quaternion(); neck.parent.getWorldQuaternion(q); d.applyQuaternion(q.invert());
        const yaw = clamp(Math.atan2(d.x, d.z), -1.1, 1.1), pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.7, 0.6);
        head.rotation.set(pitch * 0.8, yaw * 0.75, 0); torso.rotation.y += yaw * 0.12;
      } else head.rotation.set(0, 0, 0);
    },
  };
  rig.pose('idle', 0); rig.umbrellaOpen(1);
  return rig;
}

/** background passengers / silhouettes -> { group, update(f) } */
export function createExtra(ctx, { seed = 1, scale = 1 } = {}) {
  const r = ctx.rng(seed); const group = new THREE.Group();
  const tone = [0x2a2f45, 0x343a55, 0x3b3348, 0x2c3a3a][Math.floor(r() * 4)];
  const m = look.toonMaterial({ color: tone });
  const h = 1.5 + r() * 0.3;
  const body = capsule(0.17, h * 0.55, m, 12); body.position.y = h * 0.55; const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), m); head.position.y = h + 0.02;
  const hat = r() > 0.5 ? new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), m) : null; if (hat) { hat.position.y = h + 0.17; group.add(hat); }
  const legs = capsule(0.08, h * 0.35, m, 8); legs.position.y = h * 0.2;
  group.add(body, head, legs); look.addOutline(group, { thickness: 0.008 }); group.scale.setScalar(scale);
  const ph = r() * 10;
  return { group, update(f) { const s = f / 24; group.rotation.z = Math.sin(s * 0.5 + ph) * 0.01; head.rotation.y = Math.sin(s * 0.3 + ph) * 0.2; } };
}
