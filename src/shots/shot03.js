// shot03 — Her decision (72 frames)
// Low-angle close-up. Rain beads on the umbrella rim. Yuki looks up at the sky, exhales, then closes the
// umbrella in one motion (pose 'closeUmbrella' from ~24, umbrellaOpen 1→0). Expression calm → determined.
// Lib: characters.createYuki (pose/lookAt/setExpression/umbrellaOpen/update), environments.createRooftop / createCityNight,
//      vfx.createRain / createBokehLights / createSteam, look.createSkyDome / lightingKit
export default {
  id: 'shot03',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, ctx.width / ctx.height, 0.05, 2000);

    const sky = lib.look.createSkyDome({ top: 0x0e0f28, horizon: 0x4a2a5e, bottom: 0x08080f, radius: 1000 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x141632, 0.006);
    const kit = lib.look.lightingKit(scene, 'night-rain');

    const roof = lib.environments.createRooftop(ctx); scene.add(roof.group);
    const city = lib.environments.createCityNight(ctx, { seed: 301, extent: 420 });
    city.group.position.set(0, -46, -24); scene.add(city.group);
    const bokeh = lib.vfx.createBokehLights(ctx, { count: 90, area: [60, 14, 30], center: [0, 6, -70], seed: 302 });
    bokeh.group.scale.setScalar(4); scene.add(bokeh.group);

    // motivated light: city glow from below/behind (magenta + cyan), sodium door lamp camera-left
    const glowM = new THREE.PointLight(0xff3fa4, 5, 14, 1.5); glowM.position.set(2.5, -1.5, -3); scene.add(glowM);
    const glowC = new THREE.PointLight(0x3ff0ff, 3.5, 12, 1.5); glowC.position.set(-2.5, 0.5, -2.5); scene.add(glowC);
    const sodium = new THREE.PointLight(0xffb347, 3, 12, 1.6); sodium.position.set(-3.5, 2.6, 2.0); scene.add(sodium);

    // near rain so the drops read against her hair once the umbrella closes
    const rain = lib.vfx.createRain(ctx, { count: 5000, area: [14, 10, 12], center: [0, 3.5, 0.5], speed: 15, wind: 0.6, seed: 303 });
    scene.add(rain.group);
    const steam = lib.vfx.createSteam(ctx, { seed: 304 }); scene.add(steam.group);   // her exhale

    const yuki = lib.characters.createYuki(ctx, { withUmbrella: true, withBag: true });
    yuki.group.position.set(0, 0, -3.6);
    yuki.group.rotation.y = 0.32;                    // faces camera, slight 3/4
    scene.add(yuki.group);

    // camera: low, looking up at her face; gentle push-in
    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [0.62, 0.88, -2.05], look: [0.05, 1.55, -3.6], fov: 40 },
        { f: N - 1, pos: [0.46, 0.98, -2.32], look: [0.0, 1.58, -3.6], fov: 38 },
      ], ease.inOut)
      .sway(0.006, 0.5);

    const lookTarget = new THREE.Vector3();
    const P_CAM = new THREE.Vector3(0.4, 1.45, 0.5), P_SKY = new THREE.Vector3(0.2, 14, -1.5), P_AHEAD = new THREE.Vector3(0.1, 1.6, 4);
    let exhaled = false;
    return {
      scene, camera, post: 'night-rain',
      update(local) {
        const f = local;
        rig.update(f); kit.update && kit.update(f);
        roof.update(f, f / 24); city.update(f, f / 24); bokeh.update(f); rain.update(f); steam.update(f);
        // gaze: down/aside → up to the sky (4..26) → hold → settle ahead, resolved (44..60)
        const up = ease.seg(f, 4, 26, ease.inOut), ahead = ease.seg(f, 44, 60, ease.inOut);
        lookTarget.lerpVectors(P_CAM, P_SKY, up).lerp(P_AHEAD, ahead);
        yuki.lookAt(lookTarget);
        if (f < 24) yuki.pose('idle', f); else yuki.pose('closeUmbrella', f - 24);
        yuki.umbrellaOpen(1 - ease.seg(f, 26, 50, ease.inOutCubic));
        if (f < 30) yuki.setExpression('calm', 1); else yuki.setExpression('determined', ease.seg(f, 30, 56, ease.inOut));
        yuki.update(f);
        if (f === 16 && !exhaled) { exhaled = true; steam.emit(f, new THREE.Vector3(0.05, 1.42, -3.35)); }
        glowM.intensity = 5 + 1.2 * Math.sin(f * 0.19); glowC.intensity = 3.5 + 0.8 * Math.sin(f * 0.12 + 1);
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
