// Assemble frames/ into out/first_light_express.mp4 with ffmpeg; mux audio/score.wav if present.
//   node render/assemble.mjs [--out out/first_light_express.mp4] [--frames frames] [--jpeg]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const manifest = JSON.parse(fs.readFileSync(new URL('../bible/shots.json', import.meta.url)));
const ext = args.jpeg ? 'jpeg' : 'png';
const framesDir = args.frames || 'frames';
const out = path.resolve(args.out || 'out/first_light_express.mp4');
fs.mkdirSync(path.dirname(out), { recursive: true });

const missing = [];
for (let f = 0; f < manifest.frameCount; f++) if (!fs.existsSync(`${framesDir}/f${String(f).padStart(5, '0')}.${ext}`)) missing.push(f);
if (missing.length) { console.error(`missing ${missing.length} frames, e.g. ${missing.slice(0, 10).join(',')}`); process.exit(1); }

const audio = fs.existsSync('audio/score.wav') ? ['-i', 'audio/score.wav', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
const cmd = ['-y', '-framerate', String(manifest.fps), '-i', `${framesDir}/f%05d.${ext}`, ...audio,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(manifest.fps), out];
console.log('ffmpeg', cmd.join(' '));
const r = spawnSync('ffmpeg', cmd, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=nb_frames,width,height', '-of', 'default=nw=1', out], { encoding: 'utf8' });
console.log(probe.stdout);
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
