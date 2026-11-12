// Full render: all 1,896 frames to frames/fNNNNN.png using N parallel Chrome pages, each owning a contiguous range.
//   node render/render.mjs [--workers 4] [--start 0] [--end 1895] [--out frames] [--force] [--cpu] [--jpeg]
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { launch, openStudio, captureFrame, warmUp } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const manifest = JSON.parse(fs.readFileSync(new URL('../bible/shots.json', import.meta.url)));
const start = Number(args.start ?? 0), end = Number(args.end ?? manifest.frameCount - 1);
const workers = Number(args.workers || 4);
const outDir = path.resolve(args.out || 'frames');
const type = args.jpeg ? 'jpeg' : 'png';
fs.mkdirSync(outDir, { recursive: true });
const fileFor = f => path.join(outDir, `f${String(f).padStart(5, '0')}.${type}`);

// Split frame range at shot boundaries into `workers` roughly equal chunks so no worker warms up a huge prefix.
const shots = manifest.shots.filter(s => s.end >= start && s.start <= end);
const total = end - start + 1;
const chunks = []; let cur = { a: start, b: start - 1 };
for (const s of shots) {
  const a = Math.max(s.start, start), b = Math.min(s.end, end);
  if (cur.b - cur.a + 1 >= total / workers && chunks.length < workers - 1) { chunks.push(cur); cur = { a, b }; } else cur.b = b;
}
chunks.push(cur);

const t0 = Date.now();
const { server, url } = await startServer(0);
const browser = await launch({ gpu: !args.cpu });
let done = 0, skipped = 0; const errors = [];
await Promise.all(chunks.map(async (c, wi) => {
  const { page, console: con } = await openStudio(browser, url);
  await warmUp(page, c.a);
  for (let f = c.a; f <= c.b; f++) {
    const file = fileFor(f);
    if (!args.force && fs.existsSync(file)) { skipped++; continue; }
    const info = await captureFrame(page, f, file, { type });
    if (info.errors.length) errors.push(`frame ${f}: ${info.errors.join(' | ')}`);
    done++;
    if (done % 48 === 0) {
      const el = (Date.now() - t0) / 1000, rate = done / el;
      console.log(`[w${wi}] ${done + skipped}/${total} frames  ${rate.toFixed(1)} fps  eta ${((total - done - skipped) / rate / 60).toFixed(1)} min`);
    }
  }
  const bad = con.filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (bad.length) errors.push(`[w${wi}] console: ` + bad.slice(0, 5).join(' | '));
  await page.close();
}));
await browser.close(); server.close();
console.log(`rendered ${done}, skipped ${skipped}, in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2); }
