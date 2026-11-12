// shot05 — Window seat (96 frames)
// Train interior. Yuki sits by the window, bag on her lap. City light streaks past as the train accelerates;
// subtle handheld sway + rail rumble.
// Lib: environments.createTrainInterior, characters.createYuki (pose sit/sitIdle, lookAt), vfx.createBokehLights,
//      look.createSkyDome / lightingKit / toonMaterial
export default {
  id: 'shot05',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, ctx.width / ctx.height, 0.05, 800);

    const sky = lib.look.createSkyDome({ top: 0x0a0b1e, horizon: 0x2c1b48, bottom: 0x06060d, radius: 700 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x0a0c1a, 0.035);
    const kit = lib.look.lightingKit(scene, 'interior-night');
    if (kit.key) kit.key.intensity = 0.9;

    const car = lib.environments.createTrainInterior(ctx); scene.add(car.group);

    // ---- Yuki on the seat, facing forward (+Z), head turned to the window
    const yuki = lib.characters.createYuki(ctx, { withBag: true });
    yuki.group.position.set(-0.45, 0.47, 0.05);
    scene.add(yuki.group);

    // ---- the city sliding past the window: neon strips + bokeh on a wrapping loop, accelerating
    const LOOP = 90;
    const r = ctx.rng(501);
    const outside = new THREE.Group(); scene.add(outside);
    const cols = [0xff3fa4, 0x3ff0ff, 0xffb347, 0xfff1d6, 0xff6fcf];
    const strips = [];
    for (let i = 0; i < 260; i++) {
      const h = 0.3 + r() * 2.2, w = 0.04 + r() * 0.12;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0.3 + r() * 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.y = Math.PI / 2; m.userData.noOutline = true;
      m.position.set(-5 - r() * 9, 0.2 + r() * 3.2, 0);
      m.userData.z0 = r() * LOOP;
      outside.add(m); strips.push(m);
    }
    const bokeh = lib.vfx.createBokehLights(ctx, { count: 60, area: [5, 4, LOOP], center: [-7, 1.8, 0], seed: 502 });
    outside.add(bokeh.group);
    const bokehDiscs = bokeh.group.children.slice();
    bokehDiscs.forEach(m => { m.userData.z0 = m.position.z; m.rotation.y = Math.PI / 2; });
    // flickering neon spill through the window onto her face
    const spill = new THREE.PointLight(0xff6fcf, 2, 6, 1.6); spill.position.set(-2.4, 1.7, 0.2); scene.add(spill);
    const spillC = new THREE.PointLight(0x3ff0ff, 1.2, 6, 1.6); spillC.position.set(-2.4, 1.2, -1.5); scene.add(spillC);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [0.98, 1.46, 1.75], look: [-0.5, 1.46, 0.08], fov: 36 },
        { f: N - 1, pos: [0.62, 1.42, 1.28], look: [-0.62, 1.47, -0.05], fov: 34 },
      ], ease.inOut)
      .sway(0.012, 0.6);

    const dist = f => 1.7 * (N / 3) * Math.pow(f / N, 3);            // integral of v = 1.7 (f/N)^2  (m per frame)
    const vel = f => 1.7 * Math.pow(f / N, 2);
    const P_OUT = new THREE.Vector3(-8, 1.9, -5);
    return {
      scene, camera, post: 'interior-night',
      update(local) {
        const f = local;
        rig.update(f);
        camera.position.y += Math.sin(f * 0.9) * 0.002 * ease.seg(f, 10, 60) + Math.sin(f * 2.3) * 0.0008;   // rail rumble
        kit.update && kit.update(f); car.update(f, f / 24);
        yuki.pose(f < 8 ? 'sit' : 'sitIdle', f); yuki.lookAt(P_OUT); yuki.setExpression('calm', 1); yuki.update(f);
        const d = dist(f), v = vel(f), smear = Math.min(2.5, 1 + v * 1.8);   // capped: a 4 m-wide streak would strobe the whole pane
        for (const m of strips) { m.position.z = ((m.userData.z0 + d) % LOOP) - LOOP / 2; m.scale.x = smear; }
        bokeh.update(f);
        for (const m of bokehDiscs) { m.position.z = ((m.userData.z0 + d + LOOP) % LOOP) - LOOP / 2; m.scale.x = 1 + v * 3; }
        spill.intensity = 1.6 + 1.4 * Math.max(0, Math.sin(d * 0.9)) * (0.4 + v);
        spillC.intensity = 1.0 + 1.0 * Math.max(0, Math.sin(d * 0.6 + 2)) * (0.4 + v);
        if (car.lamps) car.lamps.forEach((l, i) => { l.intensity = 1.2 + 0.08 * Math.sin(f * 0.7 + i); });
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
