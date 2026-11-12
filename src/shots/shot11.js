// shot11 — Cherry blossom lane (120 frames)
// Camera beside the track in a lane of sakura. The train passes at ~local 30 along -Z; its wake bursts the petals,
// then the camera drifts slowly with the swirling petals, fov easing wider. post 'sakura'.
export default {
  id: 'shot11',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, ctx.width / ctx.height, 0.1, 1500);
    const sp = lib.look.skyPresets.sakuraMorning;
    const sky = lib.look.createSkyDome({ ...sp, radius: 900, glow: 0.25, horizon: 0xf3d6e4 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xf6dde8, 220, 1100);
    const kit = lib.look.lightingKit(scene, 'sakura', { intensity: 0.65 });

    const lane = lib.environments.createSakuraLane(ctx, { seed: 1101, length: 240 }); lane.group.position.z = 60; scene.add(lane.group);
    const rails = lib.environments.createRails(ctx, { length: 400 }); rails.group.position.z = 80; scene.add(rails.group);
    const train = lib.environments.createTrainExterior(ctx, { cars: 5 }); scene.add(train.group);
    const petals = lib.vfx.createPetals(ctx, { count: 9000, area: [40, 16, 120], center: [0, 6, -30], wind: [0.8, 0, -0.6], seed: 1102, size: 1.1 }); scene.add(petals.group);
    petals.burst(30, [0, 2.5, -4], 18, { strength: 1.4, lift: 1.2 });
    petals.burst(44, [0, 2.5, -40], 22, { strength: 1.0, lift: 0.9 });
    const mist = lib.vfx.createMist(ctx, { area: [120, 300], height: 1.0, center: [0, 0.2, -120], color: 0xfff0f5, seed: 1103, opacity: 0.08 }); scene.add(mist.group);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [3.6, 1.6, 6], look: [-1.5, 2.2, -40], fov: 36 },
        { f: 40, pos: [3.9, 1.7, 4], look: [-0.5, 2.6, -30], fov: 36 },
        { f: N - 1, pos: [5.5, 3.2, -4], look: [-2.0, 4.0, -60], fov: 42 },
      ], ease.inOut)
      .sway(0.01, 0.3)
      .shake(31, 0.03, 10);

    return {
      scene, camera, post: 'sakura',
      update(local) {
        // the train: far up the lane at local 0, nose passes the camera (z≈4) at local 30, gone by ~70
        const z = ease.lerp(-260, 150, ease.seg(local, 0, 84, t => t));
        train.group.position.set(0, 0.1, z);
        if (train.headlights) train.headlights.intensity = 2;
        train.update(local);
        petals.update(local); mist.update(local); lane.update(local);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
