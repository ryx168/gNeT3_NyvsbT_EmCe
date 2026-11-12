// shot06 — Bridge over the city (96 frames)
// Exterior wide, slightly high. The lit train crosses the long bridge over the river, heading -Z away from the
// city; towers glitter behind it. Camera slowly cranes up and back while tracking the train.
// Lib: environments.createBridge / createCityNight / createTrainExterior / createRails, vfx.createStars / createBokehLights,
//      look.createSkyDome / lightingKit
export default {
  id: 'shot06',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, ctx.width / ctx.height, 0.5, 3000);

    const sky = lib.look.createSkyDome({ top: 0x0b0c22, horizon: 0x3a2558, bottom: 0x06070f, radius: 1400 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x101533, 0.0032);
    const kit = lib.look.lightingKit(scene, 'night-neon');

    const bridge = lib.environments.createBridge(ctx, { length: 340 }); scene.add(bridge.group);
    const rails = lib.environments.createRails(ctx, { length: 340 }); scene.add(rails.group);
    const city = lib.environments.createCityNight(ctx, { seed: 601, extent: 360 });
    city.group.position.set(0, -25, 360); city.group.scale.set(1, 1.9, 1); scene.add(city.group);
    const city2 = lib.environments.createCityNight(ctx, { seed: 602, extent: 500 });
    city2.group.position.set(-220, -25, 300); city2.group.scale.set(1, 1.5, 1); scene.add(city2.group);
    const stars = lib.vfx.createStars(ctx, { count: 1800, radius: 1200, seed: 603 }); scene.add(stars.group);
    const glitter = lib.vfx.createBokehLights(ctx, { count: 160, area: [90, 14, 50], center: [0, 4, 70], seed: 604 });
    glitter.group.scale.setScalar(5); scene.add(glitter.group);
    const reflect = lib.vfx.createBokehLights(ctx, { count: 90, area: [100, 3, 50], center: [0, -8, 40], seed: 605 });
    reflect.group.scale.set(5, 2.5, 5); scene.add(reflect.group);            // glitter smeared in the river
    const skyGlow = new THREE.PointLight(0xff3fa4, 30, 400, 1.2); skyGlow.position.set(40, 20, 260); scene.add(skyGlow);
    const skyGlow2 = new THREE.PointLight(0x3ff0ff, 22, 400, 1.2); skyGlow2.position.set(-70, 25, 230); scene.add(skyGlow2);

    const train = lib.environments.createTrainExterior(ctx, { cars: 6 });
    scene.add(train.group);
    const cabin = new THREE.PointLight(0xffd9a0, 8, 40, 1.5); cabin.position.set(0, 3, -40); train.group.add(cabin);

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [24, 9, -112], look: [0, 3, -40], fov: 36 },
        { f: N - 1, pos: [44, 36, -158], look: [0, 3, -90], fov: 34 },
      ], ease.inOut);

    const frontZ = f => 12 - 1.45 * f;
    const look = new THREE.Vector3();
    return {
      scene, camera, post: 'night-neon',
      update(local) {
        const f = local;
        rig.update(f);
        // keep the leading cars in frame: track a point a third of the way down the train
        const z = frontZ(f);
        look.set(0, 2.5, ease.lerp(-30, z - 35, ease.seg(f, 0, 50, ease.inOut)));
        camera.lookAt(look);
        kit.update && kit.update(f);
        bridge.update(f, f / 24); city.update(f, f / 24); city2.update(f, f / 24); stars.update(f); glitter.update(f); reflect.update(f);
        train.group.position.z = z; train.update(f, f / 24);
        if (train.headlights) train.headlights.intensity = 6;
        skyGlow.intensity = 28 + 6 * Math.sin(f * 0.15); skyGlow2.intensity = 20 + 5 * Math.sin(f * 0.1 + 1.4);
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
