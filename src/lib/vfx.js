// VFX department — src/lib/vfx.js
// Every factory returns { group (and/or mesh), update(f, t), ...controls }.
// All motion is a deterministic function of the frame: effects are GPU driven from a uTime/uFrame uniform
// (update() only writes a few uniforms), randomness comes from ctx.rng(seed), never Math.random / clocks.
//
// Exports (stub contract, kept): createRain, createRainOnGlass, createMist, createPetals, createSpeedLines,
//   createSea, createGulls, createPaperPlane, createGodRays, createLensFlare, createSteam, createBokehLights,
//   createClouds, createStars, createLightSweep.
// Added: glidePath (standalone path builder, also attached to the paper plane), softDiscTexture, neonBokehTexture.
import * as THREE from 'three';
import * as look from './look.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FPS = 24;
const v3 = (a, d = [0, 0, 0]) => a == null ? new THREE.Vector3(...d) : a.isVector3 ? a.clone() : new THREE.Vector3(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
const col = c => c && c.isColor ? c.clone() : new THREE.Color(c);
const aspectOf = ctx => (ctx && ctx.width && ctx.height) ? ctx.width / ctx.height : 16 / 9;
const rngOf = (ctx, seed) => (ctx && ctx.rng) ? ctx.rng(seed) : mulberry(seed);
function mulberry(seed = 1) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- canvas textures (procedural, cached) ----------
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  texCache.set(key, t); return t;
}
/** soft radial disc (white, alpha falloff). rim>0 adds a brighter lens-bokeh edge. */
export function softDiscTexture({ size = 128, rim = 0, hard = 0 } = {}) {
  return canvasTex(`disc${size}_${rim}_${hard}`, size, size, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45 + hard * 0.4, `rgba(255,255,255,${1 - rim * 0.35})`);
    grd.addColorStop(0.88, `rgba(255,255,255,${0.15 + rim * 0.75})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}
/** out-of-focus neon city at night (used as the default background behind rain on glass). */
export function neonBokehTexture(ctx, { seed = 7, w = 1024, h = 512 } = {}) {
  return canvasTex(`neon${seed}_${w}x${h}`, w, h, (g, W, H) => {
    const r = rngOf(ctx, seed);
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#07081a'); sky.addColorStop(0.55, '#141538'); sky.addColorStop(1, '#2a1a3e');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const pal = ['#ff3fa4', '#3ff0ff', '#ffb347', '#ffffff', '#f2a1b5', '#8f7bff', '#ff6a3d'];
    // blurry building blocks
    for (let i = 0; i < 26; i++) { const bw = 30 + r() * 90, bh = 60 + r() * 260, x = r() * W; g.fillStyle = `rgba(${8 + r() * 20 | 0},${10 + r() * 20 | 0},${30 + r() * 40 | 0},0.9)`; g.fillRect(x, H - bh, bw, bh); }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 140; i++) {
      const x = r() * W, y = H * (0.25 + r() * 0.75), rad = 4 + Math.pow(r(), 2) * 34, c = pal[(r() * pal.length) | 0];
      const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, c); grd.addColorStop(0.7, c); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.25 + r() * 0.5; g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    // neon signs: horizontal/vertical bars
    for (let i = 0; i < 18; i++) { const x = r() * W, y = H * (0.3 + r() * 0.6), vert = r() < 0.4, len = 20 + r() * 80, c = pal[(r() * pal.length) | 0]; g.globalAlpha = 0.5 + r() * 0.4; g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 18; if (vert) g.fillRect(x, y, 5, len); else g.fillRect(x, y, len, 5); }
    g.shadowBlur = 0; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  });
}
function petalTexture() {
  return canvasTex('petal', 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, '#ff8fb8'); grd.addColorStop(0.5, '#ffb7d2'); grd.addColorStop(1, '#fff0f5');
    g.fillStyle = grd; g.beginPath();
    g.moveTo(32, 62); g.bezierCurveTo(4, 50, 2, 18, 22, 4); g.lineTo(32, 12); g.lineTo(42, 4); g.bezierCurveTo(62, 18, 60, 50, 32, 62); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,120,170,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 60); g.lineTo(32, 14); g.stroke();
  });
}
function lightBarTexture(width = 0.35, soft = 0.12) {
  return canvasTex(`bar${width}_${soft}`, 256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, 0); const c = 0.5, hw = width / 2;
    grd.addColorStop(Math.max(0, c - hw - soft), 'rgba(255,255,255,0)'); grd.addColorStop(c - hw, '#fff'); grd.addColorStop(c + hw, '#fff'); grd.addColorStop(Math.min(1, c + hw + soft), 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0.6)'); v.addColorStop(0.2, 'rgba(0,0,0,0)'); v.addColorStop(0.8, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}

// ---------- shared GLSL ----------
const GLSL_HASH = /* glsl */`
float hash11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.7); a*=.5; } return v; }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0, -s,c,0, 0,0,1); }
`;
const GLSL_OUT = /* glsl */`
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
function instancedQuad(count) {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  g.instanceCount = count;
  return g;
}

// =====================================================================================
// RAIN
// =====================================================================================
/**
 * createRain(ctx, { count, area:[w,h,d], center, speed, wind, seed, color, opacity, length, width, ground, intensity })
 * Thousands of instanced streak quads (billboarded around their fall axis), wind-sheared, depth-varied length/opacity.
 * `ground`: number (y of ground plane) | true (bottom of the box) | {y} -> adds expanding splash rings on that plane.
 * -> { group, mesh, splashes, update(f), setWind(x | [x,z] | [x,y,z]), setIntensity(0..1), setSpeed(v) }
 */
export function createRain(ctx, { count = 6000, area = [40, 30, 40], center = [0, 10, 0], speed = 18, wind = 2, seed = 11, color = 0xc6d8ff, opacity = 0.55, length = 1, width = 1, ground = null, intensity = 1, splashCount = null, gust = 0.6 } = {}) {
  count = Math.min(count, 20000);
  const r = rngOf(ctx, seed);
  const geo = instancedQuad(count);
  const origin = new Float32Array(count * 3), sd = new Float32Array(count * 4);
  const c = v3(center), a = v3(area);
  for (let i = 0; i < count; i++) {
    origin.set([c.x + (r() - 0.5) * a.x, c.y + (r() - 0.5) * a.y, c.z + (r() - 0.5) * a.z], i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  }
  geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 4));
  const windV = typeof wind === 'number' ? new THREE.Vector3(wind, 0, 0) : v3(wind.length === 2 ? [wind[0], 0, wind[1]] : wind);
  const uniforms = {
    uTime: { value: 0 }, uWind: { value: windV }, uGust: { value: 0 }, uSpeed: { value: speed }, uArea: { value: a }, uCenter: { value: c },
    uLen: { value: length }, uWid: { value: width }, uIntensity: { value: intensity }, uColor: { value: col(color) }, uOpacity: { value: opacity },
    uFade: { value: new THREE.Vector2(0.4, Math.max(a.x, a.z) * 1.1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime, uGust, uSpeed, uLen, uWid, uIntensity; uniform vec3 uWind, uArea, uCenter; uniform vec2 uFade;
      attribute vec3 aOrigin; attribute vec4 aSeed;
      varying vec2 vUv; varying float vAlpha;
      void main(){
        vUv = uv;
        float fall = uSpeed * (0.75 + 0.5*aSeed.x);
        vec3 vel = vec3(uWind.x + uGust, -fall, uWind.z);
        vec3 p = aOrigin + vel * uTime;
        vec3 lo = uCenter - uArea*0.5;
        p = lo + mod(p - lo, uArea);
        float len = uLen * (0.45 + 1.0*aSeed.x) * (fall/18.0);
        float wid = uWid * (0.014 + 0.022*aSeed.y);
        vec4 pv = modelViewMatrix * vec4(p, 1.0);
        vec3 dv = normalize(mat3(modelViewMatrix) * normalize(vel));
        vec3 side = cross(dv, vec3(0.0,0.0,1.0));
        side = length(side) < 1e-4 ? vec3(1.0,0.0,0.0) : normalize(side);
        vec3 q = pv.xyz + side * position.x * wid + dv * position.y * len;
        float dist = -q.z;
        float on = step(aSeed.z, uIntensity);
        vAlpha = on * (0.45 + 0.55*aSeed.y) * smoothstep(uFade.x, uFade.x + 2.0, dist) * (1.0 - smoothstep(uFade.y*0.55, uFade.y, dist));
        gl_Position = projectionMatrix * vec4(q, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying float vAlpha;
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0;
        float across = 1.0 - x*x;
        float along = smoothstep(0.0, 0.7, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        float a = across * along * vAlpha * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor * (0.9 + 0.3*vUv.y), a);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 20; mesh.userData.noOutline = true;
  const group = new THREE.Group(); group.add(mesh);

  // splash rings
  let splashes = null;
  if (ground !== null && ground !== undefined && ground !== false) {
    const gy = typeof ground === 'number' ? ground : (ground === true ? c.y - a.y / 2 : (ground.y ?? c.y - a.y / 2));
    const n = Math.min(splashCount || Math.round(count / 5), 4000);
    const sg = instancedQuad(n);
    const sp = new Float32Array(n * 2), ss = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { sp.set([c.x + (r() - 0.5) * a.x, c.z + (r() - 0.5) * a.z], i * 2); ss.set([r(), r(), r(), r()], i * 4); }
    sg.setAttribute('aPos', new THREE.InstancedBufferAttribute(sp, 2));
    sg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(ss, 4));
    const su = { uTime: uniforms.uTime, uIntensity: uniforms.uIntensity, uColor: uniforms.uColor, uOpacity: uniforms.uOpacity, uY: { value: gy }, uWind: uniforms.uWind, uSize: { value: 0.35 * width } };
    const sm = new THREE.ShaderMaterial({
      uniforms: su, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        uniform float uTime, uY, uIntensity, uSize; uniform vec3 uWind;
        attribute vec2 aPos; attribute vec4 aSeed;
        varying vec2 vUv; varying float vCyc; varying float vOn;
        void main(){
          vUv = uv;
          float period = 0.5 + 0.9*aSeed.y;
          float cyc = fract(uTime/period + aSeed.x*7.0);
          vCyc = cyc; vOn = step(aSeed.z, uIntensity);
          float s = uSize * (0.6 + 0.8*aSeed.w);
          vec3 p = vec3(aPos.x + position.x * s * 1.6, uY + 0.02, aPos.y + position.y * s);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying float vCyc; varying float vOn;
        void main(){
          vec2 d = (vUv - 0.5) * 2.0;
          float rr = length(d);
          float ring = smoothstep(0.12, 0.0, abs(rr - vCyc*0.95)) ;
          float dot_ = smoothstep(0.25, 0.0, rr) * smoothstep(0.35, 0.0, vCyc);
          float a = (ring*0.7 + dot_) * (1.0 - vCyc) * (1.0 - vCyc) * vOn * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
          ${GLSL_OUT}
        }`,
    });
    splashes = new THREE.Mesh(sg, sm); splashes.frustumCulled = false; splashes.renderOrder = 19; splashes.userData.noOutline = true; group.add(splashes);
  }
  return {
    group, mesh, splashes, uniforms,
    update(f) { const t = f / FPS; uniforms.uTime.value = t; uniforms.uGust.value = gust * (Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.9 + 1.3) * 0.4); },
    setWind(w) { if (typeof w === 'number') windV.set(w, 0, 0); else if (w.length === 2) windV.set(w[0], 0, w[1]); else windV.copy(v3(w)); },
    setIntensity(i) { uniforms.uIntensity.value = Math.max(0, Math.min(1, i)); },
    setSpeed(v) { uniforms.uSpeed.value = v; },
  };
}

// =====================================================================================
// RAIN ON GLASS
// =====================================================================================
/**
 * createRainOnGlass(ctx, { width, height, seed, background, intensity, tint, tintAmount, blur, scale })
 * Shader quad: running drops in jittery tracks with trails, static droplets; drops refract the `background`
 * (a Texture, a colour, or 'neon' = a procedural out-of-focus neon-city texture). With a texture the quad is opaque and
 * the background is defocused except through the drops; with a colour the quad is a translucent tinted pane.
 * -> { mesh, group, update(f), setIntensity(0..1), setBackground(texOrColor), uniforms }
 */
export function createRainOnGlass(ctx, { width = 2, height = 1.4, seed = 12, background = 'neon', intensity = 1, tint = 0x18223f, tintAmount = 0.25, blur = 3.0, scale = 1 } = {}) {
  const r = rngOf(ctx, seed);
  const uniforms = {
    uTime: { value: 0 }, uIntensity: { value: intensity }, uAspect: { value: width / height }, uBg: { value: null }, uHasBg: { value: 0 },
    uBgColor: { value: new THREE.Color(0x1a1b3a) }, uTint: { value: col(tint) }, uTintAmount: { value: tintAmount }, uBlur: { value: blur },
    uSeed: { value: r() * 100 }, uScale: { value: scale },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uBg; uniform float uHasBg, uTime, uIntensity, uAspect, uBlur, uSeed, uScale, uTintAmount; uniform vec3 uBgColor, uTint;
      varying vec2 vUv;
      ${GLSL_HASH}
      // running drops: cells scroll down; each cell carries one jerky drop that leaves a trail of droplets above it
      vec3 runLayer(vec2 uv, float t, float cells, float lseed){
        vec2 a = vec2(cells, cells*1.0);
        vec2 st = uv * a;
        float colId = floor(st.x);
        float cn = hash11(colId*1.37 + lseed);
        float speed = 0.35 + 0.5*cn;
        st.y += t * speed + cn * 9.0;
        vec2 id = floor(st);
        vec2 f = fract(st) - 0.5;
        float n = hash21(id + lseed);
        float t2 = t * (2.0 + 2.0*n) + n * 6.2832;
        float y = -sin(t2 + sin(t2 + sin(t2)*0.5)) * 0.42;
        float xTrack = (cn - 0.5) * 0.55 + 0.07*sin(st.y*5.0 + cn*20.0) + (n-0.5)*0.12;
        vec2 p1 = vec2(xTrack, y);
        vec2 o1 = (f - p1); o1.y *= 0.85;
        float d = length(o1);
        float m1 = smoothstep(0.09, 0.05, d);
        // trail droplets above the drop (shrinking as they get farther)
        vec2 o2 = vec2(f.x - xTrack, fract(st.y*5.0) - 0.5) ;
        o2.y /= 5.0;
        float above = smoothstep(-0.05, 0.1, f.y - p1.y);
        float m2 = smoothstep(0.26*(0.5 - f.y), 0.0, length(o2*vec2(1.0,2.2))) * above;
        // a thin wet track
        float wet = smoothstep(0.035, 0.0, abs(f.x - xTrack)) * above * 0.6;
        vec2 off = m1*o1*22.0 + m2*o2*14.0;
        return vec3(off, max(m1, m2*0.9) + wet*0.0);
      }
      vec3 staticLayer(vec2 uv, float cells, float lseed){
        vec2 st = uv * cells;
        vec2 id = floor(st); vec2 f = fract(st) - 0.5;
        vec2 h = hash22(id + lseed);
        float present = step(0.62, hash21(id*3.1 + lseed));
        vec2 p = (h - 0.5) * 0.7;
        float rad = 0.07 + 0.11*hash21(id + 7.0 + lseed);
        vec2 o = f - p;
        float d = length(o);
        float m = smoothstep(rad, rad*0.6, d) * present;
        return vec3(m*o*18.0, m);
      }
      void main(){
        vec2 uv = vec2(vUv.x * uAspect, vUv.y) * uScale;
        float t = uTime * (0.45 + 0.65*uIntensity);
        vec3 L1 = runLayer(uv, t, 5.0, uSeed);
        vec3 L2 = runLayer(uv + vec2(0.37, 0.11), t*0.8, 8.5, uSeed + 11.0) * step(0.3, uIntensity);
        vec3 S  = staticLayer(uv, 22.0, uSeed + 23.0);
        vec3 S2 = staticLayer(uv*1.7 + 0.3, 30.0, uSeed + 41.0) * 0.7;
        vec2 off = L1.xy + L2.xy*0.8 + S.xy + S2.xy;
        float mask = clamp(L1.z + L2.z + S.z + S2.z, 0.0, 1.0);
        float blurAmt = uBlur * (1.0 - mask);
        vec3 base = uHasBg > 0.5 ? texture2D(uBg, vUv + off*0.018, blurAmt).rgb : uBgColor;
        // drop shading: brighten the core, a lit rim up-left, a dark rim down-right
        vec2 nd = off / max(length(off), 1e-4);
        float hl = smoothstep(0.2, 0.9, dot(nd, vec2(-0.55, 0.83))) * mask;
        float sh = smoothstep(0.2, 0.9, dot(nd, vec2(0.55, -0.83))) * mask;
        vec3 colr = base * (1.0 + 0.35*mask) + vec3(0.35, 0.38, 0.42) * hl * length(off) * 0.08;
        colr = mix(colr, colr * 0.6, sh * 0.5);
        colr = mix(colr, uTint, uTintAmount * (1.0 - mask));
        float alpha = uHasBg > 0.5 ? 1.0 : clamp(uTintAmount + mask * 0.85 + hl * 0.3, 0.0, 1.0);
        gl_FragColor = vec4(colr, alpha);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat); mesh.userData.noOutline = true;
  const api = {
    mesh, group: mesh, uniforms,
    update(f) { uniforms.uTime.value = f / FPS; },
    setIntensity(i) { uniforms.uIntensity.value = Math.max(0, Math.min(1, i)); },
    setBackground(bg) {
      if (bg === 'neon') bg = neonBokehTexture(ctx, { seed: seed + 100 });
      if (bg && bg.isTexture) { uniforms.uBg.value = bg; uniforms.uHasBg.value = 1; mat.transparent = false; }
      else { uniforms.uHasBg.value = 0; mat.transparent = true; if (bg !== null && bg !== undefined) uniforms.uBgColor.value.set(bg); }
      mat.needsUpdate = true;
    },
  };
  api.setBackground(background);
  return api;
}

// =====================================================================================
// MIST
// =====================================================================================
/**
 * createMist(ctx, { area:[w,d], height, center, color, seed, layers, density, drift:[x,z], scale, opacity })
 * Stacked horizontal sheets with fbm alpha that drifts; edges feather out, near-camera fade hides the planes.
 * -> { group, update(f), setDensity(0..1), setColor(c), uniforms }
 */
export function createMist(ctx, { area = [200, 200], height = 2, center = [0, 1, 0], color = 0xbfd4ff, seed = 13, layers = 4, density = 1, drift = [0.4, 0.15], scale = 1, opacity = 0.4 } = {}) {
  const r = rngOf(ctx, seed);
  const group = new THREE.Group();
  const shared = { uTime: { value: 0 }, uDensity: { value: density }, uColor: { value: col(color) }, uOpacity: { value: opacity }, uDrift: { value: new THREE.Vector2(drift[0], drift[1]) } };
  const c = v3(center);
  for (let i = 0; i < layers; i++) {
    const uniforms = { ...shared, uOffset: { value: new THREE.Vector2(r() * 50, r() * 50) }, uLayer: { value: i / Math.max(1, layers - 1) }, uArea: { value: new THREE.Vector2(area[0], area[1]) }, uScale: { value: scale * (0.8 + r() * 0.5) } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vDist = distance(wp.xyz, cameraPosition); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uDensity, uOpacity, uLayer, uScale; uniform vec3 uColor; uniform vec2 uDrift, uOffset, uArea;
        varying vec2 vUv; varying float vDist;
        ${GLSL_HASH}
        void main(){
          vec2 p = (vUv - 0.5) * uArea / (35.0 * uScale) + uOffset + uDrift * uTime * (0.04 + 0.03*uLayer);
          float n = fbm(p + 0.3*vec2(fbm(p*1.7 + uTime*0.02), fbm(p*1.3 - uTime*0.015)));
          n = smoothstep(0.32, 0.78, n);
          float edge = smoothstep(0.0, 0.18, vUv.x)*smoothstep(1.0, 0.82, vUv.x)*smoothstep(0.0, 0.18, vUv.y)*smoothstep(1.0, 0.82, vUv.y);
          float near = smoothstep(1.5, 9.0, vDist);
          float a = n * edge * near * uDensity * uOpacity * (1.0 - 0.45*uLayer);
          gl_FragColor = vec4(uColor, a);
          ${GLSL_OUT}
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(area[0], area[1]), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, c.y - height / 2 + (layers === 1 ? height / 2 : i * height / (layers - 1)), c.z);
    m.renderOrder = 10 + i; m.userData.noOutline = true; m.frustumCulled = false;
    group.add(m);
  }
  return {
    group, uniforms: shared,
    update(f) { shared.uTime.value = f / FPS; },
    setDensity(d) { shared.uDensity.value = Math.max(0, d); },
    setColor(c2) { shared.uColor.value.set(c2); },
  };
}

// =====================================================================================
// PETALS
// =====================================================================================
/**
 * createPetals(ctx, { count, area, center, wind, seed, size, fall, light })
 * Instanced curved petal quads (canvas gradient texture, two-sided, 3-band toon) tumbling, fluttering, drifting
 * with wind; wrap inside the box. burst(frame, origin, radius, {strength, lift}) schedules a deterministic gust
 * (evaluated in the shader from uFrame). -> { group, mesh, update(f), burst(), setWind([x,y,z]), setLight(dir), uniforms }
 */
export function createPetals(ctx, { count = 4000, area = [60, 20, 120], center = [0, 8, -40], wind = [1, 0, 2], seed = 14, size = 1, fall = 1.1, light = [0.4, 1, 0.3], maxBursts = 8 } = {}) {
  count = Math.min(count, 20000);
  const r = rngOf(ctx, seed);
  const base = new THREE.PlaneGeometry(0.17 * size, 0.22 * size, 3, 3);
  { const p = base.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, (x * x) * 1.2 / size + (y * y) * 0.25 / size); } base.computeVertexNormals(); }
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index;
  geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv); geo.setAttribute('normal', base.attributes.normal);
  geo.instanceCount = count;
  const bpos = new Float32Array(count * 3), sd = new Float32Array(count * 4);
  const c = v3(center), a = v3(area);
  for (let i = 0; i < count; i++) { bpos.set([c.x + (r() - 0.5) * a.x, c.y + (r() - 0.5) * a.y, c.z + (r() - 0.5) * a.z], i * 3); sd.set([r(), r(), r(), r()], i * 4); }
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(bpos, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 4));
  const N = maxBursts;
  const uniforms = {
    uTime: { value: 0 }, uArea: { value: a }, uCenter: { value: c }, uWindOff: { value: new THREE.Vector3() }, uFall: { value: fall },
    uLight: { value: v3(light).normalize() }, uMap: { value: petalTexture() },
    uBurstPos: { value: Array.from({ length: N }, () => new THREE.Vector3()) }, uBurstP: { value: Array.from({ length: N }, () => new THREE.Vector4()) }, uBurstN: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, transparent: false,
    defines: { NB: N },
    vertexShader: /* glsl */`
      uniform float uTime, uFall; uniform vec3 uArea, uCenter, uWindOff, uLight;
      uniform vec3 uBurstPos[NB]; uniform vec4 uBurstP[NB]; uniform int uBurstN;
      attribute vec3 aBase; attribute vec4 aSeed;
      varying vec2 vUv; varying float vShade;
      ${GLSL_HASH}
      void main(){
        float t = uTime; float ph = aSeed.x * 6.2832;
        vec3 p = aBase + uWindOff * (0.7 + 0.6*aSeed.y);
        p.y -= uFall * (0.55 + 0.9*aSeed.z) * t;
        p.x += sin(t*1.3 + ph) * 0.7 * aSeed.w + sin(t*0.37 + ph*2.0) * 0.5;
        p.z += cos(t*1.1 + ph*1.7) * 0.6 * aSeed.w;
        p.y += sin(t*2.3 + ph*3.1) * 0.18 * aSeed.w;
        vec3 lo = uCenter - uArea*0.5;
        p = lo + mod(p - lo, uArea);
        vec3 disp = vec3(0.0); float spin = 0.0;
        for (int i = 0; i < NB; i++) {
          if (i >= uBurstN) break;
          float dt = (t*24.0 - uBurstP[i].x) / 24.0;
          if (dt <= 0.0) continue;
          vec3 d = p - uBurstPos[i]; float dist = length(d); float R = uBurstP[i].y;
          float fall = 1.0 - smoothstep(R*0.15, R, dist);
          if (fall <= 0.0) continue;
          float env = (1.0 - exp(-dt*2.5)) * exp(-dt*0.3);
          vec3 dir = d / max(dist, 0.001);
          vec3 tang = normalize(cross(vec3(0.0,1.0,0.0), dir + vec3(0.001,0.0,0.0)));
          disp += (dir * uBurstP[i].z + vec3(0.0, uBurstP[i].w, 0.0) + tang * uBurstP[i].z * 0.7 * sin(dt*2.0 + ph)) * env * fall * (0.5 + 1.0*aSeed.y);
          spin += env * fall * 7.0 * (0.5 + aSeed.z);
        }
        p += disp;
        mat3 R = rotX(t*(1.0+aSeed.y)*1.4 + ph + spin) * rotY(t*(0.8+aSeed.z) + ph*2.0 + spin*0.7) * rotZ(t*1.1*aSeed.w + ph*3.0);
        vec3 local = R * position;
        vec3 n = normalize(R * normal);
        vShade = abs(dot(n, uLight));
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; varying vec2 vUv; varying float vShade;
      void main(){
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.5) discard;
        float band = vShade < 0.3 ? 0.72 : (vShade < 0.65 ? 0.9 : 1.08);
        gl_FragColor = vec4(tex.rgb * band, 1.0);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.noOutline = true;
  const group = new THREE.Group(); group.add(mesh);
  const windV = v3(wind); let last = -1;
  return {
    group, mesh, uniforms,
    update(f) {
      if (f === 0 || f <= last) { uniforms.uWindOff.value.set(0, 0, 0); last = -1; }
      // accumulate wind (allows setWind mid-shot); gusty
      for (let k = last + 1; k <= f; k++) { const g = 0.75 + 0.25 * Math.sin(k / FPS * 0.6) + 0.1 * Math.sin(k / FPS * 2.1); uniforms.uWindOff.value.addScaledVector(windV, g / FPS); }
      last = f; uniforms.uTime.value = f / FPS;
    },
    burst(frame, origin, radius = 10, { strength = 8, lift = 4 } = {}) {
      const i = uniforms.uBurstN.value; if (i >= N) return;
      uniforms.uBurstPos.value[i].copy(v3(origin)); uniforms.uBurstP.value[i].set(frame, radius, strength, lift); uniforms.uBurstN.value = i + 1;
    },
    setWind(w) { windV.copy(v3(w)); },
    setLight(d) { uniforms.uLight.value.copy(v3(d)).normalize(); },
  };
}

// =====================================================================================
// SPEED LINES (集中線)
// =====================================================================================
/**
 * createSpeedLines(ctx, { seed, color, lines, inner, center:[x,y] })
 * Full-screen radial streaks drawn "on twos". The mesh's vertex shader writes clip space directly, so it covers the
 * frame wherever it is placed: add `mesh` as a child of the camera (e.g. camera.add(sl.mesh); sl.mesh.position.z = -1)
 * or straight into the scene. depthTest off, renderOrder 900. Intensity 0 hides it.
 * -> { mesh, group, update(f), setIntensity(0..1), setColor(c), uniforms }
 */
export function createSpeedLines(ctx, { seed = 15, color = 0xffffff, lines = 170, inner = 0.22, center = [0, 0], intensity = 0 } = {}) {
  const r = rngOf(ctx, seed);
  const uniforms = { uFrame: { value: 0 }, uIntensity: { value: intensity }, uAspect: { value: aspectOf(ctx) }, uColor: { value: col(color) }, uLines: { value: lines }, uInner: { value: inner }, uSeed: { value: r() * 50 }, uCenter: { value: new THREE.Vector2(center[0], center[1]) } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 1.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uFrame, uIntensity, uAspect, uLines, uInner, uSeed; uniform vec3 uColor; uniform vec2 uCenter;
      varying vec2 vUv;
      ${GLSL_HASH}
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) - uCenter;
        float rr = length(p);
        float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
        float fr = floor(uFrame / 2.0);
        float seg = floor(ang * uLines);
        float h1 = hash11(seg*1.7 + fr*0.37 + uSeed), h2 = hash11(seg*3.1 + fr*0.91 + uSeed + 5.0), h3 = hash11(seg*5.3 + fr*0.53 + uSeed + 9.0), h4 = hash11(seg*7.7 + uSeed + 13.0);
        float w = fract(ang * uLines) - 0.5 - (h3 - 0.5) * 0.35;
        float thick = (0.04 + 0.22*h2) * (0.5 + 0.5*uIntensity);
        float line = smoothstep(thick, thick*0.35, abs(w));
        float start = uInner + (0.55 - uInner) * h1 * (1.6 - uIntensity);
        float along = smoothstep(start, start + 0.1, rr);
        float vis = step(h4, uIntensity * 1.15);
        float a = line * along * vis * uIntensity * (0.55 + 0.45*h2);
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; mesh.renderOrder = 900; mesh.userData.noOutline = true; mesh.visible = intensity > 0;
  return {
    mesh, group: mesh, uniforms,
    update(f) { uniforms.uFrame.value = f; },
    setIntensity(i) { uniforms.uIntensity.value = Math.max(0, Math.min(1, i)); mesh.visible = i > 0.001; },
    setColor(c2) { uniforms.uColor.value.set(c2); },
  };
}

// =====================================================================================
// SEA
// =====================================================================================
/**
 * createSea(ctx, { size, color, foam, seed, segments, shoreX, foamWidth, sunDir, shallow, sky, foamColor, waveHeight, waveScale, glint })
 * Gerstner-ish 4-octave waves (vertex), toon-banded colour (4 bands), sun glint sparkles along sunDir, crest foam,
 * shore foam lines + run-up edge for x > shoreX - foamWidth (water discarded past the moving shoreline).
 * -> { mesh, group, update(f), setSun(dir), setShore(x), uniforms }
 */
export function createSea(ctx, { size = 2000, color = 0x2f8fd6, foam = true, seed = 16, segments = 256, shoreX = null, foamWidth = 30, sunDir = [0.3, 0.35, -1], shallow = 0x5fc8f5, sky = 0xbfe6ff, foamColor = 0xffffff, waveHeight = 1, waveScale = 1, glint = 1, center = [0, 0, 0] } = {}) {
  const r = rngOf(ctx, seed);
  const uniforms = {
    uTime: { value: 0 }, uSun: { value: v3(sunDir).normalize() }, uDeep: { value: col(color) }, uShallow: { value: col(shallow) }, uSky: { value: col(sky) }, uFoam: { value: col(foamColor) },
    uShoreX: { value: shoreX === null ? 1e9 : shoreX }, uFoamW: { value: foamWidth }, uH: { value: waveHeight }, uS: { value: 1 / waveScale }, uGlint: { value: glint }, uFoamOn: { value: foam ? 1 : 0 }, uSeed: { value: r() * 10 },
  };
  const WAVES = /* glsl */`
    uniform float uTime, uH, uS;
    const vec2 D0 = normalize(vec2(1.0, 0.35)); const vec2 D1 = normalize(vec2(-0.4, 1.0)); const vec2 D2 = normalize(vec2(0.7, -0.6)); const vec2 D3 = normalize(vec2(0.2, 0.9));
    // returns height, writes gradient
    float waves(vec2 xz, out vec2 grad){
      float t = uTime; grad = vec2(0.0); float h = 0.0;
      float k0 = 6.2832/(60.0/uS), k1 = 6.2832/(31.0/uS), k2 = 6.2832/(13.0/uS), k3 = 6.2832/(6.5/uS);
      float a0 = 1.1*uH, a1 = 0.6*uH, a2 = 0.3*uH, a3 = 0.12*uH;
      float p0 = dot(D0, xz)*k0 + t*1.1, p1 = dot(D1, xz)*k1 + t*1.5, p2 = dot(D2, xz)*k2 + t*2.2, p3 = dot(D3, xz)*k3 + t*3.1;
      h += a0*sin(p0); grad += D0*k0*a0*cos(p0);
      h += a1*sin(p1); grad += D1*k1*a1*cos(p1);
      h += a2*sin(p2); grad += D2*k2*a2*cos(p2);
      h += a3*sin(p3); grad += D3*k3*a3*cos(p3);
      return h;
    }`;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      ${WAVES}
      varying vec3 vWorld; varying float vH;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 g; float h = waves(wp.xz, g);
        // choppy lateral displacement
        wp.xz -= g * 0.25 * uH;
        wp.y += h;
        vWorld = wp.xyz; vH = h;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      ${WAVES}
      uniform vec3 uSun, uDeep, uShallow, uSky, uFoam; uniform float uShoreX, uFoamW, uGlint, uFoamOn, uSeed;
      varying vec3 vWorld; varying float vH;
      ${GLSL_HASH}
      void main(){
        vec2 g; float h = waves(vWorld.xz, g);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vWorld);
        float dist = distance(cameraPosition, vWorld);
        // shoreline run-up: discard water past the moving edge
        float edge = uShoreX + 1.6*sin(uTime*0.9 + vWorld.z*0.09 + uSeed) + 2.2*(fbm(vec2(vWorld.z*0.06, uTime*0.25 + uSeed)) - 0.5);
        if (vWorld.x > edge) discard;
        // toon banded base colour
        float ndl = dot(n, uSun);
        float fres = pow(1.0 - max(dot(V, n), 0.0), 2.5);
        float lum = 0.42 + 0.35*ndl + 0.35*fres + 0.12*h/max(uH,0.001);
        lum += (vnoise(vWorld.xz*0.15 + uTime*0.1) - 0.5) * 0.08;
        float band = floor(clamp(lum, 0.0, 0.999) * 4.0) / 3.0;
        vec3 colr = mix(uDeep, uShallow, band);
        // far water takes the sky
        colr = mix(colr, uSky, smoothstep(120.0, 900.0, dist) * 0.75);
        // sun glints: specular path with sparkle dots
        vec3 H = normalize(uSun + V);
        float spec = pow(max(dot(n, H), 0.0), 48.0);
        float cellN = hash21(floor(vWorld.xz*1.3 + 0.5) + floor(uTime*6.0)*0.37);
        float sparkle = step(0.93 - 0.3*spec, cellN) ;
        float path = pow(max(dot(reflect(-V, n), uSun), 0.0), 6.0);
        colr += uFoam * (spec * 0.6 + sparkle * path * 2.2) * uGlint;
        // foam: crests
        if (uFoamOn > 0.5) {
          float crest = smoothstep(0.55, 0.9, h/max(1.4*uH, 0.001)) * step(0.5, fbm(vWorld.xz*0.35 + uTime*0.12));
          colr = mix(colr, uFoam, crest * 0.85);
          // shore foam lines running in
          float s = clamp((vWorld.x - (uShoreX - uFoamW)) / uFoamW, 0.0, 1.0);
          float lines = sin(s*14.0 - uTime*1.6 + fbm(vWorld.xz*0.25 + uSeed)*4.0);
          float foamL = smoothstep(0.55, 0.75, lines) * smoothstep(0.0, 0.35, s) * step(0.35, fbm(vWorld.xz*0.5 - uTime*0.1));
          float froth = smoothstep(0.7, 1.0, s) * step(0.42, fbm(vWorld.xz*0.7 + uTime*0.2 + uSeed));
          float lip = smoothstep(2.2, 0.4, edge - vWorld.x);
          float fm = clamp(foamL*0.8 + froth + lip, 0.0, 1.0);
          colr = mix(colr, uFoam, fm);
          // wet sand darkening just below the lip is the beach's job; we add a thin dark line under the lip
          colr = mix(colr, uDeep*0.7, smoothstep(0.4, 0.0, abs(edge - vWorld.x - 2.6)) * 0.35 * (1.0-fm));
        }
        gl_FragColor = vec4(colr, 1.0);
        ${GLSL_OUT}
      }`,
  });
  const geo = new THREE.PlaneGeometry(size, size, segments, segments); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(v3(center)); mesh.userData.noOutline = true; mesh.frustumCulled = false;
  return {
    mesh, group: mesh, uniforms,
    update(f) { uniforms.uTime.value = f / FPS; },
    setSun(d) { uniforms.uSun.value.copy(v3(d)).normalize(); },
    setShore(x) { uniforms.uShoreX.value = x === null ? 1e9 : x; },
  };
}

// =====================================================================================
// GULLS
// =====================================================================================
/**
 * createGulls(ctx, { count, center, radius, seed, size, speed, outline })
 * Little toon gulls (body, head, beak, tail, two-segment wings pivoting at the root) flapping/gliding on circular
 * and figure-8 paths with banking, per-bird phase. -> { group, birds, update(f) }
 */
export function createGulls(ctx, { count = 6, center = [0, 15, -20], radius = 12, seed = 17, size = 1, speed = 1, outline = true } = {}) {
  const r = rngOf(ctx, seed);
  const group = new THREE.Group();
  const white = look.toonMaterial({ color: 0xf6f8ff, steps: 3 });
  const wingMat = look.toonMaterial({ color: 0xf2f4fb, steps: 3, side: THREE.DoubleSide });
  const tipMat = look.toonMaterial({ color: 0x2a2d3e, steps: 2, side: THREE.DoubleSide });
  const beakMat = look.toonMaterial({ color: 0xffb347, steps: 2 });
  const wingShape = (x0, x1, c0, c1) => { const s = new THREE.Shape(); s.moveTo(x0, c0 * 0.45); s.quadraticCurveTo((x0 + x1) / 2, c1 * 0.55, x1, c1 * 0.25); s.lineTo(x1, -c1 * 0.3); s.quadraticCurveTo((x0 + x1) / 2, -c1 * 0.75, x0, -c0 * 0.55); s.closePath(); return s; };
  const innerGeo = new THREE.ShapeGeometry(wingShape(0, 0.5, 0.32, 0.26)); innerGeo.rotateX(-Math.PI / 2);
  const outerGeo = new THREE.ShapeGeometry(wingShape(0, 0.5, 0.26, 0.12)); outerGeo.rotateX(-Math.PI / 2);
  const tipGeo = new THREE.ShapeGeometry(wingShape(0.38, 0.52, 0.16, 0.1)); tipGeo.rotateX(-Math.PI / 2);
  const bodyGeo = new THREE.SphereGeometry(0.16, 14, 10); bodyGeo.scale(1, 0.75, 2.1);
  const headGeo = new THREE.SphereGeometry(0.1, 12, 8);
  const beakGeo = new THREE.ConeGeometry(0.035, 0.14, 6); beakGeo.rotateX(Math.PI / 2);
  const tailGeo = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.12, 0); s.lineTo(0.12, 0); s.lineTo(0.05, 0.3); s.lineTo(-0.05, 0.3); s.closePath(); return s; })()); tailGeo.rotateX(Math.PI / 2);
  const birds = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, white); g.add(body);
    const head = new THREE.Mesh(headGeo, white); head.position.set(0, 0.09, 0.36); g.add(head);
    const beak = new THREE.Mesh(beakGeo, beakMat); beak.position.set(0, 0.07, 0.5); g.add(beak);
    const tail = new THREE.Mesh(tailGeo, wingMat); tail.position.set(0, 0.03, -0.32); tail.userData.noOutline = true; g.add(tail);
    const wings = [];
    for (const sgn of [-1, 1]) {
      const root = new THREE.Group(); root.position.set(sgn * 0.08, 0.06, 0.05); root.scale.x = sgn;
      const inner = new THREE.Mesh(innerGeo, wingMat); inner.userData.noOutline = true; root.add(inner);
      const elbow = new THREE.Group(); elbow.position.set(0.5, 0, 0); root.add(elbow);
      const outer = new THREE.Mesh(outerGeo, wingMat); outer.userData.noOutline = true; elbow.add(outer);
      const tip = new THREE.Mesh(tipGeo, tipMat); tip.userData.noOutline = true; tip.position.y = 0.002; elbow.add(tip);
      g.add(root); wings.push({ root, elbow, sgn });
    }
    if (outline) look.addOutline(g, { thickness: 0.012, color: 0x2a2d3e });
    g.scale.setScalar(size);
    group.add(g);
    birds.push({ g, wings, phase: r() * Math.PI * 2, rad: radius * (0.7 + 0.6 * r()), w: (0.35 + 0.3 * r()) * speed * (r() < 0.5 ? 1 : -1), fig8: i % 3 === 1, yAmp: 1 + r() * 2, flapRate: 2.4 + r() * 1.2, glide: 3 + r() * 3, lift: r() * Math.PI * 2 });
  }
  const c = v3(center);
  const pos = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const at = (b, t, out) => {
    const a = t * b.w + b.phase;
    if (b.fig8) out.set(c.x + b.rad * Math.sin(a), c.y + Math.sin(a * 0.5 + b.lift) * b.yAmp, c.z + b.rad * 0.6 * Math.sin(a) * Math.cos(a));
    else out.set(c.x + b.rad * Math.cos(a), c.y + Math.sin(a * 0.7 + b.lift) * b.yAmp, c.z + b.rad * Math.sin(a));
    return out;
  };
  return {
    group, birds,
    update(f) {
      const t = f / FPS;
      for (const b of birds) {
        at(b, t, pos); at(b, t + 0.08, p2); at(b, t + 0.16, p3);
        v1.subVectors(p2, pos); v2.subVectors(p3, p2);
        b.g.position.copy(pos);
        b.g.up.set(0, 1, 0); b.g.lookAt(p2);
        const turn = (v1.x * v2.z - v1.z * v2.x) / Math.max(1e-5, v1.length() * v2.length());
        b.g.rotateZ(Math.max(-0.6, Math.min(0.6, turn * 40)));
        // flap envelope: flap, then glide
        const cyc = (t / b.glide + b.phase) % 1;
        const env = THREE.MathUtils.smoothstep(cyc, 0.0, 0.08) * (1 - THREE.MathUtils.smoothstep(cyc, 0.55, 0.65));
        const flap = Math.sin(t * b.flapRate * Math.PI * 2 + b.phase);
        for (const w of b.wings) {
          w.root.rotation.z = w.sgn * (-(env * flap * 0.75) - (1 - env) * 0.18 - 0.05);
          w.elbow.rotation.z = w.sgn * (-(env * Math.sin(t * b.flapRate * Math.PI * 2 + b.phase - 0.9) * 0.55) + (1 - env) * 0.28);
        }
      }
    },
  };
}

// =====================================================================================
// PAPER PLANE
// =====================================================================================
/**
 * glidePath({ from, to, apex, frames, start, wobble, bank, ease, overshoot }) -> f => { pos, dir, roll }
 * Quadratic-Bezier glide from `from` through `apex` to `to` over `frames` frames (starting at frame `start`), lateral
 * wobble with banking; after the end it keeps flying straight (overshoot) so the plane can leave into the sun.
 */
export function glidePath({ from = [0, 1, 0], to = [10, 3, -10], apex = null, frames = 72, start = 0, wobble = 0.3, bank = 1, ease = null, overshoot = true, wobbleFreq = 0.35 } = {}) {
  const P0 = v3(from), P2 = v3(to); const P1 = apex ? v3(apex) : P0.clone().lerp(P2, 0.5).add(new THREE.Vector3(0, P0.distanceTo(P2) * 0.25, 0));
  const B = (u, out) => out.set(0, 0, 0).addScaledVector(P0, (1 - u) * (1 - u)).addScaledVector(P1, 2 * (1 - u) * u).addScaledVector(P2, u * u);
  const dB = (u, out) => out.set(0, 0, 0).addScaledVector(P1.clone().sub(P0), 2 * (1 - u)).addScaledVector(P2.clone().sub(P1), 2 * u);
  const endDir = dB(1, new THREE.Vector3()); const endSpeed = endDir.length() / frames * FPS; endDir.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  return (f) => {
    const pos = new THREE.Vector3(), dir = new THREE.Vector3();
    let u = (f - start) / Math.max(1, frames);
    if (u <= 0) { B(0, pos); dB(0, dir).normalize(); return { pos, dir, roll: 0 }; }
    if (u >= 1) {
      B(1, pos); dir.copy(endDir);
      if (overshoot) pos.addScaledVector(endDir, (f - start - frames) / FPS * endSpeed);
      const w = wobble * 0.3 * Math.sin(f * wobbleFreq);
      const side = new THREE.Vector3().crossVectors(dir, up).normalize();
      pos.addScaledVector(side, w);
      return { pos, dir, roll: -w * bank * 1.5 };
    }
    const ue = ease ? ease(u) : u;
    B(ue, pos); dB(ue, dir).normalize();
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const w = wobble * Math.sin(f * wobbleFreq) * Math.sin(f * wobbleFreq * 0.31 + 1.0) * (0.4 + 0.6 * Math.sin(Math.PI * u));
    const dw = wobble * wobbleFreq * Math.cos(f * wobbleFreq) * Math.sin(f * wobbleFreq * 0.31 + 1.0);
    pos.addScaledVector(side, w);
    const roll = -(dw * 2.5 + w * 0.8) * bank;
    return { pos, dir, roll };
  };
}
/**
 * createPaperPlane(ctx, { scale, color })
 * A folded dart: two creased wings (inner/outer facets), a keel, faint crease lines and dark edge lines.
 * Nose points +z (lookAt convention). -> { group, mesh, update(f), setPath(fn: f -> {pos, dir, roll?}), glidePath }
 */
export function createPaperPlane(ctx, { scale = 1, color = 0xffffff, lineColor = 0x3a3d5c } = {}) {
  const group = new THREE.Group();
  const N = [0, 0, 0.5], T = [0, 0, -0.5], K = [0, -0.14, -0.44], Kf = [0, -0.04, 0.15];
  const Cl = [-0.16, 0.0, -0.5], Cr = [0.16, 0.0, -0.5], Lt = [-0.38, 0.075, -0.47], Rt = [0.38, 0.075, -0.47];
  const tris = [
    [N, Cl, T], [N, Lt, Cl],      // left wing (inner facet, outer facet)
    [N, T, Cr], [N, Cr, Rt],      // right wing
    [N, K, T], [N, Kf, K],        // keel
  ];
  const pos = new Float32Array(tris.flat(2));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const mat = look.toonMaterial({ color, steps: 3, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.userData.noOutline = true; group.add(mesh);
  // crease lines (faint) + silhouette edges (dark)
  const seg = (...pts) => new Float32Array(pts.flat());
  const creases = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(seg(N, Cl, N, Cr, N, Kf, Kf, K), 3)), new THREE.LineBasicMaterial({ color: 0x9aa0c0, transparent: true, opacity: 0.55 }));
  const edges = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(seg(N, Lt, Lt, Cl, Cl, T, N, Rt, Rt, Cr, Cr, T, N, T, K, T), 3)), new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: 0.85 }));
  creases.userData.noOutline = edges.userData.noOutline = true; group.add(creases, edges);
  group.scale.setScalar(scale);
  let path = null; const look_ = new THREE.Vector3();
  return {
    group, mesh, glidePath,
    setPath(fn) { path = fn; },
    update(f) {
      if (!path) return;
      const s = path(f); if (!s || !s.pos) return;
      group.position.copy(s.pos);
      if (s.dir) { group.up.set(0, 1, 0); group.lookAt(look_.copy(s.pos).add(s.dir)); }
      if (s.roll) group.rotateZ(s.roll);
      if (s.pitch) group.rotateX(s.pitch);
    },
  };
}

// =====================================================================================
// GOD RAYS
// =====================================================================================
/**
 * createGodRays(ctx, { origin, color, count, seed, direction, length, spread, width, intensity, speed })
 * Additive fan of long tapered planes from `origin` (group position) along `direction`, each cylindrically
 * billboarded toward the camera, slowly swaying and breathing. depthTest on so ridges occlude them.
 * -> { group, mesh, update(f), setIntensity(0..1), setDirection(dir), uniforms }
 */
export function createGodRays(ctx, { origin = [0, 60, -400], color = 0xffe3a0, count = 12, seed = 18, direction = [0, -0.25, 1], length = 500, spread = 0.45, width = 40, intensity = 1, speed = 1 } = {}) {
  const r = rngOf(ctx, seed);
  const dir = v3(direction).normalize();
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, up).normalize(); const up2 = new THREE.Vector3().crossVectors(side, dir).normalize();
  const n = count, pos = new Float32Array(n * 6 * 3), aDir = new Float32Array(n * 6 * 3), aTan = new Float32Array(n * 6 * 3), aAS = new Float32Array(n * 6 * 3);
  const corners = [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]];
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n - 1) - 0.5) * spread * 2 + (r() - 0.5) * spread * 0.3, tilt = (r() - 0.5) * spread * 0.5;
    const d = dir.clone().addScaledVector(side, Math.sin(ang)).addScaledVector(up2, Math.sin(tilt)).normalize();
    const tg = new THREE.Vector3().crossVectors(d, up2).normalize();
    const ph = r(), lenK = 0.6 + r() * 0.6, wK = 0.5 + r();
    for (let k = 0; k < 6; k++) { const o = (i * 6 + k) * 3; pos.set([0, 0, 0], o); aDir.set([d.x, d.y, d.z], o); aTan.set([tg.x, tg.y, tg.z], o); aAS.set([corners[k][0] * lenK, corners[k][1] * wK, ph], o); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3)); geo.setAttribute('aTan', new THREE.BufferAttribute(aTan, 3)); geo.setAttribute('aAS', new THREE.BufferAttribute(aAS, 3));
  const uniforms = { uTime: { value: 0 }, uLen: { value: length }, uWidth: { value: width }, uColor: { value: col(color) }, uIntensity: { value: intensity }, uSpeed: { value: speed } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime, uLen, uWidth, uSpeed;
      attribute vec3 aDir, aTan, aAS;
      varying vec2 vAS; varying float vPulse;
      void main(){
        float along = aAS.x, sd = aAS.y, ph = aAS.z;
        vec3 d = normalize(aDir + aTan * sin(uTime*0.25*uSpeed + ph*6.2832) * 0.06);
        vec3 wo = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
        vec3 wd = normalize(mat3(modelMatrix) * d);
        vec3 p = wo + wd * along * uLen;
        vec3 toCam = cameraPosition - p;
        vec3 s = normalize(cross(wd, toCam));
        float w = uWidth * (0.06 + 0.94*along);
        p += s * sd * w;
        vAS = vec2(along, sd); vPulse = 0.7 + 0.3*sin(uTime*0.6*uSpeed + ph*12.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity;
      varying vec2 vAS; varying float vPulse;
      void main(){
        float across = pow(1.0 - vAS.y*vAS.y, 1.6);
        float along = pow(1.0 - vAS.x, 1.3) * smoothstep(0.0, 0.05, vAS.x);
        float a = across * along * vPulse * uIntensity * 0.55;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor * a, a);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.noOutline = true;
  const group = new THREE.Group(); group.position.copy(v3(origin)); group.add(mesh);
  return {
    group, mesh, uniforms,
    update(f) { uniforms.uTime.value = f / FPS; },
    setIntensity(i) { uniforms.uIntensity.value = Math.max(0, i); mesh.visible = i > 0.001; },
    setDirection(d) { // rebuild attribute directions around a new main direction
      const nd = v3(d).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(dir, nd); dir.copy(nd);
      const t = new THREE.Vector3(); for (const name of ['aDir', 'aTan']) { const at = geo.attributes[name]; for (let i = 0; i < at.count; i++) { t.fromBufferAttribute(at, i).applyQuaternion(q); at.setXYZ(i, t.x, t.y, t.z); } at.needsUpdate = true; }
    },
  };
}

// =====================================================================================
// LENS FLARE
// =====================================================================================
/**
 * createLensFlare(ctx, { sun, color, intensity, seed })
 * Screen-space flare: core glow, halo, anamorphic streak, hexagon ghosts along the sun->centre axis, rainbow ring.
 * update(f, camera) projects the world-space sun each frame; fades as the sun leaves the frame; zero when behind.
 * -> { group, mesh, update(f, camera), setIntensity(0..1), setSun([x,y,z]), uniforms }
 */
export function createLensFlare(ctx, { sun = [0, 50, -500], color = 0xffd9a0, intensity = 1, seed = 23, streak = 1, ghosts = 1 } = {}) {
  const r = rngOf(ctx, seed);
  const base = col(color);
  const warm = base.clone(), rose = base.clone().lerp(new THREE.Color(0xff6fa8), 0.5), cyan = base.clone().lerp(new THREE.Color(0x7fe9ff), 0.6), green = base.clone().lerp(new THREE.Color(0xa8ff9e), 0.5);
  // k = 0 at sun, 1 at screen centre, 2 opposite side.  type: 0 disc, 1 ring, 2 streak, 3 hexagon
  const els = [
    { k: 0, size: [0.42, 0.42], type: 0, c: warm, a: 0.9 },
    { k: 0, size: [0.9, 0.9], type: 0, c: warm, a: 0.25 },
    { k: 0, size: [0.7, 0.7], type: 1, c: rose, a: 0.18 },
    { k: 0, size: [2.4 * streak, 0.05], type: 2, c: cyan, a: 0.6 * streak },
    { k: 0.3, size: [0.09, 0.09], type: 3, c: cyan, a: 0.35 * ghosts },
    { k: 0.5, size: [0.05, 0.05], type: 3, c: green, a: 0.4 * ghosts },
    { k: 0.75, size: [0.14, 0.14], type: 3, c: rose, a: 0.22 * ghosts },
    { k: 1.15, size: [0.07, 0.07], type: 3, c: warm, a: 0.35 * ghosts },
    { k: 1.45, size: [0.2, 0.2], type: 3, c: cyan, a: 0.16 * ghosts },
    { k: 1.75, size: [0.36, 0.36], type: 1, c: warm, a: 0.22 * ghosts },
    { k: 2.1, size: [0.1, 0.1], type: 3, c: green, a: 0.25 * ghosts },
  ];
  const n = els.length, pos = new Float32Array(n * 6 * 3), aP = new Float32Array(n * 6 * 4), aC = new Float32Array(n * 6 * 4), aLoc = new Float32Array(n * 6 * 2);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  els.forEach((e, i) => { const jit = (r() - 0.5) * 0.02; for (let k = 0; k < 6; k++) { const o = i * 6 + k; pos.set([0, 0, 0], o * 3); aP.set([e.k + jit, e.size[0], e.size[1], e.type], o * 4); aC.set([e.c.r, e.c.g, e.c.b, e.a], o * 4); aLoc.set(corners[k], o * 2); } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aP', new THREE.BufferAttribute(aP, 4)); geo.setAttribute('aC', new THREE.BufferAttribute(aC, 4)); geo.setAttribute('aLoc', new THREE.BufferAttribute(aLoc, 2));
  const uniforms = { uSun: { value: new THREE.Vector2(0, 0) }, uVis: { value: 0 }, uAspect: { value: aspectOf(ctx) }, uIntensity: { value: intensity }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform vec2 uSun; uniform float uAspect;
      attribute vec4 aP, aC; attribute vec2 aLoc;
      varying vec2 vLoc; varying vec4 vC; varying float vType;
      void main(){
        vec2 c = uSun * (1.0 - aP.x);
        vec2 p = c + aLoc * vec2(aP.y / uAspect, aP.z);
        vLoc = aLoc; vC = aC; vType = aP.w;
        gl_Position = vec4(p, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uVis, uIntensity, uTime;
      varying vec2 vLoc; varying vec4 vC; varying float vType;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0); }
      float hexSdf(vec2 p){ p = abs(p); return max(dot(p, vec2(0.8660254, 0.5)), p.y); }
      void main(){
        float rr = length(vLoc); float a = 0.0; vec3 c = vC.rgb;
        if (vType < 0.5) { a = pow(max(0.0, 1.0 - rr), 2.2) + exp(-rr*rr*10.0) * 0.6; }
        else if (vType < 1.5) { a = smoothstep(0.1, 0.0, abs(rr - 0.78)) * 0.9 + smoothstep(0.2, 0.0, abs(rr - 0.78))*0.3; c = mix(c, hue(fract(rr*1.4 + 0.1)), 0.55); if (rr > 1.0) a = 0.0; }
        else if (vType < 2.5) { a = pow(max(0.0, 1.0 - abs(vLoc.x)), 2.5) * exp(-vLoc.y*vLoc.y*3.0) * (1.0 + 0.6*exp(-vLoc.x*vLoc.x*30.0)); }
        else { float h = hexSdf(vLoc); a = smoothstep(0.03, -0.03, h - 0.9) * (0.35 + 0.65*smoothstep(0.4, 0.9, h)); c = mix(c, hue(fract(h*0.5 + 0.6)), 0.25); }
        a *= vC.a * uVis * uIntensity;
        if (a < 0.002) discard;
        gl_FragColor = vec4(c * a, a);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 1000; mesh.userData.noOutline = true;
  const group = new THREE.Group(); group.add(mesh);
  const sunW = v3(sun); let lastCam = null; const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  return {
    group, mesh, uniforms, sun: sunW,
    update(f, camera) {
      uniforms.uTime.value = f / FPS;
      camera = camera || lastCam; if (!camera) { uniforms.uVis.value = 0; return; } lastCam = camera;
      camera.updateMatrixWorld(); camera.getWorldDirection(fwd);
      tmp.copy(sunW).sub(camera.getWorldPosition(new THREE.Vector3()));
      if (tmp.dot(fwd) <= 0) { uniforms.uVis.value = 0; return; }
      tmp.copy(sunW).project(camera);
      uniforms.uSun.value.set(tmp.x, tmp.y);
      const m = Math.max(Math.abs(tmp.x), Math.abs(tmp.y));
      const vis = 1 - THREE.MathUtils.smoothstep(m, 0.95, 1.35);
      uniforms.uVis.value = vis * (0.96 + 0.04 * Math.sin(f * 0.37));
      mesh.visible = uniforms.uVis.value > 0.001;
    },
    setIntensity(i) { uniforms.uIntensity.value = Math.max(0, i); },
    setSun(s) { sunW.copy(v3(s)); },
  };
}

// =====================================================================================
// STEAM
// =====================================================================================
/**
 * createSteam(ctx, { seed, max, color, size, buoyancy })
 * Instanced soft-disc puffs (canvas radial texture, 3-step toon edge) in a ring buffer of `max` instances.
 * emit(frame, pos, { count, speed, size, life, dir, spread }) schedules puffs born at `frame`; the shader evaluates
 * each puff from uFrame so results are identical whether emitted at build time or inside update().
 * -> { group, mesh, update(f), emit(), uniforms }
 */
export function createSteam(ctx, { seed = 19, max = 800, color = 0xf4f6ff, size = 1, buoyancy = 0.6 } = {}) {
  const r = rngOf(ctx, seed);
  const geo = instancedQuad(max);
  const aStart = new Float32Array(max).fill(-1e9), aPos = new Float32Array(max * 3), aVel = new Float32Array(max * 3), aSeed = new Float32Array(max * 4);
  const A = { start: new THREE.InstancedBufferAttribute(aStart, 1), pos: new THREE.InstancedBufferAttribute(aPos, 3), vel: new THREE.InstancedBufferAttribute(aVel, 3), seed: new THREE.InstancedBufferAttribute(aSeed, 4) };
  for (const a of Object.values(A)) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aStart', A.start); geo.setAttribute('aPos', A.pos); geo.setAttribute('aVel', A.vel); geo.setAttribute('aSeed', A.seed);
  const uniforms = { uFrame: { value: 0 }, uColor: { value: col(color) }, uMap: { value: softDiscTexture({ size: 128 }) }, uBuoy: { value: buoyancy }, uSize: { value: size } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uFrame, uBuoy, uSize;
      attribute float aStart; attribute vec3 aPos, aVel; attribute vec4 aSeed;
      varying vec2 vUv; varying float vAlpha; varying float vU;
      void main(){
        float age = (uFrame - aStart) / 24.0; float life = aSeed.y; float u = age / life;
        if (age < 0.0 || u > 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vAlpha = 0.0; vUv = uv; vU = 0.0; return; }
        float ph = aSeed.w * 6.2832;
        vec3 p = aPos + aVel * age * (1.0 - 0.45*u) + vec3(0.0, uBuoy * age * age * 0.5, 0.0);
        p.x += sin(age*1.7 + ph) * 0.25 * age; p.z += cos(age*1.3 + ph*1.3) * 0.25 * age;
        float s = aSeed.x * uSize * (0.35 + 1.3*u);
        float rot = ph + age * 0.8 * (aSeed.w - 0.5);
        vec2 c = vec2(cos(rot)*position.x - sin(rot)*position.y, sin(rot)*position.x + cos(rot)*position.y) * s;
        vec4 pv = modelViewMatrix * vec4(p, 1.0); pv.xy += c;
        vAlpha = smoothstep(0.0, 0.1, u) * pow(1.0 - u, 1.6) * (0.6 + 0.4*aSeed.z);
        vUv = uv; vU = u;
        gl_Position = projectionMatrix * pv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uColor; varying vec2 vUv; varying float vAlpha; varying float vU;
      void main(){
        float t = texture2D(uMap, vUv).a;
        float a = (smoothstep(0.28, 0.34, t) * 0.55 + smoothstep(0.6, 0.68, t) * 0.3 + t * 0.15) * vAlpha;
        if (a < 0.004) discard;
        float lit = smoothstep(0.2, 0.9, dot(vUv - 0.5, vec2(-0.5, 0.7)) + 0.55);
        gl_FragColor = vec4(uColor * (0.78 + 0.3*lit), a);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 15; mesh.userData.noOutline = true;
  const group = new THREE.Group(); group.add(mesh);
  let head = 0;
  return {
    group, mesh, uniforms,
    update(f) { uniforms.uFrame.value = f; },
    emit(frame, pos, { count = 12, speed = 1.5, size: sz = 1, life = 2.5, dir = [0, 1, 0], spread = 0.8, jitter = 0.3 } = {}) {
      const p = v3(pos), d = v3(dir).normalize();
      const er = rngOf(ctx, (seed * 7919 + frame * 131 + count) | 0);
      for (let i = 0; i < count; i++) {
        const k = head; head = (head + 1) % max;
        const sp = speed * (0.5 + er());
        const vx = d.x + (er() - 0.5) * spread, vy = d.y + (er() - 0.5) * spread, vz = d.z + (er() - 0.5) * spread;
        aStart[k] = frame + er() * 6; aPos.set([p.x + (er() - 0.5) * jitter, p.y + (er() - 0.5) * jitter, p.z + (er() - 0.5) * jitter], k * 3);
        aVel.set([vx * sp, vy * sp, vz * sp], k * 3); aSeed.set([sz * (0.5 + er()), life * (0.7 + 0.6 * er()), er(), er()], k * 4);
      }
      for (const a of Object.values(A)) a.needsUpdate = true;
    },
  };
}

// =====================================================================================
// BOKEH LIGHTS
// =====================================================================================
/**
 * createBokehLights(ctx, { count, area, center, seed, colors, sizeRange, opacity, drift })
 * Instanced soft lens-bokeh discs (bright rim) in neon colours, slow drift and twinkle. Additive.
 * -> { group, mesh, update(f), setOpacity(a), uniforms }
 */
export function createBokehLights(ctx, { count = 80, area = [30, 16, 10], center = [0, 0, -20], seed = 20, colors = [0xff3fa4, 0x3ff0ff, 0xffb347, 0xffffff, 0xf2a1b5, 0x8f7bff], sizeRange = [0.3, 1.3], opacity = 0.55, drift = 0.4 } = {}) {
  count = Math.min(count, 20000);
  const r = rngOf(ctx, seed);
  const geo = instancedQuad(count);
  const aPos = new Float32Array(count * 3), aSeed = new Float32Array(count * 4), aCol = new Float32Array(count * 3);
  const c = v3(center), a = v3(area);
  for (let i = 0; i < count; i++) {
    aPos.set([c.x + (r() - 0.5) * a.x, c.y + (r() - 0.5) * a.y, c.z + (r() - 0.5) * a.z], i * 3);
    const cc = col(colors[(r() * colors.length) | 0]); aCol.set([cc.r, cc.g, cc.b], i * 3);
    aSeed.set([sizeRange[0] + Math.pow(r(), 1.5) * (sizeRange[1] - sizeRange[0]), r(), 0.4 + r() * 1.2, r()], i * 4);
  }
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3)); geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 4)); geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: opacity }, uDrift: { value: drift } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uDrift;
      attribute vec3 aPos, aCol; attribute vec4 aSeed;
      varying vec2 vUv; varying vec3 vCol; varying float vA;
      void main(){
        float ph = aSeed.y * 6.2832;
        vec3 p = aPos + uDrift * vec3(sin(uTime*0.11 + ph), cos(uTime*0.09 + ph*1.7)*0.6, 0.0);
        float tw = 0.65 + 0.35 * sin(uTime * aSeed.z * 1.5 + ph) * sin(uTime*0.7 + ph*3.0);
        float s = aSeed.x * (0.92 + 0.08*tw);
        vec4 pv = modelViewMatrix * vec4(p, 1.0); pv.xy += position.xy * s;
        vUv = uv; vCol = aCol; vA = tw * (0.6 + 0.4*aSeed.w);
        gl_Position = projectionMatrix * pv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec2 vUv; varying vec3 vCol; varying float vA;
      void main(){
        float rr = length(vUv - 0.5) * 2.0;
        float disc = smoothstep(1.0, 0.9, rr);
        float a = disc * (0.5 + 0.5*smoothstep(0.55, 0.97, rr)) * vA * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol * a, a);
        ${GLSL_OUT}
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 8; mesh.userData.noOutline = true;
  const group = new THREE.Group(); group.add(mesh);
  return { group, mesh, uniforms, update(f) { uniforms.uTime.value = f / FPS; }, setOpacity(o) { uniforms.uOpacity.value = o; } };
}

// =====================================================================================
// CLOUDS
// =====================================================================================
/**
 * createClouds(ctx, { count, center, spread, color, seed, sunDir, shadow, outline, drift, size })
 * Anime cumulus: clustered spheres with flat bottoms merged per cloud, 3-band toon shading from `sunDir`,
 * soft blue outline, slow per-cloud drift (wraps inside `spread`). -> { group, clouds, update(f), setSun(dir), uniforms }
 */
export function createClouds(ctx, { count = 20, center = [0, 80, -400], spread = [600, 40, 200], color = 0xffffff, seed = 21, sunDir = [0.3, 0.6, 0.4], shadow = 0x9fb3e6, mid = 0xe4ecff, outline = true, drift = 0.6, size = 1 } = {}) {
  const r = rngOf(ctx, seed);
  const group = new THREE.Group(); const c = v3(center), sp = v3(spread);
  const uniforms = { uSun: { value: v3(sunDir).normalize() }, uLight: { value: col(color) }, uMid: { value: col(mid) }, uShadow: { value: col(shadow) } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`varying vec3 vN; varying float vY; void main(){ vN = normalize(mat3(modelMatrix) * normal); vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uLight, uMid, uShadow; varying vec3 vN; varying float vY;
      void main(){
        float d = dot(normalize(vN), uSun) + vY * 0.01;
        vec3 c = d > 0.3 ? uLight : (d > -0.15 ? uMid : uShadow);
        gl_FragColor = vec4(c, 1.0);
        ${GLSL_OUT}
      }`,
  });
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const w = (14 + r() * 26) * size, h = w * (0.35 + r() * 0.25), k = 5 + ((r() * 6) | 0);
    const parts = [];
    for (let j = 0; j < k; j++) {
      const u = j / (k - 1), x = (u - 0.5) * w * 0.8 + (r() - 0.5) * w * 0.15, rad = h * (0.45 + 0.55 * Math.sin(u * Math.PI)) * (0.8 + r() * 0.4);
      const g = new THREE.SphereGeometry(rad, 14, 10); g.translate(x, rad * 0.55 + (r() - 0.3) * h * 0.2, (r() - 0.5) * w * 0.25); parts.push(g);
    }
    const g = mergeGeometries(parts, false);
    { const p = g.attributes.position; for (let v = 0; v < p.count; v++) if (p.getY(v) < 0) p.setY(v, p.getY(v) * 0.1); p.needsUpdate = true; }
    const m = new THREE.Mesh(g, mat); m.userData.noOutline = !outline;
    const base = new THREE.Vector3(c.x + (r() - 0.5) * sp.x, c.y + (r() - 0.5) * sp.y, c.z + (r() - 0.5) * sp.z);
    m.position.copy(base);
    if (outline) look.addOutline(m, { thickness: Math.max(0.35, w * 0.018), color: 0x8da2d8 });
    group.add(m); clouds.push({ mesh: m, base, v: drift * (0.6 + r() * 0.8) });
  }
  return {
    group, clouds, uniforms,
    update(f) { const t = f / FPS; for (const cl of clouds) { let x = cl.base.x + cl.v * t - (c.x - sp.x / 2); x = ((x % sp.x) + sp.x) % sp.x; cl.mesh.position.x = x + c.x - sp.x / 2; } },
    setSun(d) { uniforms.uSun.value.copy(v3(d)).normalize(); },
  };
}

// =====================================================================================
// STARS
// =====================================================================================
/**
 * createStars(ctx, { count, radius, seed, size, horizonFade })
 * Point stars with per-star phase twinkle, a few larger four-point sparkles, warm/cool tints, horizon fade.
 * -> { group, points, update(f), setOpacity(a), uniforms }
 */
export function createStars(ctx, { count = 1500, radius = 800, seed = 22, size = 1, horizonFade = 0.08, opacity = 1 } = {}) {
  const r = rngOf(ctx, seed);
  const pos = new Float32Array(count * 3), sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(1 - r() * 0.95);
    pos.set([Math.cos(th) * Math.sin(ph) * radius, Math.cos(ph) * radius, Math.sin(th) * Math.sin(ph) * radius], i * 3);
    const big = r() < 0.06;
    sd.set([(big ? 2.6 + r() * 1.8 : 0.8 + r() * 1.3) * size, r(), 0.6 + r() * 2.0, r()], i * 4);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: opacity }, uRadius: { value: radius }, uFade: { value: horizonFade } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uRadius, uFade; attribute vec4 aSeed;
      varying float vTw; varying vec3 vCol; varying float vBig;
      void main(){
        float ph = aSeed.y * 6.2832;
        float tw = 0.55 + 0.45 * sin(uTime * aSeed.z * 2.0 + ph) * (0.5 + 0.5*sin(uTime*0.9 + ph*2.3));
        vTw = tw * smoothstep(0.0, uFade, position.y / uRadius);
        vBig = step(2.4, aSeed.x);
        vCol = mix(vec3(1.0), aSeed.w < 0.3 ? vec3(0.75, 0.85, 1.0) : (aSeed.w > 0.8 ? vec3(1.0, 0.85, 0.7) : vec3(1.0)), 0.8);
        gl_PointSize = aSeed.x * (0.8 + 0.25*tw) * 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying float vTw; varying vec3 vCol; varying float vBig;
      void main(){
        vec2 q = (gl_PointCoord - 0.5) * 2.0; float rr = length(q);
        float a = smoothstep(1.0, 0.15, rr);
        if (vBig > 0.5) a += (smoothstep(0.18, 0.0, abs(q.x)) * smoothstep(1.0, 0.1, abs(q.y)) + smoothstep(0.18, 0.0, abs(q.y)) * smoothstep(1.0, 0.1, abs(q.x))) * 0.7;
        a *= vTw * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol * a, a);
        ${GLSL_OUT}
      }`,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.userData.noOutline = true;
  const group = new THREE.Group(); group.add(points);
  return { group, points, uniforms, update(f) { uniforms.uTime.value = f / FPS; }, setOpacity(o) { uniforms.uOpacity.value = o; } };
}

// =====================================================================================
// LIGHT SWEEP
// =====================================================================================
/**
 * createLightSweep(ctx, { color, intensity, position, angle, penumbra, distance, bar, barWidth, beam })
 * A SpotLight whose projected map is a soft vertical bar (window light), plus an optional visible additive beam
 * slab. setSweep(f0, f1, from, to, { fade, lightFrom, lightTo, ease }) schedules the target moving from `from`
 * to `to` over [f0, f1] (several sweeps may be queued); intensity ramps in/out over `fade` frames. With no sweep
 * queued the light simply stays on. Add `group` to the scene (it carries light + target).
 * -> { light, group, beam, update(f), setSweep(), setIntensity(i) }
 */
export function createLightSweep(ctx, { color = 0xffd27a, intensity = 6, position = [-3, 2, 0], target = [0, 1, 0], angle = 0.35, penumbra = 0.5, distance = 14, bar = true, barWidth = 0.35, beam = false, beamOpacity = 0.12 } = {}) {
  const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, 1);
  light.position.copy(v3(position)); light.target.position.copy(v3(target));
  if (bar) { light.map = lightBarTexture(barWidth); light.shadow.camera.near = 0.2; light.shadow.camera.far = distance + 5; }
  const group = new THREE.Group(); group.add(light, light.target);
  let beamMesh = null;
  if (beam) {
    const bg = new THREE.PlaneGeometry(1, 1);
    const bm = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: col(color) }, uOpacity: { value: beamOpacity } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main(){ float a = pow(1.0 - abs(vUv.x-0.5)*2.0, 1.5) * smoothstep(0.0, 0.25, vUv.y) * uOpacity; gl_FragColor = vec4(uColor*a, a); ${GLSL_OUT} }`,
    });
    beamMesh = new THREE.Mesh(bg, bm); beamMesh.userData.noOutline = true; beamMesh.frustumCulled = false; group.add(beamMesh);
  }
  const sweeps = []; const base = intensity; let manual = 1;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), mid = new THREE.Vector3();
  const smooth = (x) => x * x * (3 - 2 * x);
  function placeBeam() {
    if (!beamMesh) return;
    tmpA.copy(light.position); tmpB.copy(light.target.position);
    const len = tmpA.distanceTo(tmpB); mid.addVectors(tmpA, tmpB).multiplyScalar(0.5);
    beamMesh.position.copy(mid); beamMesh.scale.set(Math.tan(angle) * len * barWidth * 2 + 0.2, len, 1);
    beamMesh.lookAt(tmpB); beamMesh.rotateX(Math.PI / 2);
  }
  placeBeam();
  return {
    light, group, beam: beamMesh,
    setSweep(f0, f1, from, to, { fade = 8, lightFrom = null, lightTo = null, ease = null } = {}) {
      sweeps.push({ f0, f1, from: v3(from), to: v3(to), fade, lightFrom: lightFrom ? v3(lightFrom) : null, lightTo: lightTo ? v3(lightTo) : null, ease });
    },
    setIntensity(i) { manual = i; light.intensity = base * i; },
    update(f) {
      if (!sweeps.length) { placeBeam(); return; }
      let active = null; for (const s of sweeps) if (f >= s.f0 - s.fade && f <= s.f1 + s.fade) { active = s; break; }
      if (!active) { light.intensity = 0; if (beamMesh) beamMesh.visible = false; return; }
      const s = active; const u0 = Math.max(0, Math.min(1, (f - s.f0) / Math.max(1, s.f1 - s.f0)));
      const u = s.ease ? s.ease(u0) : smooth(u0);
      light.target.position.lerpVectors(s.from, s.to, u);
      if (s.lightFrom && s.lightTo) light.position.lerpVectors(s.lightFrom, s.lightTo, u);
      const env = Math.min(1, Math.max(0, (f - s.f0 + s.fade) / s.fade)) * Math.min(1, Math.max(0, (s.f1 + s.fade - f) / s.fade));
      light.intensity = base * manual * env;
      if (beamMesh) { beamMesh.visible = env > 0.001; beamMesh.material.uniforms.uOpacity.value = beamOpacity * env; placeBeam(); }
    },
  };
}
