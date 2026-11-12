// shot01 — Cold open: rain on the window (96 frames)
// Night. Raindrops run down a dark apartment window; neon from the street below smears into bokeh.
// Slow push-in on the pane; Yuki's hand enters from below and touches the glass at ~local 60.
// Lib: look.createSkyDome, look.lightingKit, look.toonMaterial, look.addOutline,
//      vfx.createRainOnGlass, vfx.createBokehLights, vfx.createRain, environments.createCityNight
export default {
  id: 'shot01',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, ctx.width / ctx.height, 0.05, 1500);

    // ---- sky / atmosphere (seen only through the glass)
    const sky = lib.look.createSkyDome({ top: 0x0e0f26, horizon: 0x3b2255, bottom: 0x07070f, radius: 900 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x0d0e1c, 0.04);
    const kit = lib.look.lightingKit(scene, 'night-rain');
    if (kit.key) kit.key.intensity = 0.25;        // the room is dark; neon does the work
    if (kit.hemi) kit.hemi.intensity = 0.25;

    // ---- far city below the window (becomes bokeh-ish through fog)
    const city = lib.environments.createCityNight(ctx, { seed: 101, extent: 260 });
    city.group.position.set(0, -34, -40);
    scene.add(city.group);

    // ---- neon bokeh discs behind the pane + rain outside
    const bokeh = lib.vfx.createBokehLights(ctx, { count: 110, area: [22, 10, 14], center: [0, 0.6, -17], seed: 102 });
    bokeh.group.scale.setScalar(1.4);
    scene.add(bokeh.group);
    const rain = lib.vfx.createRain(ctx, { count: 2500, area: [14, 10, 8], center: [0, 1.5, -4], speed: 13, wind: 0.8, seed: 103 });
    scene.add(rain.group);

    // ---- window: mullions + glass + rain-on-glass quad (fills the frame)
    const PW = 2.6, PH = 1.6, PY = 1.45;
    const win = new THREE.Group();
    const mullion = lib.look.toonMaterial({ color: 0x1b1a26 });
    const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mullion); m.position.set(x, y, 0); win.add(m); };
    bar(PW + 0.3, 0.12, 0, PY + PH / 2 + 0.06); bar(PW + 0.3, 0.12, 0, PY - PH / 2 - 0.06);
    bar(0.12, PH + 0.3, -PW / 2 - 0.06, PY); bar(0.12, PH + 0.3, PW / 2 + 0.06, PY);
    bar(0.05, PH, -0.45, PY);                     // off-centre vertical mullion (thirds)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ color: 0x0a1020, transparent: true, opacity: 0.18, depthWrite: false }));
    glass.position.set(0, PY, -0.01); glass.userData.noOutline = true;
    win.add(glass);
    lib.look.addOutline(win, { thickness: 0.006 });
    scene.add(win);
    const rog = lib.vfx.createRainOnGlass(ctx, { width: PW, height: PH, seed: 104 });
    rog.mesh.position.set(0, PY, 0.012);
    scene.add(rog.mesh);

    // ---- neon spill lighting the hand/mullions from outside; faint warm room fill
    const neonM = new THREE.PointLight(0xff3fa4, 7, 16, 1.6); neonM.position.set(-3.5, 0.6, -4); scene.add(neonM);
    const neonC = new THREE.PointLight(0x3ff0ff, 4.5, 16, 1.6); neonC.position.set(3.2, 2.4, -5); scene.add(neonC);
    const sodium = new THREE.PointLight(0xffb347, 2.5, 12, 1.6); sodium.position.set(0.5, -1.5, -2.5); scene.add(sodium);
    const roomFill = new THREE.PointLight(0xffc9a0, 0.5, 5, 1.5); roomFill.position.set(1.2, 1.0, 1.6); scene.add(roomFill);

    // ---- Yuki's hand (simple local rig: palm, four fingers, thumb, cardigan cuff, forearm)
    const skin = lib.look.toonMaterial({ color: 0xffe9dc });
    const navy = lib.look.toonMaterial({ color: 0x2b3560 });
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.05, 4, 14), skin);
    palm.scale.set(1.75, 1, 0.55); palm.position.set(0, 0.03, 0); hand.add(palm);
    const fingers = [];
    const fingerLen = [0.062, 0.074, 0.07, 0.056], fingerX = [-0.052, -0.018, 0.016, 0.05];
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group(); pivot.position.set(fingerX[i], 0.075, 0);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, fingerLen[i], 4, 10), skin);
      seg.position.y = fingerLen[i] / 2 + 0.01; pivot.add(seg); pivot.rotation.z = (1.5 - i) * -0.05;
      hand.add(pivot); fingers.push(pivot);
    }
    const thumb = new THREE.Group(); thumb.position.set(0.085, 0.02, 0.01);
    const tseg = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 4, 10), skin); tseg.position.y = 0.035; thumb.add(tseg);
    thumb.rotation.z = -0.9; hand.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.08, 14), navy); cuff.position.set(0, -0.07, 0.01); hand.add(cuff);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 14), navy); forearm.position.set(0.02, -0.33, 0.03); forearm.rotation.z = 0.06; hand.add(forearm);
    lib.look.addOutline(hand, { thickness: 0.004 });
    hand.visible = false;
    scene.add(hand);

    // ---- camera: slow push-in on the pane, faint breath of sway
    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [0.06, 1.43, 1.9], look: [0.0, 1.46, 0], fov: 38 },
        { f: N - 1, pos: [0.0, 1.40, 1.38], look: [0.06, 1.40, 0], fov: 36 },
      ], ease.inOut)
      .sway(0.004, 0.45);

    const tmp = new THREE.Vector3();
    return {
      scene, camera, post: 'night-rain',
      update(local) {
        const f = local;
        rig.update(f);
        kit.update && kit.update(f);
        city.update(f, f / 24); bokeh.update(f); rain.update(f); rog.update(f);
        rog.setIntensity && rog.setIntensity(0.85);
        // neon signs breathe / flicker (deterministic)
        neonM.intensity = 6.5 + 1.5 * Math.sin(f * 0.21) + (ease.noise1(f * 0.7, 5) > 0.93 ? -3 : 0);
        neonC.intensity = 4.2 + 0.8 * Math.sin(f * 0.13 + 1.3);
        // hand: enters from below right at ~30, touches the pane at ~60, then rests / traces slowly
        if (f >= 26) {
          hand.visible = true;
          const a = ease.seg(f, 28, 60, ease.inOut);
          const z = ease.lerp(0.95, 0.035, ease.seg(f, 28, 60, ease.outCubic));
          const x = ease.lerp(0.62, 0.21, a) + ease.lerp(0, -0.012, ease.seg(f, 66, N - 1, ease.inOut));
          const y = ease.lerp(0.55, 1.27, a) + ease.lerp(0, -0.05, ease.seg(f, 70, N - 1, ease.inOut));
          hand.position.set(x, y, z);
          const settle = ease.seg(f, 56, 66, ease.outCubic);
          hand.rotation.set(ease.lerp(0.35, 0.0, a), ease.lerp(0.25, 0.0, a), ease.lerp(0.5, 0.08, a));
          const curl = ease.lerp(0.55, 0.0, settle);           // fingers curled on approach, flatten on contact
          fingers.forEach((p, i) => { p.rotation.x = curl * (1 + i * 0.08); p.rotation.z = (1.5 - i) * -0.05 * ease.lerp(0.6, 1.0, settle); });
          thumb.rotation.x = curl * 0.6;
        }
        // tiny neon kick when the palm lands
        if (f >= 60 && f <= 66) sodium.intensity = 2.5 + 2.5 * (1 - (f - 60) / 6); else sodium.intensity = 2.5;
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
