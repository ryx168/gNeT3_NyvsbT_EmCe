// shot13 — Coast reveal (96 frames)
// Track-level camera behind the train as it rounds the cliff; the camera cranes up and the sea opens up, sun low on
// the water, clouds, growing lens flare. post 'coast'.
export default {
  id: 'shot13',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.2, 5000);
    const sp = lib.look.skyPresets.morningSea;
    const sky = lib.look.createSkyDome({ ...sp, radius: 2500, sunDir: [-0.55, 0.22, -0.8], glow: 0.3, sunSize: 0.03, sunIntensity: 1.1 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xcfe9ff, 300, 2200);
    const kit = lib.look.lightingKit(scene, 'coast');

    const coast = lib.environments.createCoast(ctx, { seed: 1301 }); scene.add(coast.group);
    if (coast.sea) coast.sea.visible = false;
    const sea = lib.vfx.createSea(ctx, { size: 4000, seed: 1302, sunDir: [-0.55, 0.22, -0.8], shoreX: -4, foamWidth: 24, waveScale: 3 }); sea.mesh.position.set(-1500, -30, -400); scene.add(sea.group || sea.mesh);
    const rails = lib.environments.createRails(ctx, { length: 800 }); rails.group.position.z = 100; scene.add(rails.group);
    const train = lib.environments.createTrainExterior(ctx, { cars: 5 }); scene.add(train.group);
    const clouds = lib.vfx.createClouds(ctx, { count: 16, center: [-400, 140, -1200], spread: [1800, 40, 400], seed: 1303, sunDir: [-0.55, 0.22, -0.8], size: 2.4 }); scene.add(clouds.group);
    const gulls = lib.vfx.createGulls(ctx, { count: 5, center: [-60, 20, -160], radius: 30, seed: 1304, size: 1.6 }); scene.add(gulls.group);
    const flare = lib.vfx.createLensFlare(ctx, { sun: [-1400, 560, -2000], color: 0xfff0c8, intensity: 0 }); scene.add(flare.group);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [1.2, 1.6, 14], look: [0, 2.2, -60], fov: 34 },
        { f: 30, pos: [0.5, 3.0, 10], look: [-8, 3, -90], fov: 34 },
        { f: N - 1, pos: [-14, 34, -20], look: [-120, 8, -260], fov: 40 },
      ], ease.inOutCubic)
      .sway(0.006, 0.4);

    return {
      scene, camera, post: 'coast',
      update(local) {
        const z = ease.lerp(-6, -290, local / (N - 1));
        train.group.position.set(0, 0.1, z); train.update(local);
        sea.update(local); clouds.update(local); gulls.update(local);
        flare.setIntensity(0.4 * ease.seg(local, 34, 80)); flare.update(local, camera);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
