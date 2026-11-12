// shot07 — Falling asleep (96 frames, fades out)
// Interior close-up. Her eyes grow heavy (expression 'closed' blended in with two slow blinks);
// the neon outside drains to black countryside; only the carriage lamps glow; she leans her head to the glass.
// Lib: environments.createTrainInterior, characters.createYuki (pose sitIdle/sleep, setExpression 'closed'),
//      vfx.createBokehLights, look.createSkyDome / lightingKit
export default {
  id: 'shot07',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, ctx.width / ctx.height, 0.05, 600);

    const sky = lib.look.createSkyDome({ top: 0x0a0b1e, horizon: 0x2c1b48, bottom: 0x06060d, radius: 500 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x0a0c1a, 0.04);
    const kit = lib.look.lightingKit(scene, 'interior-night');
    if (kit.key) kit.key.intensity = 0.8;

    const car = lib.environments.createTrainInterior(ctx); scene.add(car.group);
    const yuki = lib.characters.createYuki(ctx, { withBag: true });
    yuki.group.position.set(-0.45, 0.47, 0.05);
    scene.add(yuki.group);

    // outside: neon still streaming at first, then nothing
    const LOOP = 70; const r = ctx.rng(701);
    const outside = new THREE.Group(); scene.add(outside);
    const strips = [];
    for (let i = 0; i < 90; i++) {
      const h = 0.3 + r() * 2.0, w = 0.1 + r() * 0.3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: [0xff3fa4, 0x3ff0ff, 0xffb347, 0xfff1d6][i % 4], transparent: true, opacity: 0.6 + r() * 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.y = Math.PI / 2; m.userData.noOutline = true; m.userData.op = m.material.opacity;
      m.position.set(-2.6 - r() * 6, 0.3 + r() * 3, 0); m.userData.z0 = r() * LOOP; m.scale.x = 7;
      outside.add(m); strips.push(m);
    }
    const bokehWrap = new THREE.Group(); outside.add(bokehWrap);
    const bokeh = lib.vfx.createBokehLights(ctx, { count: 40, area: [4, 3, LOOP], center: [-6.5, 1.8, 0], seed: 702 });
    bokehWrap.add(bokeh.group);
    const discs = bokeh.group.children.slice(); discs.forEach(m => { m.userData.z0 = m.position.z; m.rotation.y = Math.PI / 2; });
    const spill = new THREE.PointLight(0xff6fcf, 2, 6, 1.6); spill.position.set(-2.3, 1.8, 0.3); scene.add(spill);
    const lampWarm = new THREE.PointLight(0xffe2b8, 1.4, 4, 1.5); lampWarm.position.set(0.3, 2.3, 0.4); scene.add(lampWarm);
    const windowMat = car.windowMesh && car.windowMesh.material;
    const winCol0 = windowMat && windowMat.color ? windowMat.color.clone() : null;
    const winCol1 = new THREE.Color(0x04050a);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [0.46, 1.98, 1.0], look: [-0.38, 1.9, 0.04], fov: 32 },
        { f: N - 1, pos: [0.32, 1.93, 0.8], look: [-0.42, 1.85, 0.0], fov: 30 },
      ], ease.inOut)
      .sway(0.006, 0.5);

    const P_OUT = new THREE.Vector3(-8, 1.6, -3), P_DOWN = new THREE.Vector3(-3, 0.9, -1);
    const look = new THREE.Vector3();
    return {
      scene, camera, post: 'interior-night',
      update(local) {
        const f = local;
        rig.update(f);
        camera.position.y += Math.sin(f * 0.9) * 0.0015 + Math.sin(f * 2.3) * 0.0006;
        kit.update && kit.update(f); car.update(f, f / 24);
        // eyes: heavy (10..40), two long blinks, then closed by 75
        let closed = Math.max(0.35 * ease.seg(f, 10, 40), ease.seg(f, 46, 75, ease.inOut));
        const blink = (c, w) => Math.max(0, 1 - Math.abs(f - c) / w);
        closed = Math.max(closed, blink(30, 5) * 0.95, blink(42, 6));
        yuki.setExpression('closed', closed);
        // head sinks toward the glass from ~50 (rig pose + a gentle whole-body lean as fallback)
        const rest = ease.seg(f, 50, 86, ease.inOut);
        if (f < 50) yuki.pose('sitIdle', f); else yuki.pose('sleep', f - 50, { blend: rest });
        yuki.group.rotation.z = 0.11 * rest; yuki.group.position.x = -0.45 - 0.06 * rest;
        look.lerpVectors(P_OUT, P_DOWN, ease.seg(f, 20, 60, ease.inOut));
        yuki.lookAt(rest > 0.98 ? null : look);
        yuki.update(f);
        // the city thins out, then dark fields: strips fade, bokeh collapses, spill dies, window goes black
        const d = f * 1.25, fade = 1 - ease.seg(f, 18, 62, ease.inOut);
        for (const m of strips) { m.position.z = ((m.userData.z0 + d) % LOOP) - LOOP / 2; m.material.opacity = m.userData.op * fade; }
        bokeh.update(f);
        for (const m of discs) m.position.z = ((m.userData.z0 + d + LOOP) % LOOP) - LOOP / 2;
        bokehWrap.scale.y = Math.max(0.001, fade);
        spill.intensity = (1.6 + 1.2 * Math.max(0, Math.sin(d * 0.8))) * fade;
        if (winCol0) windowMat.color.lerpColors(winCol0, winCol1, 1 - fade);
        if (car.lamps) car.lamps.forEach((l, i) => { l.intensity = 1.2 + 0.06 * Math.sin(f * 0.7 + i); });
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
