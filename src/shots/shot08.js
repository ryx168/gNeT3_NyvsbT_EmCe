// shot08 — Out of the tunnel (120 frames, fades in)
// Blue hour. The camera waits beside the portal; the train bursts out at ~15 and the camera picks up speed to
// track alongside at window height over misted rice fields; faint speed lines. Sky indigo bleeding to rose.
// Lib: environments.createCountryside / createTrainExterior / createRails, vfx.createMist / createSpeedLines,
//      look.createSkyDome / lightingKit / toonMaterial
export default {
  id: 'shot08',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.1, 2500);
    scene.add(camera);                                                  // camera-attached vfx

    const sky = lib.look.createSkyDome({ top: 0x1a1b3a, horizon: 0xe9a0b8, bottom: 0x2a3350, radius: 1500 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x5a5a8a, 0.0055);
    const kit = lib.look.lightingKit(scene, 'blue-hour');

    const land = lib.environments.createCountryside(ctx, { seed: 801 }); scene.add(land.group);
    const rails = lib.environments.createRails(ctx, { length: 700 }); rails.group.position.z = 60; scene.add(rails.group);
    const mistA = lib.vfx.createMist(ctx, { area: [320, 420], height: 2.6, center: [0, 0.9, -160], color: 0xc9d6ff, seed: 802 }); scene.add(mistA.group);
    const mistB = lib.vfx.createMist(ctx, { area: [160, 300], height: 1.6, center: [70, 0.5, -120], color: 0xe6d0e8, seed: 803 }); scene.add(mistB.group);

    // tunnel bore + portal face (local; guarantees the dark-to-light reveal whatever the set provides)
    const rock = lib.look.toonMaterial({ color: 0x0a0b12, side: THREE.BackSide });
    const bore = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 140, 24, 1, true), rock);
    bore.rotation.x = Math.PI / 2; bore.position.set(0, 3.2, 18 + 70); bore.userData.noOutline = true; scene.add(bore);
    const face = new THREE.Shape(); face.moveTo(-60, -2); face.lineTo(60, -2); face.lineTo(60, 34); face.lineTo(-60, 34); face.lineTo(-60, -2);
    const hole = new THREE.Path(); hole.absarc(0, 3.2, 5.6, 0, Math.PI * 2, false); face.holes.push(hole);
    const portal = new THREE.Mesh(new THREE.ShapeGeometry(face, 24), lib.look.toonMaterial({ color: 0x252a3c }));
    portal.position.z = 18; portal.rotation.y = Math.PI; portal.userData.noOutline = true; scene.add(portal);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), lib.look.toonMaterial({ color: 0x1f2a3a }));
    hill.position.set(0, -20, 90); hill.scale.set(1.6, 0.8, 1); hill.userData.noOutline = true; scene.add(hill);

    const train = lib.environments.createTrainExterior(ctx, { cars: 5 }); scene.add(train.group);
    const glow = new THREE.PointLight(0xffd9a0, 10, 30, 1.6); glow.position.set(0, 2.6, -8); train.group.add(glow);
    const speed = lib.vfx.createSpeedLines(ctx, { seed: 804 });
    if (speed.mesh) { speed.mesh.position.z = -1; camera.add(speed.mesh); }

    const rig = ctx.camrig(camera).keys([{ f: 0, pos: [9.5, 2.3, 8], look: [0, 2.8, 20], fov: 34 }]).sway(0.015, 0.7);
    const frontZ = f => 36 - 1.15 * f;
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    const H0 = new THREE.Color(0xe9a0b8), H1 = new THREE.Color(0xf2b4bc), hz = new THREE.Color();
    return {
      scene, camera, post: 'blue-hour',
      update(local) {
        const f = local;
        const z = frontZ(f);
        train.group.position.z = z; train.update(f, f / 24);
        if (train.headlights) train.headlights.intensity = 6;
        // camera: parked by the portal, then accelerates to run alongside the first car at window height
        const catchUp = ease.seg(f, 10, 46, ease.inOut);
        const camZ = ease.lerp(8, z - 10, catchUp);
        const camY = 2.3 + 0.7 * ease.seg(f, 50, N - 1, ease.inOut);
        pos.set(9.5 - 0.8 * ease.seg(f, 50, N - 1), camY, camZ);
        look.set(0, 2.8, ease.lerp(20, camZ - 7, ease.seg(f, 6, 46, ease.inOut)));
        rig.keys([{ f: 0, pos: pos.toArray(), look: look.toArray(), fov: 34 }]);
        rig.update(f);
        kit.update && kit.update(f);
        land.update(f, f / 24); mistA.update(f); mistB.update(f); speed.update(f);
        speed.setIntensity && speed.setIntensity(0.4 * ease.seg(f, 22, 60));
        // the horizon warms a touch as the shot runs
        hz.lerpColors(H0, H1, ease.seg(f, 0, N - 1));
        sky.set({ horizon: hz });
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
