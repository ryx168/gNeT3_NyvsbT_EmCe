// shot12 — The letter (96 frames)
// Over-the-shoulder insert in the train. Yuki reads the letter (local 0–50), then folds it into a paper plane
// (50–110; letter→plane swap at ~80). Petal shadows glide across the paper. post 'interior-dawn'.
export default {
  id: 'shot12',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, ctx.width / ctx.height, 0.05, 800);
    const sky = lib.look.createSkyDome({ top: 0x8fc0ff, horizon: 0xffe0f0, bottom: 0xffc0d0, radius: 600 }); scene.add(sky.mesh);
    scene.fog = new THREE.Fog(0xffe8f0, 6, 80);
    const kit = lib.look.lightingKit(scene, 'interior-dawn', { intensity: 0.6 });

    const car = lib.environments.createTrainInterior(ctx); scene.add(car.group);
    car.setOutside && car.setOutside(0xffd8e8);
    const sun = new THREE.DirectionalLight(0xfff0d0, 0.55); sun.position.set(-6, 3, 2); sun.target.position.set(0, 1, 0); scene.add(sun, sun.target);
    const yuki = lib.characters.createYuki(ctx, { withBag: true });
    yuki.group.position.set(-0.45, 0.47, 0.05); scene.add(yuki.group);
    // petal shadows: dark soft petal-shaped quads gliding across the lap/letter area
    const shadows = []; const shMat = new THREE.MeshBasicMaterial({ color: 0x5a3a50, transparent: true, opacity: 0.22, depthWrite: false });
    const r = ctx.rng(1201);
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.03 + r() * 0.02, 10), shMat); m.scale.set(1, 0.6, 1); m.userData.ph = r() * 10; m.userData.sp = 0.2 + r() * 0.3; m.userData.x = -0.8 + r() * 0.7; m.userData.noOutline = true; scene.add(m); shadows.push(m); }
    const petals = lib.vfx.createPetals(ctx, { count: 400, area: [3, 2.5, 6], center: [-2.8, 1.4, 0], wind: [0.1, 0, -1.2], seed: 1202, size: 0.5 }); scene.add(petals.group);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [0.5, 1.9, 1.35], look: [-0.42, 1.28, 0.45], fov: 30 },
        { f: N - 1, pos: [0.42, 1.84, 1.22], look: [-0.42, 1.26, 0.45], fov: 29 },
      ], ease.inOut)
      .sway(0.004, 0.5);

    return {
      scene, camera, post: 'interior-dawn',
      update(local) {
        if (local < 50) { yuki.pose('readLetter', local); yuki.holdLetter(true); yuki.holdPlane(false); }
        else { yuki.pose('foldPlane', local - 50); const swap = local >= 80; yuki.holdLetter(!swap); yuki.holdPlane(swap); }
        if (local < 40) yuki.setExpression('calm', 1);
        else if (local < 70) yuki.setExpression('sad', 0.6 * ease.seg(local, 40, 55));
        else yuki.setExpression('smile', 0.6 * ease.seg(local, 70, 90));
        yuki.lookAt(null); yuki.update(local);
        shadows.forEach(m => { const s = local / 24 * m.userData.sp + m.userData.ph; m.position.set(m.userData.x + Math.sin(s) * 0.12, 0.98 + Math.sin(s * 0.7) * 0.03, 0.2 + ((s * 0.35) % 0.9) - 0.45); m.rotation.x = -Math.PI / 2 + 0.3; });
        petals.update(local);
        rig.update(local); kit.update && kit.update(local);
      },
    };
  }
};
