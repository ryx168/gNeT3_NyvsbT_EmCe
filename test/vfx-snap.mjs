// Snapshot every VFX test scene at two frames -> preview/vfx/<fx>-<frame>.png, plus a per-frame cost benchmark.
//   node test/vfx-snap.mjs                 all effects
//   node test/vfx-snap.mjs --fx rain,sea   subset
//   options: --frames 10,60   --scale 0.5   --cpu   --bench 48
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../render/serve.mjs';
import { launch, openStudio, captureFrame } from '../render/browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const FRAMES = {
  rain: [10, 70], rainOnGlass: [20, 90], rainOnGlassColor: [30], mist: [0, 110], petals: [20, 60], speedLines: [5, 6], sea: [0, 60], seaClose: [30],
  gulls: [0, 40], gullClose: [0, 5], paperPlane: [20, 70], paperPlaneClose: [0], godRays: [0, 60], lensFlare: [0, 50], steam: [20, 70],
  bokeh: [0, 60], clouds: [0, 120], stars: [0, 17], lightSweep: [20, 60],
};
const outDir = path.resolve('preview/vfx'); fs.mkdirSync(outDir, { recursive: true });
const scale = Number(args.scale || 0.5);
const want = args.fx ? String(args.fx).split(',') : Object.keys(FRAMES);
const framesOverride = args.frames ? String(args.frames).split(',').map(Number) : null;

const { server, url } = await startServer(0);
const browser = await launch({ gpu: !args.cpu });
let gl = null; const report = [];
for (const fx of want) {
  const { page, console: con, gl: g } = await openStudio(browser, `${url}test/vfx.html?fx=${fx}`); gl = g;
  const frames = framesOverride || FRAMES[fx] || [0, 48];
  const errs = [];
  for (const f of frames) {
    const file = path.join(outDir, `${fx}-${f}.png`);
    const t0 = Date.now();
    const info = await captureFrame(page, f, file, { scale });
    errs.push(...info.errors);
    console.log(`${fx} frame ${f} -> ${path.relative(process.cwd(), file)}  ${Date.now() - t0} ms`);
  }
  const bench = await page.evaluate(n => window.__studio.bench(n), Number(args.bench || 48));
  const bad = con.filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  errs.push(...bad);
  report.push({ fx, ms: bench.msPerFrame, calls: bench.calls, tris: bench.triangles, errs });
  console.log(`  ${fx}: ${bench.msPerFrame.toFixed(2)} ms/frame, ${bench.calls} draw calls, ${bench.triangles} tris` + (errs.length ? `\n  ERRORS:\n    ${errs.join('\n    ')}` : ''));
  await page.close();
}
console.log('\nGL renderer:', gl);
console.log('effect            ms/frame  calls   triangles  errors');
for (const r of report) console.log(`${r.fx.padEnd(18)}${r.ms.toFixed(2).padStart(8)}  ${String(r.calls).padStart(5)}  ${String(r.tris).padStart(10)}  ${r.errs.length}`);
await browser.close(); server.close();
process.exit(report.some(r => r.errs.length) ? 1 : 0);
