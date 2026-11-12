# 晨光列車 / First Light Express — Director's Bible

A 79-second anime short rendered purely from Three.js code. 24 fps, 1920×1080, 18 shots, exactly 1,896 frames.
The studio is one director (the orchestrating session) plus seven department agents working in parallel.

## Logline
A girl named Yuki leaves a rainy neon city on the first train of the morning. Through tunnels, blue-hour rice fields, a mountain dawn and a lane of cherry blossoms, she arrives at the sea at sunrise and lets go of a letter as a paper plane.

## Look
- **Reference feel**: Makoto Shinkai light and skies, Ghibli-era train journeys, cel/toon shading with clean outlines, saturated but soft palettes, bloom on light sources, subtle film grain. Frame is 16:9.
- **Palette arcs**: night (indigo #1a1b3a, neon magenta #ff3fa4, cyan #3ff0ff, sodium #ffb347) → blue hour (indigo → rose #f2a1b5) → dawn gold (#ffd27a, #ff9a5c) → sea morning (sky #8fd3ff, sea #2f8fd6, foam white).
- **Shading**: every surface uses `look.toonMaterial(...)` (stepped gradient ramp) and gets an outline via `look.addOutline(obj)`. No PBR-realistic materials. Flat, graphic, clean.
- **Camera**: slow, deliberate moves. Dollies, cranes, gentle handheld sway on interiors. Eases in/out. Never snap.
- **Post**: bloom, vignette, per-shot color grade preset, light grain, optional chromatic aberration on emotional beats. Film look, not video-game look.

## Character: Yuki (ユキ)
- ~17, slim, mid-length dark navy hair (#1e2140) with a lighter sheen, pale skin (#ffe9dc), cream blouse, dark pleated skirt, navy cardigan, small olive shoulder bag, clear umbrella in the city shots.
- Built procedurally from primitives (capsules, spheres, lathe for skirt/hair), toon shaded, outlined. Big simple anime eyes (two dark almond shapes with white highlight), small mouth. Expressions: neutral, sad, calm, surprise, smile.
- Rig API in `src/lib/characters.js`.

## Format
- `fps: 24`, `width: 1920`, `height: 1080`, `frameCount: 1896` (= 79.0 s).
- `bible/shots.json` is the single source of truth for shot ids, frame ranges and fades. Frame ranges are inclusive and contiguous: shot N ends at frame `end`, shot N+1 starts at `end + 1`.
- Frame → seconds: `t = frame / 24`.

## Engine contract (`src/engine/`) — do NOT change these signatures
Every shot module `src/shots/shotNN.js` is:

```js
export default {
  id: 'shot01',
  async build(ctx) {
    // ctx = { THREE, renderer, width, height, fps, shot, lib, overlay, ease, camrig, rng }
    // ctx.shot   = the manifest entry (id, start, end, frames, name, beat)
    // ctx.lib    = { characters, environments, vfx, look, titles }
    // ctx.ease   = easing helpers (src/engine/ease.js)
    // ctx.camrig = createRig(camera) factory (src/engine/camrig.js)
    // ctx.rng    = seeded RNG factory: const r = ctx.rng(42); r() -> [0,1)
    const scene = new ctx.THREE.Scene();
    const camera = new ctx.THREE.PerspectiveCamera(35, ctx.width / ctx.height, 0.1, 2000);
    // ... build sets, characters, vfx
    return {
      scene, camera,
      post: 'night-neon',               // optional: look preset name (see look.js PRESETS)
      update(local, t, global) {        // local frame index within the shot (0-based), t = local/fps
        // drive camera, animation, vfx here.
      },
      dispose() {}                      // optional
    };
  }
};
```

Rules:
1. `update()` is called for every frame of the shot in order, starting at local 0, before the frame is rendered. If a render worker starts mid-shot the engine warms up by calling `update()` for all earlier frames without rendering. So incremental simulation is fine; using `Math.random()` is NOT — use `ctx.rng(seed)` for determinism.
2. Never read wall-clock time, `performance.now()`, `Date.now()`, or `requestAnimationFrame`.
3. All assets are procedural: canvas textures, shaders, geometry. No external image/model/font files. Chinese text is rendered via the HTML overlay (`ctx.overlay`, system font Microsoft JhengHei) through `lib.titles`.
4. Keep per-frame work under ~250 ms on an integrated GPU. Prefer instancing, merged geometry, modest particle counts (≤ 20k), avoid rebuilding geometry per frame.
5. Shots must build without network and without console errors. Warnings are OK.
6. Shot fades (to/from black or white) are handled by the engine from `shots.json`; do not implement them in the shot.

## Department deliverables (each owns exactly the files listed, keeps every exported signature in the stub)
| Dept | Owns | Delivers |
|---|---|---|
| 1 Screenplay / Titles / Sound | `src/lib/titles.js`, `bible/SCREENPLAY.md`, `audio/synth.mjs` → `audio/score.wav` | Beat-by-beat screenplay, title/subtitle overlay implementation, procedural score |
| 2 Characters | `src/lib/characters.js` | Yuki rig + animation clips + expressions |
| 3 Environments | `src/lib/environments.js` | All sets: city, rooftop, station, train interior/exterior, countryside, mountains, sakura lane, coast, beach |
| 4 Look / Lighting / Post | `src/lib/look.js` | Toon materials, outlines, lighting kits, post stack with presets |
| 5 VFX | `src/lib/vfx.js` | Rain, mist, petals, speed lines, waves, gulls, paper plane, god rays, flare, steam |
| 6 Layout & Animation A | `src/shots/shot01.js` … `shot09.js` | Staged, animated shots 1–9 |
| 7 Layout & Animation B | `src/shots/shot10.js` … `shot18.js` | Staged, animated shots 10–18 |

Shot departments build against the stub libraries; library departments replace stub internals but keep signatures and return shapes. Integration is the director's job. Do not edit files you do not own; if you need an API that does not exist, build it locally inside your own file.

## Verifying your work
```bash
node render/preview.mjs --shot 5            # first/mid/last frames of shot 5 → preview/
node render/preview.mjs --frame 1200 --scale 0.5
node render/check.mjs                        # manifest integrity + one frame per shot smoke test
```
Look at the PNGs you produce (use the Read tool on them). If the console shows an error, fix it before finishing.
