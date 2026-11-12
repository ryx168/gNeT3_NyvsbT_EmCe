// shot02 — Rooftop over the city (96 frames)
// Wide. Yuki at the parapet under a clear umbrella, neon city in the rain below; slow crane down toward her;
// a plane's strobe crosses the sky.
// Lib: environments.createRooftop / createCityNight, characters.createYuki({withUmbrella}),
//      vfx.createRain / createBokehLights, look.createSkyDome / lightingKit / toonMaterial / addOutline
export default {
  id: 'shot02',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.1, 2000);

    const sky = lib.look.createSkyDome({ top: 0x10112c, horizon: 0x4a2a5e, bottom: 0x08080f, radius: 1000 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x141632, 0.0042);
    const kit = lib.look.lightingKit(scene, 'night-rain');

    // ---- the rooftop and the apartment block it sits on
    const roof = lib.environments.createRooftop(ctx);
    scene.add(roof.group);
    const block = new THREE.Mesh(new THREE.BoxGeometry(16, 70, 10), lib.look.toonMaterial({ color: 0x1c1e30, emissive: 0x1a1030, emissiveIntensity: 0.4 }));
    block.position.set(0, -35.4, 0); scene.add(block);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.6), lib.look.toonMaterial({ color: 0x33364a })); hut.position.set(-6, 1.2, 2.2);
    lib.look.addOutline(hut); scene.add(hut);
    const hutLamp = new THREE.PointLight(0xffb347, 6, 16, 1.7); hutLamp.position.set(-4.5, 2.5, 2.4); scene.add(hutLamp);
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); lampBulb.position.copy(hutLamp.position); lampBulb.userData.noOutline = true; scene.add(lampBulb);

    // ---- the city, two depth bands
    const cityNear = lib.environments.createCityNight(ctx, { seed: 201, extent: 420 });
    cityNear.group.position.set(0, -46, -24); scene.add(cityNear.group);
    const cityFar = lib.environments.createCityNight(ctx, { seed: 202, extent: 700 });
    cityFar.group.position.set(60, -62, -300); cityFar.group.scale.set(1.6, 1.3, 1.6); scene.add(cityFar.group);
    const bokeh = lib.vfx.createBokehLights(ctx, { count: 140, area: [70, 10, 40], center: [0, -3, -40], seed: 203 });
    bokeh.group.scale.setScalar(5); scene.add(bokeh.group);
    const neonA = new THREE.PointLight(0xff3fa4, 10, 60, 1.4); neonA.position.set(-18, -6, -22); scene.add(neonA);
    const neonB = new THREE.PointLight(0x3ff0ff, 8, 60, 1.4); neonB.position.set(22, -4, -30); scene.add(neonB);

    // ---- rain volume around the roof
    const rain = lib.vfx.createRain(ctx, { count: 7000, area: [44, 26, 34], center: [0, 8, -6], speed: 16, wind: 1.4, seed: 204 });
    scene.add(rain.group);

    // ---- Yuki at the parapet, back to camera, umbrella up
    const yuki = lib.characters.createYuki(ctx, { withUmbrella: true, withBag: true });
    yuki.group.position.set(2.3, 0, -4.0);
    yuki.group.rotation.y = Math.PI;                 // faces -Z, toward the city
    scene.add(yuki.group);

    // ---- the plane: red strobe + white nav light crossing the sky
    const plane = new THREE.Group();
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4040, fog: false }));
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    nav.position.x = 2.2; strobe.userData.noOutline = nav.userData.noOutline = true;
    plane.add(strobe, nav); scene.add(plane);

    // ---- camera: high wide over the city, slow crane down and in toward her shoulder
    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [-7.5, 11.0, 9.5], look: [3.0, 0.5, -40], fov: 30 },
        { f: N - 1, pos: [-1.0, 2.7, 0.6], look: [2.3, 1.45, -5.0], fov: 34 },
      ], ease.inOutCubic)
      .sway(0.012, 0.35);

    return {
      scene, camera, post: 'night-rain',
      update(local) {
        const f = local;
        rig.update(f); kit.update && kit.update(f);
        roof.update(f, f / 24); cityNear.update(f, f / 24); cityFar.update(f, f / 24); bokeh.update(f); rain.update(f);
        yuki.pose('idle', f); yuki.umbrellaOpen(1); yuki.setExpression('calm', 1); yuki.update(f);
        // distant signs pulse
        neonA.intensity = 9 + 3 * Math.sin(f * 0.17); neonB.intensity = 7 + 2.5 * Math.sin(f * 0.11 + 2);
        hutLamp.intensity = 6 + (ease.noise1(f * 0.9, 7) > 0.9 ? -2.5 : 0);
        // plane crossing left→right, blinking
        const k = f / (N - 1);
        plane.position.set(ease.lerp(-230, 240, k), ease.lerp(72, 96, k), ease.lerp(-270, -330, k));
        strobe.visible = (f % 24) < 4; nav.visible = true;
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
