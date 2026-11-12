// shot09 — Mountain dawn (96 frames)
// Epic wide. Layered ridges, sky turning from indigo to gold, the sun breaking over a ridge in god rays, clouds
// catching gold underneath, mist in the valley, the train a tiny lit thread moving along the valley floor.
// Camera: very slow crane down + push, fov 30 -> 28, ease.inOut. post 'dawn'.
export default {
  id: 'shot09',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.5, 6000);

    const sp = lib.look.skyPresets;
    const sky = lib.look.createSkyDome({ ...sp.blueHour, radius: 2500 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xe8a898, 400, 1800);
    const kit = lib.look.lightingKit(scene, 'dawn');

    const mts = lib.environments.createMountains(ctx, { seed: 901 }); scene.add(mts.group);
    const mist = lib.vfx.createMist(ctx, { area: [900, 700], height: 6, center: [0, 4, -300], color: 0xf2d0d8, seed: 902, layers: 5, opacity: 0.5 }); scene.add(mist.group);
    const clouds = lib.vfx.createClouds(ctx, { count: 14, center: [-100, 170, -900], spread: [1400, 50, 300], seed: 903, sunDir: [-0.6, 0.15, -0.7], size: 2.2 }); scene.add(clouds.group);
    const rays = lib.vfx.createGodRays(ctx, { origin: [-560, 150, -760], color: 0xffe3a0, count: 14, seed: 904, direction: [0.55, -0.22, 0.8], length: 900, spread: 0.45, width: 40, intensity: 0 }); scene.add(rays.group);
    const flare = lib.vfx.createLensFlare(ctx, { sun: [-1700, 420, -2200], color: 0xffd9a0, intensity: 0 }); scene.add(flare.group);

    // the train: a tiny lit thread along the valley floor, moving left to right across the frame
    const train = lib.environments.createTrainExterior(ctx, { cars: 6 }); train.group.scale.setScalar(0.9);
    train.group.rotation.y = Math.PI / 2 + 0.35;                       // travelling along +X-ish
    scene.add(train.group);
    const rails = lib.environments.createRails(ctx, { length: 900 }); rails.group.rotation.y = Math.PI / 2 + 0.35; rails.group.position.set(380, 0.1, -60); scene.add(rails.group);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [260, 190, 520], look: [-260, 120, -700], fov: 34 },
        { f: N - 1, pos: [200, 150, 470], look: [-300, 110, -720], fov: 31 },
      ], ease.inOut)
      .sway(0.0, 1);

    const sunDir = new THREE.Vector3();
    return {
      scene, camera, post: 'dawn',
      update(local) {
        const t = ease.seg(local, 0, N - 1, ease.inOut);
        // sky: blue hour -> dawn; sun climbs over the ridge
        const a = sp.blueHour, b = sp.mountainDawn;
        const mix = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), t).getHex();
        sunDir.set(ease.lerp(-0.82, -0.7, t), ease.lerp(0.02, 0.16, t), ease.lerp(-0.55, -0.68, t)).normalize();
        sky.set({ top: mix(a.top, b.top), horizon: mix(a.horizon, b.horizon), bottom: mix(a.bottom, b.bottom), sunDir: [sunDir.x, sunDir.y, sunDir.z], sunColor: b.sunColor, sunSize: ease.lerp(0.02, 0.045, t), glow: ease.lerp(0.4, 1.0, t), haze: ease.lerp(0.5, 0.75, t), hazeColor: mix(a.hazeColor, b.hazeColor), stars: ease.lerp(0.35, 0, ease.seg(local, 0, 40)) });
        sky.update && sky.update(local);
        scene.fog.color.set(mix(0xb59ab8, 0xf2c9a0));
        if (kit.key) { kit.key.position.copy(sunDir).multiplyScalar(500); kit.key.intensity = ease.lerp(1.2, 3.4, t); kit.key.color.set(mix(0xffb0a0, 0xfff0c0)); }
        rays.setIntensity(ease.seg(local, 18, 70, ease.inOut) * 0.9); rays.update(local);
        flare.setIntensity(ease.seg(local, 30, 80) * 0.5); flare.update(local, camera);
        clouds.setSun && clouds.setSun([sunDir.x, sunDir.y, sunDir.z]); clouds.update(local);
        mist.update(local);
        const tz = ease.lerp(-420, 20, local / (N - 1));
        train.group.position.set(tz * Math.cos(0.35) + 380, 0.1, -60 + tz * Math.sin(0.35)); train.group.position.x = -tz * Math.cos(0.35); train.group.position.z = -60 - tz * Math.sin(0.35) * 0 - 60 + 60; train.group.position.set(-tz * 0.94 + 60, 0.1, -60 - tz * 0.34);
        if (train.headlights) train.headlights.intensity = 8;
        train.update(local);
        rig.update(local); kit.update && kit.update(local);
      },
      dispose() {},
    };
  }
};
