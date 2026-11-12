// Shared headless-Chrome launcher for preview/render/check.
// Local (Windows, Intel Iris Xe): real GPU through ANGLE/D3D11.
// CI (ubuntu runner, no GPU): SwiftShader. Trap from the cherry-blossoms film: under SwiftShader every shader
// fails to link unless --disable-gpu-compositing is passed (blank frames, "VALIDATE_STATUS false").
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

export function chromePath() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  return undefined;   // fall back to the Chrome that the puppeteer package downloaded
}

export const isCI = !!process.env.CI || process.env.STUDIO_GPU === '0';

export async function launch({ gpu = !isCI } = {}) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio', '--window-size=1920,1080',
    '--force-device-scale-factor=1', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--font-render-hinting=none'];
  if (gpu && process.platform === 'win32') args.push('--enable-gpu', '--use-gl=angle', '--use-angle=d3d11');
  else if (gpu) args.push('--use-gl=angle', '--use-angle=gl');
  else args.push('--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-compositing');
  if (process.env.GL_ARGS) args.push(...process.env.GL_ARGS.split(' '));
  return puppeteer.launch({ executablePath: chromePath(), headless: true, args, protocolTimeout: 600000 });
}

export async function openStudio(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const console_ = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning' || t === 'log') console_.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', e => console_.push('[pageerror] ' + e.message));
  await page.goto(url + (process.env.STUDIO_QUERY || ''), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__studio && window.__studio.ready, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  const gl = await page.evaluate(() => window.__studio.gl);
  const cjk = await page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = '40px "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif'; const w1 = c.measureText('晨光列車').width; c.font = '40px monospace'; return w1 !== c.measureText('晨光列車').width || w1 > 100; });
  if (!cjk) console_.push('[warning] CJK font may be missing (titles would render as tofu)');
  return { page, console: console_, gl };
}

/** decode a screenshot inside the page and sample a 6x4 grid: { uniform, value:[r,g,b] } */
async function sampleImage(page, b64, type) {
  return page.evaluate(async (b64, type) => {
    const img = new Image(); img.src = `data:image/${type === 'jpeg' ? 'jpeg' : 'png'};base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = 96; c.height = 54; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 96, 54);
    let first = null, uniform = true;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const d = g.getImageData(Math.round(96 * (i + 0.5) / 6), Math.round(54 * (j + 0.5) / 4), 1, 1).data; const v = [d[0], d[1], d[2]];
      if (!first) first = v; else if (Math.abs(v[0] - first[0]) + Math.abs(v[1] - first[1]) + Math.abs(v[2] - first[2]) > 6) uniform = false;
    }
    return { uniform, value: first };
  }, b64, type);
}

export async function captureFrame(page, frame, file, { scale = 1, type = 'png', retries = 3 } = {}) {
  let info = await page.evaluate(f => window.__studio.seek(f), frame);
  if (scale !== 1) await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: scale });
  let buf;
  // Runner-only transient: a chunk that starts mid-shot sometimes yields uniformly white frames for a while
  // (seen on SwiftShader in CI, never locally). A uniform all-white/all-black screenshot outside a fade is wrong:
  // wait, rebuild the shot, seek again, up to `retries` times.
  for (let attempt = 0; ; attempt++) {
    buf = await page.screenshot({ type, clip: { x: 0, y: 0, width: 1920, height: 1080 }, omitBackground: false, ...(type === 'jpeg' ? { quality: 92 } : {}) });
    if (attempt >= retries) break;
    const s = await sampleImage(page, Buffer.from(buf).toString('base64'), type);
    const white = s.uniform && s.value[0] > 245 && s.value[1] > 245 && s.value[2] > 245;
    const black = s.uniform && s.value[0] < 3 && s.value[1] < 3 && s.value[2] < 3;
    const shot = await page.evaluate(() => { const c = window.__studio.current; return c ? { id: c.shot.id, local: c.lastLocal, frames: c.shot.frames, fadeIn: c.shot.fadeIn || 0, fadeOut: c.shot.fadeOut || 0 } : null; });
    const inFade = shot && (shot.local < shot.fadeIn + 2 || shot.local > shot.frames - shot.fadeOut - 3);
    if (!(white || black) || inFade || (black && shot && shot.id === 'shot18')) break;
    console.log(`[blank-guard] frame ${frame} (${shot && shot.id} local ${shot && shot.local}) came back uniform ${white ? 'white' : 'black'}; rebuilding (attempt ${attempt + 1})`);
    await new Promise(r => setTimeout(r, 700));
    await page.evaluate(() => window.__studio.reset());
    info = await page.evaluate(f => window.__studio.seek(f), frame);
  }
  fs.writeFileSync(file, buf);
  const errs = await page.evaluate(() => window.__studio.errors.splice(0));
  return { ...info, errors: errs };
}

/** The first composer render after page load is not trustworthy (blank) — render a throwaway frame first. */
export async function warmUp(page, frame) {
  await page.evaluate(f => window.__studio.seek(f), frame);
  await page.evaluate(() => window.__studio.errors.splice(0));
  await page.evaluate(() => window.__studio.reset());
}
