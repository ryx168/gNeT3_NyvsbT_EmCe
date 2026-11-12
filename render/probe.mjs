// Print world positions of Yuki's parts (and the camera) at a frame — for placing cameras precisely.
//   node render/probe.mjs --frame 1100
import { startServer } from './serve.mjs'; import { launch, openStudio } from './browser.mjs';
const frame = Number(process.argv[process.argv.indexOf('--frame') + 1] || 0);
const { server, url } = await startServer(0); const browser = await launch(); const { page } = await openStudio(browser, url);
await page.evaluate(f => window.__studio.seek(f), frame);
const out = await page.evaluate(() => {
  const inst = window.__studio.current.inst; const res = { camera: inst.camera.position.toArray().map(v => +v.toFixed(2)) };
  inst.scene.traverse(o => { if (o.name === 'yuki') { o.updateMatrixWorld(true); const V = new (o.position.constructor)(); const parts = {};
    o.traverse(p => { if (p.isMesh && p.geometry && p.geometry.type === 'SphereGeometry' && p.scale.x === 0.8) parts['hand' + (p.getWorldPosition(V).x > o.getWorldPosition(new V.constructor()).x ? 'L' : 'R')] = V.toArray().map(v => +v.toFixed(2)); });
    res.yuki = o.getWorldPosition(V).toArray().map(v => +v.toFixed(2)); res.parts = parts;
    const head = o.getObjectByName ? null : null; } });
  return res;
});
console.log(JSON.stringify(out));
await browser.close(); server.close();
