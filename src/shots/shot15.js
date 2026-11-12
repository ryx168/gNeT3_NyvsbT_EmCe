// shot15 — To the water's edge (120 frames)
// Beach. Yuki walks down the sand toward the foam (local 0–80), stops, takes out the paper plane (~90).
// Low sun, long shadow, handheld sway. post 'coast'.
export default {
  id: 'shot15',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, ctx.width / ctx.height, 0.1, 3000);
    const sp = lib.look.skyPresets.morningSea;
    const sky = lib.look.createSkyDome({ ...sp, radius: 1500, sunDir: [-0.6, 0.18, -0.78], glow: 0.3, sunSize: 0.035, sunIntensity: 1.1 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xdff0ff, 120, 1200);
    const kit = lib.look.lightingKit(scene, 'coast');
    if (kit.key) kit.key.position.set(-60, 18, -78);

    const beach = lib.environments.createBeach(ctx, { seed: 1501 }); scene.add(beach.group);
    if (beach.sea) beach.sea.visible = false;
    const sea = lib.vfx.createSea(ctx, { size: 3000, seed: 1502, sunDir: [-0.6, 0.18, -0.78], shoreX: -30, foamWidth: 14, waveScale: 2.2 }); sea.mesh.position.set(-1500, -0.35, 0); scene.add(sea.group || sea.mesh);
    const gulls = lib.vfx.createGulls(ctx, { count: 4, center: [-70, 18, -60], radius: 26, seed: 1503, size: 1.4 }); scene.add(gulls.group);
    const clouds = lib.vfx.createClouds(ctx, { count: 10, center: [-400, 110, -900], spread: [1400, 30, 300], seed: 1504, sunDir: [-0.6, 0.18, -0.78], size: 2 }); scene.add(clouds.group);
    // long shadow: a dark soft ellipse stretched away from the sun
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x3a3450, transparent: true, opacity: 0.35, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.5, 3.2, 1); shadow.rotation.z = -0.5; shadow.userData.noOutline = true; scene.add(shadow);

    const yuki = lib.characters.createYuki(ctx, { withBag: true }); scene.add(yuki.group);
    const A = new THREE.Vector3(6, 0.0, 2), B = new THREE.Vector3(-21, 0.0, -6);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [12, 2.2, 10], look: [-6, 1.0, -2], fov: 38 },
        { f: 80, pos: [-6, 1.8, 6], look: [-24, 1.0, -6], fov: 36 },
        { f: N - 1, pos: [-12, 1.5, 3.5], look: [-26, 1.2, -6], fov: 34 },
      ], ease.inOut)
      .sway(0.02, 0.5);
    const look = new THREE.Vector3();

    return {
      scene, camera, post: 'coast',
      update(local) {
        const w = ease.seg(local, 0, 80, t => t);
        yuki.group.position.lerpVectors(A, B, w); yuki.group.position.y = yuki.group.position.x * 0.012 + 0.02;
        yuki.group.rotation.y = Math.atan2(B.x - A.x, B.z - A.z);
        if (local < 80) yuki.pose('walk', local); else yuki.pose('idle', local - 80);
        yuki.holdPlane(local >= 90); yuki.holdLetter(false);
        if (local >= 88) { const t = ease.seg(local, 88, 104, ease.inOut); yuki.parts.armR.rotation.x = ease.lerp(0.05, -1.1, t); yuki.parts.arms.R.el.rotation.x = ease.lerp(-0.2, -0.9, t); }
        yuki.setExpression('calm', 1); look.set(-120, 10, -40); yuki.lookAt(local > 70 ? look : null); yuki.update(local);
        shadow.position.set(yuki.group.position.x + 1.4, yuki.group.position.y + 0.02, yuki.group.position.z + 1.0);
        sea.update(local); gulls.update(local); clouds.update(local);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
