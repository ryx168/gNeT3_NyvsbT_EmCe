// Preview single frames or a shot's first/mid/last frames.
//   node render/preview.mjs --frame 120
//   node render/preview.mjs --frames 0,500,1000
//   node render/preview.mjs --shot 5 [--n 3]       (n evenly spaced frames across the shot)
//   node render/preview.mjs --all                  (one mid frame per shot)
//   options: --scale 0.5  --out preview  --cpu (software GL)
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { launch, openStudio, captureFrame, warmUp } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const manifest = JSON.parse(fs.readFileSync(new URL('../bible/shots.json', import.meta.url)));
const outDir = path.resolve(args.out || 'preview');
fs.mkdirSync(outDir, { recursive: true });
const scale = Number(args.scale || 1);

let frames = [];
if (args.frame !== undefined) frames = [Number(args.frame)];
if (args.frames) frames = String(args.frames).split(',').map(Number);
if (args.shot) {
  const s = manifest.shots[Number(args.shot) - 1]; if (!s) throw new Error('no such shot');
  const n = Number(args.n || 3);
  for (let i = 0; i < n; i++) frames.push(Math.round(s.start + (s.end - s.start) * (n === 1 ? 0.5 : i / (n - 1))));
}
if (args.all) frames = manifest.shots.map(s => Math.round((s.start + s.end) / 2));
if (!frames.length) { console.log('nothing to do; see header of preview.mjs'); process.exit(1); }

const { server, url } = await startServer(0);
const browser = await launch({ gpu: !args.cpu });
const { page, console: con, gl } = await openStudio(browser, url);
console.log('GL renderer:', gl);
await warmUp(page, frames[0]);
for (const f of frames) {
  const t0 = Date.now();
  const file = path.join(outDir, `f${String(f).padStart(5, '0')}.png`);
  const info = await captureFrame(page, f, file, { scale });
  console.log(`frame ${f} (${info.shot} local ${info.local}) -> ${path.relative(process.cwd(), file)}  ${Date.now() - t0} ms` + (info.errors.length ? `\n  ERRORS: ${info.errors.join('\n  ')}` : ''));
}
const bad = con.filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));
if (bad.length) console.log('console errors:\n  ' + bad.join('\n  '));
await browser.close(); server.close();
