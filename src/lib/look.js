// LOOK / LIGHTING / POST department — 晨光列車 / First Light Express.
// Cel materials, inverted-hull outlines, colour-scripted lighting kits, gradient skies, and the post stack
// (bloom + grade + vignette + deterministic grain). Every export of the original stub is kept; the rest is additive.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/** Reference key-light intensity that reads as "fully lit" in toonMaterial (lights at this level give the lit tone). */
export const LIGHT_REF = 3.0;
/** Reference hemisphere/ambient level that reads as the nominal shade tone. */
export const AMBIENT_REF = 0.8;

/** Mutable defaults applied to every toonMaterial() call (a shot may set e.g. materialDefaults.rim = {...}). */
export const materialDefaults = {
  steps: 3,
  lit: 0xfff6ea,        // slightly warm lit tone
  shadeTint: 0x6f6ca6,  // cool shadow multiplier (indigo-leaning)
  ambientInfluence: 0.55,
};

// ---------------------------------------------------------------------------------------------------------------
// Post presets (the names are the contract; the parameters are the film's colour script)
// ---------------------------------------------------------------------------------------------------------------
const GRADE_DEFAULTS = {
  exposure: 1.0, tonemap: 'aces',
  bloom: { threshold: 0.85, strength: 0.35, radius: 0.4 },
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
  saturation: 1.0, contrast: 1.0, vibrance: 0.0,
  shadows: [1, 1, 1], highlights: [1, 1, 1], split: 0.0,
  tint: [1, 1, 1],
  vignette: 0.35, vignetteSoft: 0.6,
  grain: 0.035, grainSize: 1.25,
  ca: 0.0, letterbox: 0.0, sharpen: 0.0,
};

/** Named grade presets a shot can request via `post: '<name>'`. Keys are merged over GRADE_DEFAULTS. */
export const PRESETS = {
  neutral: { bloom: { threshold: 0.9, strength: 0.25, radius: 0.3 }, vignette: 0.25, grain: 0.025 },

  'night-neon': {
    exposure: 1.05,
    bloom: { threshold: 0.55, strength: 0.95, radius: 0.65 },
    lift: [0.02, 0.01, 0.07], gamma: [1.0, 0.98, 1.05], gain: [1.05, 0.97, 1.08],
    saturation: 1.18, contrast: 1.08,
    shadows: [0.82, 0.86, 1.18], highlights: [1.14, 0.92, 1.12], split: 0.7,
    vignette: 0.5, vignetteSoft: 0.55, grain: 0.05, ca: 1.2,
  },
  'night-rain': {
    exposure: 0.95,
    bloom: { threshold: 0.5, strength: 0.85, radius: 0.8 },
    lift: [0.03, 0.03, 0.08], gamma: [1.0, 1.0, 1.04], gain: [0.96, 0.98, 1.08],
    saturation: 1.05, contrast: 1.04,
    shadows: [0.8, 0.88, 1.2], highlights: [1.05, 1.0, 1.1], split: 0.6,
    vignette: 0.55, vignetteSoft: 0.5, grain: 0.06, ca: 0.8,
  },
  station: {
    exposure: 1.0,
    bloom: { threshold: 0.7, strength: 0.45, radius: 0.5 },
    lift: [0.02, 0.015, 0.03], gamma: [1.0, 1.0, 1.0], gain: [1.08, 1.02, 0.9],
    saturation: 0.98, contrast: 1.05,
    shadows: [0.9, 0.95, 1.15], highlights: [1.12, 1.03, 0.85], split: 0.55,
    vignette: 0.45, vignetteSoft: 0.55, grain: 0.045, ca: 0.4,
  },
  'interior-night': {
    exposure: 1.05,
    bloom: { threshold: 0.7, strength: 0.4, radius: 0.7 },
    lift: [0.03, 0.02, 0.03], gamma: [1.0, 1.0, 1.02], gain: [1.08, 1.0, 0.86],
    saturation: 0.95, contrast: 0.96,
    shadows: [0.95, 0.9, 1.05], highlights: [1.1, 1.0, 0.85], split: 0.5,
    vignette: 0.5, vignetteSoft: 0.7, grain: 0.045, ca: 0.0,
  },
  'blue-hour': {
    exposure: 1.0,
    bloom: { threshold: 0.75, strength: 0.5, radius: 0.6 },
    lift: [0.04, 0.03, 0.12], gamma: [1.0, 1.0, 1.0], gain: [1.02, 0.95, 1.08],
    saturation: 1.1, contrast: 1.0,
    shadows: [0.78, 0.82, 1.25], highlights: [1.18, 0.95, 1.02], split: 0.65,
    vignette: 0.4, vignetteSoft: 0.6, grain: 0.04, ca: 0.3,
  },
  dawn: {
    exposure: 1.1,
    bloom: { threshold: 0.7, strength: 0.6, radius: 0.6 },
    lift: [0.05, 0.03, 0.02], gamma: [1.0, 1.0, 1.0], gain: [1.1, 1.0, 0.86],
    saturation: 1.12, contrast: 1.0,
    shadows: [0.92, 0.88, 1.08], highlights: [1.18, 1.02, 0.78], split: 0.6,
    vignette: 0.35, vignetteSoft: 0.6, grain: 0.035, ca: 0.3,
  },
  'interior-dawn': {
    exposure: 1.15,
    bloom: { threshold: 0.75, strength: 0.5, radius: 0.7 },
    lift: [0.05, 0.035, 0.025], gamma: [1.0, 1.0, 1.0], gain: [1.08, 1.0, 0.9],
    saturation: 1.05, contrast: 0.97,
    shadows: [0.95, 0.92, 1.05], highlights: [1.15, 1.02, 0.82], split: 0.5,
    vignette: 0.4, vignetteSoft: 0.7, grain: 0.035, ca: 0.2,
  },
  sakura: {
    exposure: 1.12,
    bloom: { threshold: 0.6, strength: 0.75, radius: 0.9 },
    lift: [0.09, 0.05, 0.08], gamma: [1.0, 1.0, 1.0], gain: [1.04, 0.98, 1.0],
    saturation: 1.08, contrast: 0.88,
    shadows: [1.08, 0.92, 1.04], highlights: [1.1, 0.98, 1.0], split: 0.5,
    vignette: 0.3, vignetteSoft: 0.75, grain: 0.03, ca: 0.6,
  },
  coast: {
    exposure: 1.1,
    bloom: { threshold: 0.9, strength: 0.3, radius: 0.4 },
    lift: [0.0, 0.0, 0.01], gamma: [1.0, 1.0, 1.0], gain: [1.02, 1.03, 1.06],
    saturation: 1.22, contrast: 1.08,
    shadows: [0.95, 0.98, 1.08], highlights: [1.04, 1.02, 1.0], split: 0.3,
    vignette: 0.25, vignetteSoft: 0.6, grain: 0.03, ca: 0.0,
  },
  sunrise: {
    exposure: 1.15,
    bloom: { threshold: 0.6, strength: 0.9, radius: 0.85 },
    lift: [0.06, 0.03, 0.0], gamma: [1.0, 1.0, 1.0], gain: [1.14, 1.0, 0.78],
    saturation: 1.15, contrast: 1.02,
    shadows: [0.98, 0.85, 0.95], highlights: [1.2, 1.05, 0.7], split: 0.7,
    vignette: 0.3, vignetteSoft: 0.6, grain: 0.035, ca: 0.8,
  },
  credits: { exposure: 1.0, bloom: { threshold: 2.0, strength: 0.0, radius: 0.0 }, vignette: 0.0, grain: 0.02, ca: 0.0 },
};

// ---------------------------------------------------------------------------------------------------------------
// Toon ramp
// ---------------------------------------------------------------------------------------------------------------
const rampCache = new Map();
/**
 * Stepped ramp texture used as the cel step function (red channel, 0 = shade .. 1 = lit).
 * toonRamp(steps = 3, { shadow = 0.1 }) — `shadow` shifts the terminator (dot(N,L) threshold band centre).
 */
export function toonRamp(steps = 3, { shadow = 0.1 } = {}) {
  steps = Math.max(2, Math.min(8, steps | 0));
  const key = steps + ':' + shadow;
  if (rampCache.has(key)) return rampCache.get(key);
  const W = 64, data = new Uint8Array(W * 4);
  const lo = shadow - 0.42, hi = shadow + 0.45;   // thresholds are spread between lo..hi in dot(N,L)
  for (let x = 0; x < W; x++) {
    const ndl = (x + 0.5) / W * 2 - 1;
    let level = 0;
    for (let k = 1; k < steps; k++) if (ndl > lo + (hi - lo) * k / steps) level = k;
    const v = Math.pow(level / (steps - 1), 0.8);
    const b = Math.round(255 * v);
    data.set([b, b, b, 255], x * 4);
  }
  const tex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  rampCache.set(key, tex); return tex;
}

// ---------------------------------------------------------------------------------------------------------------
// Toon material (MeshToonMaterial + injected cel lighting model)
// ---------------------------------------------------------------------------------------------------------------
const TOON_PARS = /* glsl */`
varying vec3 vViewPosition;
struct ToonMaterial { vec3 diffuseColor; };
vec3 gLit = vec3( 0.0 );
vec3 gAmb = vec3( 0.0 );
vec3 gSpec = vec3( 0.0 );
uniform vec3 uLitTint; uniform vec3 uShadeTint; uniform vec3 uShadeColor; uniform float uShadeMode;
uniform float uKeyRef; uniform float uAmbRef; uniform float uAmbInfluence; uniform float uLitBoost;
uniform vec3 uSpecColor; uniform float uSpecPower; uniform float uSpecSize; uniform float uSpecIntensity;
uniform vec3 uRimColor; uniform vec3 uRimDir; uniform float uRimIntensity; uniform float uRimWidth; uniform float uRimDirBias;
uniform vec3 uSheenColor; uniform float uSheenIntensity; uniform float uSheenOffset; uniform float uSheenWidth;
float maxc3( vec3 c ) { return max( c.r, max( c.g, c.b ) ); }
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	float s = getGradientIrradiance( geometryNormal, directLight.direction ).r;
	gLit += s * directLight.color;
	#ifdef TOON_SPEC
		vec3 h = normalize( directLight.direction + geometryViewDir );
		float sp = pow( saturate( dot( geometryNormal, h ) ), uSpecPower );
		float w = saturate( maxc3( directLight.color ) / uKeyRef );
		float fw = fwidth( sp ) * 1.5 + 0.004;
		float mask = smoothstep( uSpecSize - fw, uSpecSize + fw, sp ) * step( 0.5, s ) * w;
		gSpec = max( gSpec, mask * uSpecColor * uSpecIntensity );
	#endif
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	gAmb += irradiance;
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon
`;

const TOON_RESOLVE = /* glsl */`
{
	float bright = maxc3( gLit );
	float m = saturate( bright / uKeyRef );
	vec3 ltint = bright > 1e-4 ? gLit / bright : vec3( 1.0 );
	vec3 litCol = material.diffuseColor * uLitTint * mix( vec3( 1.0 ), ltint, 0.85 ) * ( 1.0 + uLitBoost * max( 0.0, bright / uKeyRef - 1.0 ) );
	float ab = maxc3( gAmb );
	vec3 atint = ab > 1e-4 ? gAmb / ab : vec3( 1.0 );
	vec3 dark = ( uShadeMode > 0.5 ) ? uShadeColor : material.diffuseColor * uShadeTint;
	dark *= mix( vec3( 1.0 ), atint, uAmbInfluence ) * clamp( ab / uAmbRef, 0.55, 1.45 );
	reflectedLight.directDiffuse = mix( dark, litCol, m );
	reflectedLight.indirectDiffuse = vec3( 0.0 );
	reflectedLight.directSpecular = gSpec;
	#ifdef TOON_RIM
	{
		float fres = 1.0 - saturate( dot( normal, geometryViewDir ) );
		float fw = fwidth( fres ) * 1.5 + 0.012;
		float rimMask = smoothstep( uRimWidth - fw, uRimWidth + fw, fres );
		vec3 rd = normalize( ( viewMatrix * vec4( uRimDir, 0.0 ) ).xyz );
		float bias = mix( 1.0, saturate( ( dot( normal, rd ) * 0.5 + 0.5 ) * 1.7 - 0.2 ), uRimDirBias );
		reflectedLight.directSpecular += uRimColor * uRimIntensity * rimMask * bias;
	}
	#endif
	#ifdef TOON_SHEEN
	{
		float band = abs( normal.y - ( uSheenOffset + 0.07 * sin( normal.x * 5.0 ) ) );
		float fw = fwidth( band ) * 1.5 + 0.01;
		float sm = ( 1.0 - smoothstep( uSheenWidth - fw, uSheenWidth + fw, band ) ) * saturate( normal.z * 1.6 );
		reflectedLight.directSpecular += uSheenColor * uSheenIntensity * sm * ( 0.45 + 0.55 * m );
	}
	#endif
}
`;

const _c = new THREE.Color();
function col(v, fallback) { return new THREE.Color(v === undefined || v === null ? fallback : v); }

/**
 * toonMaterial(opts) -> THREE.MeshToonMaterial with the film's cel model injected. Works with the standard
 * three lights (Directional/Point/Spot/Hemisphere/Ambient). Options (all optional):
 *   color, steps (2..8), shadow (terminator shift, -0.5..0.5), map, alphaMap, emissiveMap,
 *   emissive, emissiveIntensity, opacity, transparent, side, flat (flat shading), depthWrite, alphaTest, fog,
 *   lit        — warm tint multiplied into the lit tone        (default materialDefaults.lit)
 *   shade      — explicit colour for the dark side (overrides shadeTint)
 *   shadeTint  — multiplier for the dark side when no `shade`   (default materialDefaults.shadeTint)
 *   ambientInfluence — how much hemisphere colour tints the shade (0..1)
 *   litBoost   — how much key light above LIGHT_REF brightens the lit tone (default 0.5)
 *   rim        — true | colour | { color, intensity, width (fresnel threshold 0..1), dir [x,y,z] world, dirBias 0..1 }
 *   spec       — true | { color, power, size (0..1 threshold), intensity }   stepped highlight for hair/eyes
 *   sheen      — true | { color, intensity, offset (-1..1 view-space normal.y), width }   anime hair "angel ring"
 * The returned material exposes material.userData.toon = { uniforms, set(opts) } for live tweaks.
 */
export function toonMaterial(opts = {}) {
  const d = materialDefaults;
  const {
    color = 0xffffff, steps = d.steps, shadow = 0.1, emissive = 0x000000, emissiveIntensity = 1, opacity = 1,
    transparent = false, side = THREE.FrontSide, map = null, alphaMap = null, emissiveMap = null, flat = false,
    depthWrite, alphaTest, fog = true, lit = d.lit, shade, shadeTint = d.shadeTint, ambientInfluence = d.ambientInfluence,
    litBoost = 0.5, rim = d.rim, spec = d.spec, sheen = d.sheen, wireframe = false,
  } = opts;
  const mat = new THREE.MeshToonMaterial({
    color, gradientMap: toonRamp(steps, { shadow }), emissive, emissiveIntensity, opacity,
    transparent: transparent || opacity < 1, side, map, alphaMap, emissiveMap, fog, wireframe,
  });
  if (flat) mat.flatShading = true;
  if (depthWrite !== undefined) mat.depthWrite = depthWrite;
  if (alphaTest !== undefined) mat.alphaTest = alphaTest;

  const rimO = rim === true ? {} : (typeof rim === 'number' || typeof rim === 'string' || (rim && rim.isColor)) ? { color: rim } : rim;
  const specO = spec === true ? {} : spec;
  const sheenO = sheen === true ? {} : sheen;
  const u = {
    uLitTint: { value: col(lit, 0xfff6ea) },
    uShadeTint: { value: col(shadeTint, 0x6f6ca6) },
    uShadeColor: { value: col(shade, 0x000000) },
    uShadeMode: { value: shade !== undefined && shade !== null ? 1 : 0 },
    uKeyRef: { value: LIGHT_REF }, uAmbRef: { value: AMBIENT_REF },
    uAmbInfluence: { value: ambientInfluence }, uLitBoost: { value: litBoost },
    uSpecColor: { value: col(specO && specO.color, 0xffffff) },
    uSpecPower: { value: specO && specO.power !== undefined ? specO.power : 28 },
    uSpecSize: { value: specO && specO.size !== undefined ? specO.size : 0.5 },
    uSpecIntensity: { value: specO && specO.intensity !== undefined ? specO.intensity : 0.8 },
    uRimColor: { value: col(rimO && rimO.color, 0xfff0d8) },
    uRimDir: { value: new THREE.Vector3().fromArray(rimO && rimO.dir ? rimO.dir : [-0.4, 0.6, -1]).normalize() },
    uRimIntensity: { value: rimO && rimO.intensity !== undefined ? rimO.intensity : 0.6 },
    uRimWidth: { value: rimO && rimO.width !== undefined ? rimO.width : 0.62 },
    uRimDirBias: { value: rimO && rimO.dirBias !== undefined ? rimO.dirBias : 0.7 },
    uSheenColor: { value: col(sheenO && sheenO.color, 0xcfd6ff) },
    uSheenIntensity: { value: sheenO && sheenO.intensity !== undefined ? sheenO.intensity : 0.45 },
    uSheenOffset: { value: sheenO && sheenO.offset !== undefined ? sheenO.offset : 0.45 },
    uSheenWidth: { value: sheenO && sheenO.width !== undefined ? sheenO.width : 0.09 },
  };
  const flags = (rimO ? 'R' : '') + (specO ? 'S' : '') + (sheenO ? 'H' : '');
  mat.customProgramCacheKey = () => 'toon-' + flags;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    if (rimO) sh.defines = Object.assign(sh.defines || {}, { TOON_RIM: '' });
    if (specO) sh.defines = Object.assign(sh.defines || {}, { TOON_SPEC: '' });
    if (sheenO) sh.defines = Object.assign(sh.defines || {}, { TOON_SHEEN: '' });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_toon_pars_fragment>', TOON_PARS)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + TOON_RESOLVE);
  };
  mat.userData.toon = {
    uniforms: u,
    set(o = {}) {
      if (o.lit !== undefined) u.uLitTint.value.set(o.lit);
      if (o.shadeTint !== undefined) u.uShadeTint.value.set(o.shadeTint);
      if (o.shade !== undefined) { u.uShadeColor.value.set(o.shade); u.uShadeMode.value = o.shade === null ? 0 : 1; }
      if (o.rimColor !== undefined) u.uRimColor.value.set(o.rimColor);
      if (o.rimIntensity !== undefined) u.uRimIntensity.value = o.rimIntensity;
      if (o.rimDir !== undefined) u.uRimDir.value.fromArray(o.rimDir).normalize();
      if (o.specIntensity !== undefined) u.uSpecIntensity.value = o.specIntensity;
      if (o.sheenIntensity !== undefined) u.uSheenIntensity.value = o.sheenIntensity;
      if (o.sheenOffset !== undefined) u.uSheenOffset.value = o.sheenOffset;
      if (o.color !== undefined) mat.color.set(o.color);
      if (o.emissive !== undefined) mat.emissive.set(o.emissive);
      if (o.emissiveIntensity !== undefined) mat.emissiveIntensity = o.emissiveIntensity;
      if (o.opacity !== undefined) { mat.opacity = o.opacity; mat.transparent = o.opacity < 1 || mat.transparent; }
    },
  };
  return mat;
}

/** Unlit flat material for skies, glows, UI-like elements. flatMaterial({ color, opacity, transparent, side, map, blending, depthWrite, fog }) */
export function flatMaterial(opts = {}) {
  const { color = 0xffffff, opacity = 1, transparent = false, side = THREE.FrontSide, map = null, blending, depthWrite, fog = true, alphaMap = null, alphaTest } = opts;
  const m = new THREE.MeshBasicMaterial({ color, opacity, transparent: transparent || opacity < 1, side, map, alphaMap, fog });
  m.toneMapped = opts.toneMapped !== undefined ? opts.toneMapped : true;
  if (blending !== undefined) m.blending = blending;
  if (depthWrite !== undefined) m.depthWrite = depthWrite;
  if (alphaTest !== undefined) m.alphaTest = alphaTest;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Outlines (inverted hull, world-unit thickness clamped to a pixel range, instancing + skinning aware)
// ---------------------------------------------------------------------------------------------------------------
const OUTLINE_VERT = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
uniform float uThick; uniform float uMinPx; uniform float uMaxPx; uniform vec2 uRes;
void main() {
	vec3 objectNormal = vec3( normal );
	vec3 transformed = vec3( position );
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <skinning_vertex>
	vec4 p = vec4( transformed, 1.0 );
	vec3 n = objectNormal;
	#ifdef USE_INSTANCING
		p = instanceMatrix * p;
		n = mat3( instanceMatrix ) * n;
	#endif
	vec4 wp = modelMatrix * p;
	vec3 wn = normalize( mat3( modelMatrix ) * n );
	vec4 clip = projectionMatrix * viewMatrix * wp;
	float pxPerUnit = projectionMatrix[ 1 ][ 1 ] * 0.5 * uRes.y / max( abs( clip.w ), 1e-4 );
	float px = clamp( uThick * pxPerUnit, uMinPx, uMaxPx );
	wp.xyz += wn * ( px / pxPerUnit );
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const OUTLINE_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity;
void main() { gl_FragColor = vec4( uColor, uOpacity ); }`;

const outlineRes = { value: new THREE.Vector2(1920, 1080) };
/** Tell the outline shader the output size (createPostStack does this automatically). */
export function setOutlineResolution(w, h) { outlineRes.value.set(w, h); }

function lineColorFor(material) {
  const base = (material && material.color) ? material.color : _c.set(0x808080);
  const hsl = { h: 0, s: 0, l: 0 }; base.getHSL(hsl);
  const c = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.1 + 0.08), Math.max(0.03, hsl.l * 0.32));
  return c.lerp(new THREE.Color(0x1a1230), 0.4);
}

function outlineMaterial(color, thickness, minPx, maxPx, opacity) {
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERT, fragmentShader: OUTLINE_FRAG,
    uniforms: { uThick: { value: thickness }, uMinPx: { value: minPx }, uMaxPx: { value: maxPx }, uRes: outlineRes,
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    side: THREE.BackSide, transparent: opacity < 1, depthWrite: opacity >= 1,
    polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2.0, toneMapped: false, fog: false,
  });
}

/**
 * addOutline(object3D, { thickness = 0.02 (world units), color (default: darker version of each mesh's colour),
 *                        minPx = 1.0, maxPx = 5.0, opacity = 1 }) -> object3D
 * Adds an inverted-hull outline to every Mesh / InstancedMesh / SkinnedMesh under object3D. Idempotent: calling again
 * updates thickness/colour. Meshes with userData.noOutline (or materials with userData.noOutline) are skipped.
 */
export function addOutline(obj, { thickness = 0.02, color, minPx = 1.0, maxPx = 5.0, opacity = 1 } = {}) {
  if (!obj || !obj.traverse) return obj;
  const targets = [];
  obj.traverse(m => {
    if (!m.isMesh || m.userData.isOutline || m.userData.noOutline) return;
    if (m.isLine || m.isPoints || m.isSprite) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (!mat || mat.userData.noOutline || mat.userData.isOutline) return;
    if (!m.geometry || !m.geometry.attributes || !m.geometry.attributes.normal) return;
    targets.push(m);
  });
  for (const m of targets) {
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const matOpacity = mat.transparent ? Math.min(opacity, mat.opacity) : opacity;
    const lineColor = color !== undefined ? new THREE.Color(color) : lineColorFor(mat);
    let hull = m.userData.outline;
    if (hull && hull.parent === m && hull.geometry === m.geometry) {
      const u = hull.material.uniforms; u.uThick.value = thickness; u.uMinPx.value = minPx; u.uMaxPx.value = maxPx;
      u.uColor.value.copy(lineColor); u.uOpacity.value = matOpacity; continue;
    }
    if (hull && hull.parent) hull.parent.remove(hull);
    const hmat = outlineMaterial(lineColor, thickness, minPx, maxPx, matOpacity);
    hmat.userData.isOutline = true;
    if (m.isInstancedMesh) {
      hull = new THREE.InstancedMesh(m.geometry, hmat, m.instanceMatrix.count);
      hull.instanceMatrix = m.instanceMatrix;
      hull.count = m.count;
      hull.onBeforeRender = () => { hull.count = m.count; };
    } else if (m.isSkinnedMesh) {
      hull = new THREE.SkinnedMesh(m.geometry, hmat);
      hull.bindMode = m.bindMode;
      hull.bind(m.skeleton, m.bindMatrix);
    } else {
      hull = new THREE.Mesh(m.geometry, hmat);
    }
    hull.name = (m.name || 'mesh') + '#outline';
    hull.userData.isOutline = true; hull.userData.noOutline = true;
    hull.frustumCulled = m.frustumCulled; hull.layers.mask = m.layers.mask;
    hull.renderOrder = mat.transparent ? (m.renderOrder || 0) - 1 : (m.renderOrder || 0);
    hull.castShadow = false; hull.receiveShadow = false;
    if (mat.transparent) hull.onBeforeRender = () => { hmat.uniforms.uOpacity.value = Math.min(opacity, mat.opacity); };
    m.add(hull);
    m.userData.outline = hull;
  }
  return obj;
}

/** removeOutline(object3D) — strips hulls added by addOutline. */
export function removeOutline(obj) {
  const hulls = [];
  obj.traverse(m => { if (m.userData.isOutline) hulls.push(m); });
  for (const h of hulls) { if (h.parent) { h.parent.userData.outline = undefined; h.parent.remove(h); } h.material.dispose(); }
  return obj;
}

// ---------------------------------------------------------------------------------------------------------------
// Lighting kits
// ---------------------------------------------------------------------------------------------------------------
// key/fill/rim: { color, intensity, pos:[x,y,z] (direction from origin) }; hemi: { sky, ground, intensity }
const LIGHT_PRESETS = {
  neutral: { hemi: { sky: 0xbcc8ff, ground: 0x4a3f5a, intensity: 0.8 }, ambient: { color: 0xffffff, intensity: 0.0 },
    key: { color: 0xfff4e4, intensity: 3.0, pos: [5, 10, 6] }, fill: { color: 0x8fb3ff, intensity: 0.9, pos: [-6, 3, -2] },
    rim: { color: 0xffd9a0, intensity: 1.6, pos: [-2, 4, -8] } },
  'night-neon': { hemi: { sky: 0x4a3f8a, ground: 0x1a1030, intensity: 0.9 }, ambient: { color: 0x2a2050, intensity: 0.2 },
    key: { color: 0xc9d4ff, intensity: 2.2, pos: [3, 8, 5] }, fill: { color: 0x3ff0ff, intensity: 1.1, pos: [-7, 2, 2] },
    rim: { color: 0xff3fa4, intensity: 2.4, pos: [-3, 3, -8] }, rim2: { color: 0x3ff0ff, intensity: 1.6, pos: [6, 2, -7] } },
  'night-rain': { hemi: { sky: 0x3d3a7a, ground: 0x161228, intensity: 0.9 }, ambient: { color: 0x1a1a40, intensity: 0.2 },
    key: { color: 0xb8c4ff, intensity: 2.0, pos: [2, 9, 4] }, fill: { color: 0x48c8ff, intensity: 0.9, pos: [-6, 3, 1] },
    rim: { color: 0xff5cb8, intensity: 2.2, pos: [-4, 3, -8] }, rim2: { color: 0x7ff0ff, intensity: 1.2, pos: [5, 1, -7] } },
  station: { hemi: { sky: 0xd8e6ff, ground: 0x3a3630, intensity: 0.95 }, ambient: { color: 0xffe2b0, intensity: 0.15 },
    key: { color: 0xeaf2ff, intensity: 2.8, pos: [1, 10, 2] }, fill: { color: 0xffb347, intensity: 1.0, pos: [-5, 4, 3] },
    rim: { color: 0xfff1c0, intensity: 1.8, pos: [2, 4, -8] } },
  'interior-night': { hemi: { sky: 0x8a7a66, ground: 0x2a2630, intensity: 0.85 }, ambient: { color: 0xffd9a0, intensity: 0.25 },
    key: { color: 0xffd9a0, intensity: 2.5, pos: [1, 6, 2] }, fill: { color: 0x5a6aa8, intensity: 0.8, pos: [-6, 2, 4] },
    rim: { color: 0xffc27a, intensity: 1.4, pos: [-2, 3, -6] } },
  'blue-hour': { hemi: { sky: 0x3b4fb0, ground: 0x1c1838, intensity: 1.0 }, ambient: { color: 0x2a3070, intensity: 0.2 },
    key: { color: 0x6c82e8, intensity: 2.4, pos: [-6, 6, 8] }, fill: { color: 0x7a86c8, intensity: 0.8, pos: [6, 3, 2] },
    rim: { color: 0xf2a1b5, intensity: 2.6, pos: [-10, 2.5, -8] } },
  dawn: { hemi: { sky: 0xb7c6ff, ground: 0x5a4a60, intensity: 0.75 }, ambient: { color: 0xffc98a, intensity: 0.1 },
    key: { color: 0xffd27a, intensity: 3.3, pos: [-10, 2.2, -6] }, fill: { color: 0x8fa8ff, intensity: 0.9, pos: [8, 4, 6] },
    rim: { color: 0xff9a5c, intensity: 3.0, pos: [-12, 1.8, -10] } },
  'interior-dawn': { hemi: { sky: 0xffe2c0, ground: 0x6a5a66, intensity: 0.8 }, ambient: { color: 0xffd9a0, intensity: 0.15 },
    key: { color: 0xffd9a0, intensity: 3.4, pos: [-8, 3, 4] }, fill: { color: 0xa8b8ff, intensity: 0.9, pos: [7, 4, 2] },
    rim: { color: 0xffb070, intensity: 2.4, pos: [-6, 2, -8] } },
  sakura: { hemi: { sky: 0xffe0ec, ground: 0x8a6a74, intensity: 0.95 }, ambient: { color: 0xffd0e0, intensity: 0.15 },
    key: { color: 0xfff6e0, intensity: 3.1, pos: [4, 10, 6] }, fill: { color: 0xffb3c8, intensity: 1.3, pos: [-7, 3, 2] },
    rim: { color: 0xffe3ee, intensity: 2.0, pos: [-3, 5, -8] } },
  coast: { hemi: { sky: 0xbfe6ff, ground: 0x6a7a80, intensity: 0.9 }, ambient: { color: 0xffffff, intensity: 0.05 },
    key: { color: 0xfffdf5, intensity: 3.5, pos: [6, 12, 5] }, fill: { color: 0x8fd3ff, intensity: 1.1, pos: [-8, 3, 4] },
    rim: { color: 0xffffff, intensity: 1.8, pos: [-2, 5, -9] } },
  sunrise: { hemi: { sky: 0xffc8a0, ground: 0x5a4a66, intensity: 0.8 }, ambient: { color: 0xffb070, intensity: 0.12 },
    key: { color: 0xffc26a, intensity: 3.6, pos: [-9, 1.6, -8] }, fill: { color: 0x9fb8ff, intensity: 0.8, pos: [8, 4, 6] },
    rim: { color: 0xffa050, intensity: 3.4, pos: [-10, 1.2, -10] } },
  credits: { hemi: { sky: 0x808080, ground: 0x202020, intensity: 0.5 }, ambient: { color: 0xffffff, intensity: 0.2 },
    key: { color: 0xffffff, intensity: 2.5, pos: [2, 8, 6] }, fill: { color: 0xc0c8ff, intensity: 0.6, pos: [-5, 3, 2] },
    rim: { color: 0xffffff, intensity: 1.0, pos: [0, 4, -8] } },
};
export const lightPresets = LIGHT_PRESETS;

/**
 * lightingKit(scene, preset = 'neutral', opts) -> { ambient, hemi, key, fill, rim, rim2, group, sun, update(local), set(preset), dispose() }
 * Three-point + hemisphere toon lighting, colour-scripted per preset. `sun` is the key-light direction (unit Vector3,
 * pointing FROM the origin TOWARD the light), handy for sky domes. opts: { scale = 1 (light distance), intensity = 1 }.
 */
export function lightingKit(scene, preset = 'neutral', opts = {}) {
  const scale = opts.scale || 1, gain = opts.intensity || 1;
  const group = new THREE.Group(); group.name = 'lightingKit';
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  const ambient = new THREE.AmbientLight(0xffffff, 0);
  const key = new THREE.DirectionalLight(0xffffff, 1); key.name = 'key';
  const fill = new THREE.DirectionalLight(0xffffff, 1); fill.name = 'fill';
  const rim = new THREE.DirectionalLight(0xffffff, 1); rim.name = 'rim';
  const rim2 = new THREE.DirectionalLight(0xffffff, 0); rim2.name = 'rim2';
  group.add(hemi, ambient, key, fill, rim, rim2);
  // directional lights point at their target; keep the targets in the group at the origin
  for (const l of [key, fill, rim, rim2]) group.add(l.target);
  scene.add(group);
  const sun = new THREE.Vector3(0, 1, 0);
  let name = preset, base = {};
  function set(p) {
    name = p; const P = LIGHT_PRESETS[p] || LIGHT_PRESETS.neutral; base = P;
    hemi.color.set(P.hemi.sky); hemi.groundColor.set(P.hemi.ground); hemi.intensity = P.hemi.intensity * gain;
    ambient.color.set(P.ambient.color); ambient.intensity = P.ambient.intensity * gain;
    for (const [l, d] of [[key, P.key], [fill, P.fill], [rim, P.rim], [rim2, P.rim2]]) {
      if (!d) { l.intensity = 0; continue; }
      l.color.set(d.color); l.intensity = d.intensity * gain; l.position.set(d.pos[0] * scale, d.pos[1] * scale, d.pos[2] * scale);
    }
    sun.copy(key.position).normalize();
  }
  set(preset);
  const kit = {
    ambient, hemi, key, fill, rim, rim2, group, sun,
    get preset() { return name; },
    set,
    update(local = 0) {
      // deterministic, subtle life: neon breathes, fluorescent flickers, dawn/sunrise swell slowly
      const f = local | 0;
      if (name === 'night-neon' || name === 'night-rain') {
        rim.intensity = base.rim.intensity * gain * (1 + 0.08 * Math.sin(f * 0.21));
        if (base.rim2) rim2.intensity = base.rim2.intensity * gain * (1 + 0.1 * Math.sin(f * 0.17 + 1.3));
      } else if (name === 'station') {
        const flick = ((f * 7919) % 97) < 3 ? 0.9 : 1.0;
        key.intensity = base.key.intensity * gain * flick;
      } else if (name === 'dawn' || name === 'sunrise') {
        key.intensity = base.key.intensity * gain * (1 + 0.03 * Math.sin(f * 0.05));
      }
    },
    dispose() { if (group.parent) group.parent.remove(group); },
  };
  return kit;
}

// ---------------------------------------------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------------------------------------------
/** Palette arcs from the bible (also the sun). Pass one to createSkyDome(skyPresets.night) or sky.set(skyPresets.dawn). */
export const skyPresets = {
  night: { top: 0x0d0e24, horizon: 0x3b2a5a, bottom: 0x07070f, sunDir: [0, -1, 0], sunColor: 0x000000, sunSize: 0, glow: 0, haze: 0.55, hazeColor: 0x6a2a8a, stars: 0.9, horizonPow: 0.55 },
  nightRain: { top: 0x0b0c1e, horizon: 0x332552, bottom: 0x06060e, sunDir: [0, -1, 0], sunColor: 0x000000, sunSize: 0, glow: 0, haze: 0.8, hazeColor: 0x5a2a7a, stars: 0.0, horizonPow: 0.5 },
  station: { top: 0x0a0b1a, horizon: 0x2a2242, bottom: 0x08080f, sunDir: [0, -1, 0], sunColor: 0x000000, sunSize: 0, glow: 0, haze: 0.5, hazeColor: 0x7a4a2a, stars: 0.2, horizonPow: 0.5 },
  blueHour: { top: 0x121a4a, horizon: 0xf2a1b5, bottom: 0x1a1b3a, sunDir: [-0.9, 0.06, -0.4], sunColor: 0xffb0a0, sunSize: 0.02, glow: 0.7, haze: 0.5, hazeColor: 0xe08aa0, stars: 0.35, horizonPow: 0.8 },
  dawn: { top: 0x2a2d6a, horizon: 0xffd27a, bottom: 0x3a2a4a, sunDir: [-0.85, 0.18, -0.5], sunColor: 0xfff0c0, sunSize: 0.035, glow: 1.3, haze: 0.6, hazeColor: 0xff9a5c, stars: 0.0, horizonPow: 0.7 },
  mountainDawn: { top: 0x1c2060, horizon: 0xffc070, bottom: 0x2a2040, sunDir: [-0.7, 0.12, -0.7], sunColor: 0xfff4d0, sunSize: 0.04, glow: 1.6, haze: 0.7, hazeColor: 0xff9a5c, stars: 0.15, horizonPow: 0.65 },
  sakuraMorning: { top: 0x7fb8ff, horizon: 0xffe6f0, bottom: 0xc9d6e8, sunDir: [-0.4, 0.5, -0.75], sunColor: 0xfffaf0, sunSize: 0.03, glow: 0.8, haze: 0.5, hazeColor: 0xffd0e0, stars: 0.0, horizonPow: 0.9 },
  morningSea: { top: 0x4f9fe8, horizon: 0x8fd3ff, bottom: 0x2f8fd6, sunDir: [-0.5, 0.35, -0.8], sunColor: 0xfffbe8, sunSize: 0.035, glow: 1.0, haze: 0.45, hazeColor: 0xdff4ff, stars: 0.0, horizonPow: 0.9 },
  sunrise: { top: 0x5a7fd6, horizon: 0xffc27a, bottom: 0x3a7ac0, sunDir: [-0.3, 0.14, -0.95], sunColor: 0xfff2d0, sunSize: 0.05, glow: 2.0, haze: 0.7, hazeColor: 0xffb070, stars: 0.0, horizonPow: 0.75 },
};

const SKY_VERT = /* glsl */`
varying vec3 vP;
void main() { vP = normalize( position ); vec4 mv = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mv; }`;
const SKY_FRAG = /* glsl */`
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize; uniform float glow; uniform float sunIntensity;
uniform float haze; uniform vec3 hazeColor; uniform float stars; uniform float starSeed; uniform float twinkle; uniform float time;
uniform float horizonPow; uniform float bands;
varying vec3 vP;
float hash13( vec3 p3 ) { p3 = fract( p3 * 0.1031 ); p3 += dot( p3, p3.zyx + 31.32 ); return fract( ( p3.x + p3.y ) * p3.z ); }
void main() {
	vec3 d = normalize( vP );
	float h = d.y;
	vec3 c = h > 0.0 ? mix( horizon, top, pow( h, horizonPow ) ) : mix( horizon, bottom, pow( -h, 0.5 ) );
	// horizon haze band
	float hz = exp( -abs( h ) * 7.0 ) * haze;
	c = mix( c, hazeColor, hz * 0.75 );
	// sun disc + glow
	vec3 sd = normalize( sunDir );
	float cosA = dot( d, sd );
	float ang = acos( clamp( cosA, -1.0, 1.0 ) );
	float disc = sunSize > 0.0 ? 1.0 - smoothstep( sunSize * 0.9, sunSize * 1.08, ang ) : 0.0;
	float g = glow * ( 0.55 * pow( saturate( cosA ), 48.0 ) + 0.28 * pow( saturate( cosA ), 8.0 ) + 0.08 * saturate( cosA ) );
	c += sunColor * g;
	c = mix( c, sunColor * sunIntensity, disc );
	// stars (stepped, deterministic twinkle from the frame number)
	if ( stars > 0.0 && h > 0.0 ) {
		vec3 cell = floor( d * 140.0 + starSeed );
		float r = hash13( cell );
		float r2 = hash13( cell + 17.0 );
		vec3 centre = ( cell + 0.5 + ( vec3( r, r2, hash13( cell + 5.0 ) ) - 0.5 ) * 0.6 ) / 140.0;
		float dist = length( d * 140.0 - centre * 140.0 );
		float size = 0.12 + r2 * 0.22;
		float st = ( 1.0 - smoothstep( size * 0.6, size, dist ) ) * step( 1.0 - stars * 0.12, r );
		float tw = 0.65 + 0.35 * sin( time * ( 0.08 + r2 * 0.25 ) + r * 6.2832 ) * twinkle;
		st *= tw * smoothstep( 0.0, 0.25, h ) * ( 1.0 - saturate( g * 2.0 ) );
		c += vec3( 0.9, 0.95, 1.0 ) * st * ( 0.6 + 0.6 * r2 );
	}
	if ( bands > 0.0 ) c = floor( c * bands ) / bands;
	gl_FragColor = vec4( c, 1.0 );
}`;

/**
 * createSkyDome({ top, horizon, bottom, radius = 900, sunDir, sunColor, sunSize, glow, sunIntensity, haze, hazeColor,
 *                 stars, starSeed, twinkle, horizonPow, bands, followCamera = true })
 *   -> { mesh, uniforms, set({...same keys}), update(local) }
 * Gradient sky sphere with sun disc + glow, horizon haze band and optional stepped star twinkle (driven by update(local)).
 */
export function createSkyDome(opts = {}) {
  const o = Object.assign({ top: 0x1a1b3a, horizon: 0x3b2a5a, bottom: 0x0a0a16, radius: 900, sunDir: [0, -1, 0], sunColor: 0xfff0c0,
    sunSize: 0, glow: 0, sunIntensity: 1.6, haze: 0.4, hazeColor: 0x6a4a8a, stars: 0, starSeed: 0, twinkle: 1, horizonPow: 0.6, bands: 0, followCamera: true }, opts);
  const u = {
    top: { value: new THREE.Color(o.top) }, horizon: { value: new THREE.Color(o.horizon) }, bottom: { value: new THREE.Color(o.bottom) },
    sunDir: { value: new THREE.Vector3().fromArray(o.sunDir).normalize() }, sunColor: { value: new THREE.Color(o.sunColor) },
    sunSize: { value: o.sunSize }, glow: { value: o.glow }, sunIntensity: { value: o.sunIntensity },
    haze: { value: o.haze }, hazeColor: { value: new THREE.Color(o.hazeColor) }, stars: { value: o.stars }, starSeed: { value: o.starSeed },
    twinkle: { value: o.twinkle }, time: { value: 0 }, horizonPow: { value: o.horizonPow }, bands: { value: o.bands },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius, 48, 24), mat);
  mesh.userData.noOutline = true; mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.name = 'skyDome';
  if (o.followCamera) {
    const cp = new THREE.Vector3();
    mesh.onBeforeRender = (r, s, cam) => { cp.setFromMatrixPosition(cam.matrixWorld); mesh.matrixWorld.setPosition(cp); };
  }
  const colorKeys = ['top', 'horizon', 'bottom', 'sunColor', 'hazeColor'];
  const numKeys = ['sunSize', 'glow', 'sunIntensity', 'haze', 'stars', 'starSeed', 'twinkle', 'horizonPow', 'bands', 'time'];
  return {
    mesh, uniforms: u, material: mat,
    set(p = {}) {
      for (const k of colorKeys) if (p[k] !== undefined) u[k].value.set(p[k]);
      for (const k of numKeys) if (p[k] !== undefined) u[k].value = p[k];
      if (p.sunDir !== undefined) { const v = p.sunDir; if (v.isVector3) u.sunDir.value.copy(v); else u.sunDir.value.fromArray(v); u.sunDir.value.normalize(); }
    },
    update(local = 0) { u.time.value = local; },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Post stack
// ---------------------------------------------------------------------------------------------------------------
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1920, 1080) }, uFrame: { value: 0 }, uGlobal: { value: 0 },
    uExposure: { value: 1 }, uTonemap: { value: 1 },
    uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1 }, uContrast: { value: 1 }, uVibrance: { value: 0 },
    uShadows: { value: new THREE.Vector3(1, 1, 1) }, uHighlights: { value: new THREE.Vector3(1, 1, 1) }, uSplit: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uVig: { value: 0.3 }, uVigSoft: { value: 0.6 }, uGrain: { value: 0.03 }, uGrainSize: { value: 1.25 },
    uCA: { value: 0 }, uLetterbox: { value: 0 }, uSharpen: { value: 0 },
  },
  vertexShader: /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFrame; uniform float uGlobal;
uniform float uExposure; uniform float uTonemap;
uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain;
uniform float uSat; uniform float uContrast; uniform float uVibrance;
uniform vec3 uShadows; uniform vec3 uHighlights; uniform float uSplit; uniform vec3 uTint;
uniform float uVig; uniform float uVigSoft; uniform float uGrain; uniform float uGrainSize;
uniform float uCA; uniform float uLetterbox; uniform float uSharpen;
varying vec2 vUv;

vec3 RRTAndODTFit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
vec3 aces( vec3 color ) {
	const mat3 inM = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
	const mat3 outM = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
	color = inM * ( color / 0.6 ); color = RRTAndODTFit( color ); return clamp( outM * color, 0.0, 1.0 );
}
vec3 neutralTM( vec3 color ) {
	const float startCompression = 0.8 - 0.04; const float desat = 0.15;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04; color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < startCompression ) return color;
	float d = 1.0 - startCompression; float newPeak = 1.0 - d * d / ( peak + d - startCompression );
	color *= newPeak / peak; float g = 1.0 - 1.0 / ( desat * ( peak - newPeak ) + 1.0 );
	return mix( color, vec3( newPeak ), g );
}
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0 ) ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }

void main() {
	vec2 uv = vUv;
	vec2 texel = 1.0 / uRes;
	vec2 fromC = uv - 0.5;
	// chromatic aberration (radial, in px at the frame edge)
	vec3 c;
	if ( uCA > 0.0 ) {
		vec2 off = fromC * uCA * texel * 2.0 * length( fromC ) * 2.0;
		c = vec3( texture2D( tDiffuse, uv + off ).r, texture2D( tDiffuse, uv ).g, texture2D( tDiffuse, uv - off ).b );
	} else {
		c = texture2D( tDiffuse, uv ).rgb;
	}
	if ( uSharpen > 0.0 ) {
		vec3 blur = ( texture2D( tDiffuse, uv + vec2( texel.x, 0.0 ) ).rgb + texture2D( tDiffuse, uv - vec2( texel.x, 0.0 ) ).rgb
		            + texture2D( tDiffuse, uv + vec2( 0.0, texel.y ) ).rgb + texture2D( tDiffuse, uv - vec2( 0.0, texel.y ) ).rgb ) * 0.25;
		c += ( c - blur ) * uSharpen;
	}
	c = max( c, vec3( 0.0 ) ) * uExposure;
	// tone map (scene-linear -> display-linear)
	if ( uTonemap < 0.5 ) c = clamp( c, 0.0, 1.0 );
	else if ( uTonemap < 1.5 ) c = aces( c );
	else c = clamp( neutralTM( c ), 0.0, 1.0 );
	// display encode, then grade in display space
	c = toSRGB( c );
	c = pow( max( c * uGain + uLift * ( 1.0 - c ), vec3( 0.0 ) ), 1.0 / uGamma );
	float l = luma( c );
	float w = smoothstep( 0.15, 0.75, l );
	c *= mix( vec3( 1.0 ), mix( uShadows, uHighlights, w ), uSplit );
	c *= uTint;
	l = luma( c );
	c = mix( vec3( l ), c, uSat );
	if ( uVibrance != 0.0 ) { float mx = max( c.r, max( c.g, c.b ) ); float mn = min( c.r, min( c.g, c.b ) ); c = mix( vec3( l ), c, 1.0 + uVibrance * ( 1.0 - ( mx - mn ) ) ); }
	c = mix( vec3( 0.5 ), c, uContrast );
	c = clamp( c, 0.0, 1.0 );
	// vignette
	float aspect = uRes.x / uRes.y;
	float dv = length( fromC * vec2( aspect, 1.0 ) ) / length( vec2( aspect, 1.0 ) * 0.5 );
	float vig = 1.0 - uVig * smoothstep( 1.0 - uVigSoft, 1.15, dv );
	c *= vig;
	// deterministic film grain seeded by the local frame (no wall-clock, no Math.random)
	vec2 gp = floor( gl_FragCoord.xy / max( uGrainSize, 0.5 ) );
	float seed = uFrame * 7.31 + 13.0;
	float n = ( hash12( gp + seed ) + hash12( gp * 1.37 + seed * 2.11 + 41.0 ) ) * 0.5 - 0.5;   // triangular-ish
	float gl = luma( c );
	c += n * uGrain * ( 1.2 - gl * 0.8 );
	// 1-LSB dither against banding
	c += ( hash12( gl_FragCoord.xy + seed * 0.37 ) - 0.5 ) / 255.0;
	// letterbox 2.39:1
	if ( uLetterbox > 0.0 ) {
		float bar = ( 1.0 - ( 16.0 / 9.0 ) / 2.39 ) * 0.5 * uLetterbox;
		if ( uv.y < bar || uv.y > 1.0 - bar ) c = vec3( 0.0 );
	}
	gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`,
};

function mergePreset(name) {
  const p = PRESETS[name] || PRESETS.neutral;
  const out = JSON.parse(JSON.stringify(GRADE_DEFAULTS));
  for (const k of Object.keys(p)) {
    if (k === 'bloom') Object.assign(out.bloom, p.bloom);
    else out[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
  }
  return out;
}
const TONEMAP_ID = { none: 0, aces: 1, neutral: 2 };
function v3(target, v) { if (Array.isArray(v)) target.set(v[0], v[1], v[2]); else if (typeof v === 'number') { _c.set(v); target.set(_c.r, _c.g, _c.b); } else if (v && v.isVector3) target.copy(v); else if (v && v.isColor) target.set(v.r, v.g, v.b); }

/**
 * createPostStack({ renderer, scene, camera, width, height, preset = 'neutral', samples = 4 })
 *   -> { render(local, global), setPreset(name), setParam(key, value), preset, params, composer, dispose() }
 * Pipeline: scene -> MSAA HalfFloat target -> UnrealBloom (half res) -> grade pass (tonemap, lift/gamma/gain, split tone,
 * saturation/contrast, vignette, deterministic grain, chromatic aberration, letterbox) -> default framebuffer.
 * setParam keys: exposure, tonemap ('aces'|'neutral'|'none'), bloomThreshold|bloomStrength|bloomRadius (or 'bloom' object),
 * lift/gamma/gain/shadows/highlights/tint ([r,g,b] or hex), split, saturation, contrast, vibrance, vignette, vignetteSoft,
 * grain, grainSize, ca, letterbox (0..1), sharpen, enabled (bool: false = plain render).
 * Any failure inside falls back to a direct renderer.render(scene, camera).
 */
export function createPostStack({ renderer, scene, camera, width, height, preset = 'neutral', samples = 4 }) {
  width = width || renderer.domElement.width || 1920; height = height || renderer.domElement.height || 1080;
  setOutlineResolution(width, height);
  let name = PRESETS[preset] ? preset : 'neutral';
  let params = mergePreset(name);
  let composer = null, bloom = null, grade = null, broken = false, enabled = true;
  const savedToneMapping = renderer.toneMapping, savedExposure = renderer.toneMappingExposure;

  function build() {
    let rt;
    try { rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: samples | 0 }); }
    catch (e) { rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType }); }
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(1); composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(Math.round(width / 2), Math.round(height / 2)), 0.3, 0.4, 0.85);
    composer.addPass(bloom);
    grade = new ShaderPass({ uniforms: THREE.UniformsUtils.clone(GRADE_SHADER.uniforms), vertexShader: GRADE_SHADER.vertexShader, fragmentShader: GRADE_SHADER.fragmentShader });
    grade.material.toneMapped = false;
    grade.uniforms.uRes.value.set(width, height);
    composer.addPass(grade);
  }
  function apply() {
    if (!grade) return;
    const u = grade.uniforms, p = params;
    u.uExposure.value = p.exposure; u.uTonemap.value = TONEMAP_ID[p.tonemap] !== undefined ? TONEMAP_ID[p.tonemap] : 1;
    v3(u.uLift.value, p.lift); v3(u.uGamma.value, p.gamma); v3(u.uGain.value, p.gain);
    v3(u.uShadows.value, p.shadows); v3(u.uHighlights.value, p.highlights); v3(u.uTint.value, p.tint);
    u.uSplit.value = p.split; u.uSat.value = p.saturation; u.uContrast.value = p.contrast; u.uVibrance.value = p.vibrance;
    u.uVig.value = p.vignette; u.uVigSoft.value = p.vignetteSoft; u.uGrain.value = p.grain; u.uGrainSize.value = p.grainSize;
    u.uCA.value = p.ca; u.uLetterbox.value = p.letterbox; u.uSharpen.value = p.sharpen;
    bloom.threshold = p.bloom.threshold; bloom.strength = p.bloom.strength; bloom.radius = p.bloom.radius;
    bloom.enabled = p.bloom.strength > 0;
    renderer.toneMappingExposure = p.exposure;   // used by the fallback path only
  }
  try { build(); apply(); }
  catch (e) { broken = true; console.warn('[look] post stack unavailable, direct render:', e && e.message || e); }

  function direct() {
    renderer.setRenderTarget(null);
    renderer.toneMapping = savedToneMapping || THREE.ACESFilmicToneMapping;
    renderer.render(scene, camera);
  }
  const stack = {
    get preset() { return name; },
    get params() { return params; },
    get composer() { return composer; },
    get enabled() { return enabled && !broken; },
    setPreset(n) { if (!PRESETS[n]) { console.warn('[look] unknown preset', n); n = 'neutral'; } name = n; params = mergePreset(n); try { apply(); } catch (e) { broken = true; } },
    setParam(key, value) {
      if (key === 'enabled') { enabled = !!value; return; }
      const alias = { bloomThreshold: ['bloom', 'threshold'], bloomStrength: ['bloom', 'strength'], bloomRadius: ['bloom', 'radius'] };
      if (alias[key]) params.bloom[alias[key][1]] = value;
      else if (key === 'bloom' && value && typeof value === 'object') Object.assign(params.bloom, value);
      else if (key in params) params[key] = value;
      else { console.warn('[look] unknown post param', key); return; }
      try { apply(); } catch (e) { broken = true; }
    },
    render(local = 0, global = 0) {
      if (broken || !enabled || !composer) return direct();
      try {
        grade.uniforms.uFrame.value = local; grade.uniforms.uGlobal.value = global;
        composer.render();   // scene passes render linear into the HalfFloat target; the grade pass tone-maps to screen
        renderer.setRenderTarget(null);
      } catch (e) {
        broken = true; console.warn('[look] post stack failed, falling back to direct render:', e && e.message || e);
        direct();
      }
    },
    dispose() {
      try { if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); } if (bloom) bloom.dispose(); if (grade) grade.dispose(); } catch (e) {}
      renderer.toneMapping = savedToneMapping; renderer.toneMappingExposure = savedExposure;
      composer = null;
    },
  };
  return stack;
}
