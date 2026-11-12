// Integrity check: manifest contiguity + one mid frame per shot renders without console errors.
//   node render/check.mjs [--no-render] [--cpu]
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { launch, openStudio, captureFrame, warmUp } from './browser.mjs';

const args = new Set(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(new URL('../bible/shots.json', import.meta.url)));
let ok = true, expect = 0, sum = 0;
for (const s of manifest.shots) {
  if (s.start !== expect) { console.log(`GAP/OVERLAP: ${s.id} starts at ${s.start}, expected ${expect}`); ok = false; }
  if (s.end < s.start) { console.log(`BAD RANGE ${s.id}`); ok = false; }
  sum += s.end - s.start + 1; expect = s.end + 1;
  if (!fs.existsSync(new URL(`../src/shots/${s.id}.js`, import.meta.url))) { console.log(`MISSING src/shots/${s.id}.js`); ok = false; }
}
if (sum !== manifest.frameCount) { console.log(`frame sum ${sum} != frameCount ${manifest.frameCount}`); ok = false; }
console.log(`manifest: ${manifest.shots.length} shots, ${sum} frames = ${(sum / manifest.fps).toFixed(2)} s  ${ok ? 'OK' : 'BROKEN'}`);
if (!ok) process.exit(1);
if (args.has('--no-render')) process.exit(0);

const outDir = path.resolve('preview/check'); fs.mkdirSync(outDir, { recursive: true });
const { server, url } = await startServer(0);
const browser = await launch({ gpu: !args.has('--cpu') });
const { page, console: con, gl } = await openStudio(browser, url);
console.log('GL renderer:', gl);
await warmUp(page, 0);
let fail = 0;
for (const s of manifest.shots) {
  const f = Math.round((s.start + s.end) / 2);
  const t0 = Date.now();
  let info;
  try { info = await captureFrame(page, f, path.join(outDir, `${s.id}.png`), { scale: 0.5 }); }
  catch (e) { info = { errors: [String(e.message).split('\n')[0]] }; await page.evaluate(() => window.__studio.reset()).catch(() => {}); }
  const ms = Date.now() - t0;
  const bad = con.splice(0).filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  const errs = [...info.errors, ...bad];
  if (errs.length) fail++;
  console.log(`${s.id} frame ${f}: ${ms} ms ${errs.length ? 'ERROR ' + errs.join(' | ') : 'ok'}`);
}
await browser.close(); server.close();
console.log(fail ? `${fail} shots with errors` : 'all shots render clean');
process.exit(fail ? 1 : 0);
