// shot14 — Seaside station (96 frames)
// The train stands at a tiny seaside platform. Yuki steps down (local 10–46), stands with her hair in the wind,
// gulls overhead; the train pulls away from local 60. post 'coast'.
export default {
  id: 'shot14',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, ctx.width / ctx.height, 0.1, 3000);
    const sp = lib.look.skyPresets.morningSea;
    const sky = lib.look.createSkyDome({ ...sp, radius: 1500, sunDir: [-0.5, 0.3, -0.8], glow: 0.35, sunIntensity: 1.1 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xd8eeff, 80, 900);
    const kit = lib.look.lightingKit(scene, 'coast', { intensity: 0.7 });

    const station = lib.environments.createSeasideStation(ctx, { seed: 1401 }); scene.add(station.group);
    const rails = lib.environments.createRails(ctx, { length: 600 }); rails.group.position.set(-3.5, -1.0, 200); scene.add(rails.group);
    const sea = lib.vfx.createSea(ctx, { size: 3000, seed: 1402, sunDir: [-0.5, 0.3, -0.8], shoreX: -24, foamWidth: 10, waveScale: 2.5, glint: 0.4 }); sea.mesh.position.set(-1500, -1.3, 0); scene.add(sea.group || sea.mesh);
    const train = lib.environments.createTrainExterior(ctx, { cars: 3 }); train.group.position.set(-3.5, -1.0, 9); scene.add(train.group);
    const gulls = lib.vfx.createGulls(ctx, { count: 7, center: [-10, 12, -14], radius: 14, seed: 1403, size: 1.1 }); scene.add(gulls.group);
    const clouds = lib.vfx.createClouds(ctx, { count: 10, center: [-300, 120, -800], spread: [1200, 30, 300], seed: 1404, sunDir: [-0.5, 0.3, -0.8], size: 1.8 }); scene.add(clouds.group);

    const yuki = lib.characters.createYuki(ctx, { withBag: true });
    scene.add(yuki.group);
    const DOOR = new THREE.Vector3(-1.9, 0.0, 4.5), LAND = new THREE.Vector3(0.6, 0, 3.4);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [4.6, 1.5, -5.5], look: [-1.0, 1.1, 5.0], fov: 35 },
        { f: 50, pos: [4.2, 1.45, -3.5], look: [0.3, 1.2, 3.6], fov: 35 },
        { f: N - 1, pos: [3.4, 1.4, -1.0], look: [0.4, 1.15, 3.2], fov: 33 },
      ], ease.inOut)
      .sway(0.006, 0.4);
    const look = new THREE.Vector3();

    return {
      scene, camera, post: 'coast',
      update(local) {
        train.setDoors && train.setDoors(local < 60 ? 1 : 1 - ease.seg(local, 60, 72));
        const away = ease.seg(local, 60, N - 1, ease.inQuad);
        train.group.position.z = 9 - away * 140; train.update(local);
        // Yuki: in the doorway, steps down to the platform 10–46, then stands facing the sea
        if (local < 10) { yuki.pose('idle', local); yuki.group.position.copy(DOOR).setY(0.35); yuki.group.rotation.y = Math.PI / 2; }
        else if (local < 46) { const t = ease.seg(local, 10, 46, ease.inOut); yuki.pose('stepDown', local - 10); yuki.group.position.lerpVectors(DOOR, LAND, t); yuki.group.position.y = 0.35 * (1 - ease.seg(local, 10, 36)); yuki.group.rotation.y = Math.PI / 2 - 0.4 * t; }
        else { yuki.pose('idle', local); yuki.group.position.copy(LAND); yuki.group.rotation.y = ease.lerp(Math.PI / 2 - 0.4, -Math.PI * 0.72, ease.seg(local, 50, 80, ease.inOut)); }
        yuki.setExpression(local < 60 ? 'calm' : 'smile', local < 60 ? 1 : 0.7 * ease.seg(local, 60, 80));
        look.set(-40, 6 + Math.sin(local * 0.1) * 2, -20);
        yuki.lookAt(local > 50 ? look : null); yuki.update(local);
        sea.update(local); gulls.update(local); clouds.update(local);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
