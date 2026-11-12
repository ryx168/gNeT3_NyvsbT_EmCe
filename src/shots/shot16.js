// shot16 — The throw (144 frames)
// Yuki throws the paper plane (release at rig.throwRelease); the camera follows it low and fast over the water,
// sun glints, then cranes up as the plane climbs toward the sun with the flare growing. post 'sunrise'.
export default {
  id: 'shot16',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.1, 4000);
    const sp = lib.look.skyPresets.sunrise;
    const SUN = [-0.45, 0.16, -0.88];
    const sky = lib.look.createSkyDome({ ...sp, radius: 2500, sunDir: SUN, glow: 0.45, sunIntensity: 1.2 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xffd9b0, 200, 1800);
    const kit = lib.look.lightingKit(scene, 'sunrise');

    const beach = lib.environments.createBeach(ctx, { seed: 1601 }); scene.add(beach.group);
    if (beach.sea) beach.sea.visible = false;
    const sea = lib.vfx.createSea(ctx, { size: 4000, seed: 1602, sunDir: SUN, shoreX: -30, foamWidth: 14, waveScale: 2.2, glint: 1.6 }); sea.mesh.position.set(-1500, -0.35, 0); scene.add(sea.group || sea.mesh);
    const clouds = lib.vfx.createClouds(ctx, { count: 12, center: [-500, 120, -1100], spread: [1600, 30, 300], seed: 1603, sunDir: SUN, size: 2.2 }); scene.add(clouds.group);
    const gulls = lib.vfx.createGulls(ctx, { count: 5, center: [-120, 24, -120], radius: 30, seed: 1604, size: 1.6 }); scene.add(gulls.group);
    const flare = lib.vfx.createLensFlare(ctx, { sun: [-1100, 400, -2150], color: 0xffd9a0, intensity: 0 }); scene.add(flare.group);

    const yuki = lib.characters.createYuki(ctx, { withBag: true });
    yuki.group.position.set(-21, 0.25, -6); yuki.group.rotation.y = Math.atan2(-120 + 21, -40 + 6); scene.add(yuki.group);
    yuki.holdPlane(true);
    const plane = lib.vfx.createPaperPlane(ctx, { scale: 1.1 }); plane.group.visible = false; scene.add(plane.group);
    const REL = yuki.throwRelease || 20;
    const hand = new THREE.Vector3();
    const path = lib.vfx.glidePath({ from: [-21.6, 1.45, -6.6], to: [-120, 26, -130], apex: [-60, 9, -50], frames: N - REL - 1, start: REL, wobble: 0.5, bank: 1.2 });
    plane.setPath(path);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [-18.5, 1.5, -2.8], look: [-22, 1.3, -8], fov: 34 },
        { f: REL, pos: [-18.8, 1.45, -3.2], look: [-22.5, 1.45, -8], fov: 34 },
        { f: 60, pos: [-44, 4.5, -32], look: [-64, 9, -56], fov: 36 },
        { f: 110, pos: [-80, 14, -80], look: [-112, 26, -126], fov: 32 },
        { f: N - 1, pos: [-92, 22, -96], look: [-150, 44, -200], fov: 26 },
      ], ease.inOut)
      .sway(0.015, 0.6);

    return {
      scene, camera, post: 'sunrise',
      update(local) {
        yuki.pose('throw', local); yuki.setExpression('smile', 0.5 + 0.5 * ease.seg(local, 20, 50)); yuki.update(local);
        if (local >= REL) { yuki.holdPlane(false); plane.group.visible = true; plane.update(local); }
        sea.update(local); clouds.update(local); gulls.update(local);
        flare.setIntensity(0.15 + 0.45 * ease.seg(local, 40, 130)); flare.update(local, camera);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
