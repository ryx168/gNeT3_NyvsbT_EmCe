// shot10: Waking in sunlight (96 frames)
// Interior. A bar of golden light sweeps across Yuki's face as the train turns; she wakes, blinks, and sits up.
// Window frames and passing poles strobe gently across her.
//
// Camera plan: 34 mm-ish three-quarter close-up from the aisle side (+X), window behind her on -X.
// Slow dolly-in over the whole shot, tiny breathing sway. Look target half-tracks her head so the sit-up
// still reads as her rising in frame.
// Timeline (local): 0-30 asleep; 10-50 light bar sweeps -Z -> +Z across her face; 30+ 'wake'; eyes
// closed -> calm (38-52) -> small smile (70-85); from 55 she turns to the window.

export default {
  id: 'shot10',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const F = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.05, 1500);

    // ---- sky / fog (dawn gold outside the window) --------------------------------------------
    const SKY = { top: 0x8fc0ff, horizon: 0xffd9a8, bottom: 0xffb07a };
    const sky = lib.look.createSkyDome({ ...SKY, radius: 800 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(SKY.horizon, 4, 70);

    // ---- set ----------------------------------------------------------------------------------
    const env = lib.environments.createTrainInterior(ctx); scene.add(env.group);
    const win = env.windowMesh ? env.windowMesh.position.clone() : new THREE.Vector3(-0.9, 1.3, 0);
    const wx = win.x;

    // ---- lighting -----------------------------------------------------------------------------
    const kit = lib.look.lightingKit(scene, 'interior-dawn');
    if (kit.hemi) { kit.hemi.intensity = 0.45; kit.hemi.color.set(0xcfd6ff); kit.hemi.groundColor.set(0x5a4a4a); }
    if (kit.key) { kit.key.color.set(0xffd9a0); kit.key.intensity = 0.35; kit.key.position.set(wx - 6, 3.4, 2.5); }
    if (kit.fill) { kit.fill.intensity = 0.25; kit.fill.position.set(3, 2.5, 2); }
    if (kit.rim) { kit.rim.intensity = 0.4; kit.rim.position.set(1, 3, -4); }

    // ---- Yuki, asleep against the window -------------------------------------------------------
    const yuki = lib.characters.createYuki(ctx, { withBag: true });
    yuki.group.position.set(-0.72, 0, 0);
    yuki.group.rotation.y = 0.12;               // leaning a touch toward the glass
    scene.add(yuki.group);
    yuki.pose('sleep', 0); yuki.setExpression('closed', 1); yuki.update(0);
    yuki.group.updateMatrixWorld(true);
    const _v = new THREE.Vector3();
    const headPos = () => (yuki.parts.head ? yuki.parts.head.getWorldPosition(_v) : _v.set(-0.72, 1.47, 0)).clone();
    const head0 = headPos();
    const hx = head0.x, hy = head0.y, hz = head0.z;

    // ---- the sweeping light bar: lib sweep + a moving emissive bar outside the glass + spot ------
    const sweep = lib.vfx.createLightSweep(ctx, { color: 0xffd27a });
    if (sweep.group) scene.add(sweep.group);
    if (sweep.light && sweep.light.target) { sweep.light.target.position.set(hx, hy, hz); scene.add(sweep.light.target); }
    if (sweep.setSweep) sweep.setSweep(10, 50);

    const barGroup = new THREE.Group();
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.6), barMat); bar.userData.noOutline = true;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.2), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
    halo.userData.noOutline = true; halo.position.x = -0.05;
    barGroup.add(bar, halo); barGroup.rotation.y = Math.PI / 2; barGroup.position.set(wx - 1.3, hy, hz - 3);
    scene.add(barGroup);

    const spot = new THREE.SpotLight(0xffd27a, 0, 14, 0.42, 0.8, 0.5);
    spot.position.set(wx - 0.5, hy + 0.3, hz); spot.target.position.set(hx, hy - 0.05, hz);
    scene.add(spot, spot.target);

    // ---- outside: ground, far hedges, passing poles ----------------------------------------------
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lib.look.toonMaterial({ color: 0x9fb06a }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(wx - 60, -1.6, 0); ground.userData.noOutline = true; scene.add(ground);
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 400), lib.look.toonMaterial({ color: 0xe8a7bd }));
    hedge.position.set(wx - 14, -0.8, 0); scene.add(hedge);

    const POLES = 10, POLE_GAP = 3.2, POLE_SPEED = 0.42;   // m/frame; scenery slides +Z (train runs -Z)
    const poleGeo = new THREE.BoxGeometry(0.14, 3.4, 0.14);
    const poleMat = lib.look.toonMaterial({ color: 0x3a3430 });
    const poles = [];
    for (let i = 0; i < POLES; i++) { const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(wx - 2.6, 0.2, 0); scene.add(p); poles.push(p); }
    // pole shadows inside the cabin: thin dark strips between the camera and Yuki, same z as the poles
    const stripGeo = new THREE.PlaneGeometry(0.2, 2.6);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x3a2440, transparent: true, opacity: 0.12, depthWrite: false });
    const strips = [];
    for (let i = 0; i < POLES; i++) { const s = new THREE.Mesh(stripGeo, stripMat); s.userData.noOutline = true; s.position.set(hx + 0.3, hy - 0.3, 0); s.renderOrder = 5; scene.add(s); strips.push(s); }

    // ---- camera -------------------------------------------------------------------------------
    const rig = ctx.camrig(camera).sway(0.006, 0.7);
    const keys = (H) => [
      { f: 0,     pos: [hx + 0.98, hy - 0.04, hz + 1.62], look: [H.x - 0.12, H.y - 0.12, H.z], fov: 34 },
      { f: F - 1, pos: [hx + 0.80, hy - 0.02, hz + 1.30], look: [H.x - 0.08, H.y - 0.06, H.z], fov: 32, ease: ease.inOut },
    ];
    const lookTarget = new THREE.Vector3(hx - 3, hy + 0.5, hz + 1.2);

    function update(local) {
      // -- performance
      if (local < 30) yuki.pose('sleep', local); else yuki.pose('wake', local - 30);
      if (local < 38) yuki.setExpression('closed', 1);
      else if (local < 52) yuki.setExpression('calm', ease.seg(local, 38, 52));
      else if (local < 70) yuki.setExpression('calm', 1);
      else yuki.setExpression('smile', 0.7 * ease.seg(local, 70, 85));
      yuki.lookAt(local >= 55 ? lookTarget : null);
      yuki.update(local);

      // -- light bar sweep (local 10-50), then the cabin stays warm
      const u = ease.seg(local, 10, 50, ease.inOut);
      const bz = hz - 2.6 + 5.2 * u;
      barGroup.position.z = bz;
      const on = ease.seg(local, 8, 16, ease.outQuad) * (1 - 0.72 * ease.seg(local, 46, 62, ease.inOut));
      barMat.opacity = 0.95 * Math.min(1, on * 1.3);
      spot.intensity = 14 * on;
      spot.position.z = bz; spot.target.position.z = hz + (bz - hz) * 0.55;
      sweep.update && sweep.update(local);
      const warm = ease.seg(local, 40, 72, ease.inOut);
      if (kit.key) kit.key.intensity = 0.35 + 1.05 * warm;
      if (kit.hemi) kit.hemi.intensity = 0.45 + 0.25 * warm;

      // -- passing poles + their strobing shadows
      let dip = 0;
      const span = POLES * POLE_GAP;
      for (let i = 0; i < POLES; i++) {
        const z = (((i * POLE_GAP + local * POLE_SPEED) % span) + span) % span - span / 2 + hz;
        poles[i].position.z = z; strips[i].position.z = z;
        dip = Math.max(dip, 1 - Math.min(1, Math.abs(z - hz) / 0.5));
      }
      stripMat.opacity = 0.12 + 0.2 * warm;
      if (kit.key) kit.key.intensity *= 1 - 0.3 * dip;
      spot.intensity *= 1 - 0.35 * dip;

      // -- camera: half-track the head as she sits up
      const H = headPos().lerp(head0, 0.5);
      rig.keys(keys(H));
      rig.update(local);
      for (const s of strips) s.lookAt(camera.position);   // billboard the shadow bands toward the lens
      kit.update && kit.update(local); env.update && env.update(local, local / ctx.fps);
    }

    function dispose() {
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); });
    }
    return { scene, camera, post: 'interior-dawn', update, dispose };
  }
};
