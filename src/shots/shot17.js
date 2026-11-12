// shot17 — New day (144 frames)
// Wide sunrise over the sea on a long lens; the plane is a speck against the sun, flare at full, Yuki tiny on the
// beach, gulls. The sky warms over the shot; the engine fades to white at the end. post 'sunrise'.
export default {
  id: 'shot17',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(18, ctx.width / ctx.height, 0.5, 6000);
    const sp = lib.look.skyPresets.sunrise;
    const SUN = new THREE.Vector3(-0.38, 0.12, -0.92).normalize();
    const sky = lib.look.createSkyDome({ ...sp, radius: 3000, sunDir: SUN.toArray(), sunSize: 0.02, glow: 0.18, sunIntensity: 1.1 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xf0cfae, 1500, 7000);
    const kit = lib.look.lightingKit(scene, 'sunrise', { intensity: 0.7 });

    const beach = lib.environments.createBeach(ctx, { seed: 1701 }); scene.add(beach.group);
    if (beach.sea) beach.sea.visible = false;
    const sea = lib.vfx.createSea(ctx, { size: 5000, seed: 1702, sunDir: SUN.toArray(), shoreX: -30, foamWidth: 14, waveScale: 3, glint: 2.0 }); sea.mesh.position.set(-1500, -0.35, 0); scene.add(sea.group || sea.mesh);
    const clouds = lib.vfx.createClouds(ctx, { count: 14, center: [-600, 150, -1600], spread: [2400, 40, 400], seed: 1703, sunDir: SUN.toArray(), size: 3 }); scene.add(clouds.group);
    const gulls = lib.vfx.createGulls(ctx, { count: 6, center: [-200, 40, -300], radius: 50, seed: 1704, size: 2.2 }); scene.add(gulls.group);
    const flare = lib.vfx.createLensFlare(ctx, { sun: SUN.clone().multiplyScalar(2600).toArray(), color: 0xffe2b0, intensity: 1 }); scene.add(flare.group);
    const yuki = lib.characters.createYuki(ctx, { withBag: true }); yuki.group.position.set(-21, -0.23, -6); yuki.group.rotation.y = Math.atan2(-120 + 21, -40 + 6); scene.add(yuki.group);
    const plane = lib.vfx.createPaperPlane(ctx, { scale: 1.6 }); scene.add(plane.group);
    plane.setPath(lib.vfx.glidePath({ from: [-150, 40, -190], to: [-700, 180, -900], frames: N, start: 0, wobble: 0.4, bank: 1 }));

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [40, 6, 60], look: [-300, 40, -800], fov: 20 },
        { f: N - 1, pos: [30, 9, 50], look: [-330, 60, -900], fov: 18 },
      ], ease.inOut)
      .sway(0.01, 0.3);

    return {
      scene, camera, post: 'sunrise',
      update(local) {
        const t = local / (N - 1);
        sky.set({ horizon: new THREE.Color(0xe89a5a).lerp(new THREE.Color(0xf2b882), t).getHex(), bottom: 0x2e6aa8, glow: ease.lerp(0.22, 0.4, t), sunIntensity: ease.lerp(1.1, 1.3, t) });
        sky.update && sky.update(local);
        yuki.pose('idle', local); yuki.setExpression('smile', 0.8); yuki.update(local);
        plane.update(local);
        sea.update(local); clouds.update(local); gulls.update(local);
        flare.setIntensity(0.2 + 0.15 * t); flare.update(local, camera);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
