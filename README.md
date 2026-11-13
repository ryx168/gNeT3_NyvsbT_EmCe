# anime-studio — 晨光列車 / First Light Express

**Watch it:** [first_light_express.mp4](https://github.com/ryx168/gNeT3_NyvsbT_EmCe/releases/tag/run-12) (release `run-12`: 213 MB master at CRF 17, 49 MB web encode, contact sheet).
Rendered end to end on GitHub Actions: 12 ubuntu runners on SwiftShader, about 15 minutes per full render.

![contact sheet](https://github.com/ryx168/gNeT3_NyvsbT_EmCe/releases/download/run-12/contact_sheet.png)

A 79-second anime short produced entirely from code in a terminal: pure Three.js, 18 shots, 1,896 frames at 24 fps, 1920×1080.
Organised like a studio: one director (the orchestrating Claude session) plus seven department agents working in parallel,
each owning one library or a block of shots and building against a shared contract (`bible/DIRECTOR.md`).

```
bible/            DIRECTOR.md (vision + contract), shots.json (18 shots, frame ranges, fades), SCREENPLAY.md
src/engine/       main.js (deterministic frame stepping, shot switching, fades), camrig.js, ease.js
src/lib/          characters.js  environments.js  vfx.js  look.js  titles.js   ← one file per department
src/shots/        shot01.js … shot18.js                                        ← layout departments A (1–9) and B (10–18)
audio/            synth.mjs → score.wav (procedural score, no samples)
render/           serve.mjs  browser.mjs  preview.mjs  render.mjs  assemble.mjs  check.mjs
frames/  out/     rendered PNG frames, final MP4 (git-ignored)
```

## Pipeline
1. `index.html` loads the engine in headless Chrome (real GPU via ANGLE/D3D11 on this box, SwiftShader fallback with `--cpu`).
2. `window.__studio.seek(frame)` picks the shot from `shots.json`, builds it once, replays `update()` for every earlier frame
   (so renders can start mid-shot and stay deterministic), renders through the look department's post stack, then draws
   titles into an HTML overlay and the engine's fade layer.
3. `render/render.mjs` runs N Chrome pages over contiguous frame ranges and screenshots each frame to `frames/`.
4. `render/assemble.mjs` runs ffmpeg: frames → H.264 MP4, muxing `audio/score.wav`.

## Commands
```bash
npm install                                   # three + puppeteer-core (Chrome must be installed)
node render/check.mjs                         # manifest integrity + one frame per shot
node render/preview.mjs --shot 9 --n 4        # 4 frames across shot 9 → preview/
node render/preview.mjs --frame 1200
node render/render.mjs --workers 6            # all 1,896 frames → frames/   (resumable; --force to redo)
node audio/synth.mjs                          # → audio/score.wav
node render/assemble.mjs                      # → out/first_light_express.mp4
```

## Rules that keep it deterministic
No `Math.random`, no clocks, no `requestAnimationFrame`, no network, no external assets. Randomness comes from `ctx.rng(seed)`;
time comes from the frame number. Every pixel is a function of `(frame)`.
