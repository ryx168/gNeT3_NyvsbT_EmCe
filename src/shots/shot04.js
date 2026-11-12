// shot04 — The platform (96 frames)
// Night station, wet concrete. Headlights grow from the dark at ~10; the First Light Express slides in
// decelerating (ease.outCubic) and stops at ~70 with a hiss of steam; doors open, warm light spills out.
// Yuki waits on the platform in profile.
// Lib: environments.createStationPlatform / createTrainExterior / createRails, characters.createYuki / createExtra,
//      vfx.createSteam / createMist, look.createSkyDome / lightingKit
export default {
  id: 'shot04',
  async build(ctx) {
    const { THREE, lib, ease } = ctx;
    const N = ctx.shot.frames;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.1, 1500);

    const sky = lib.look.createSkyDome({ top: 0x090a1a, horizon: 0x2a1d44, bottom: 0x05050b, radius: 900 });
    scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2(0x0b0c18, 0.012);
    const kit = lib.look.lightingKit(scene, 'station');

    const station = lib.environments.createStationPlatform(ctx); scene.add(station.group);
    const TRACK_X = -3.5, TRACK_Y = -1.0;
    const rails = lib.environments.createRails(ctx, { length: 500 }); rails.group.position.set(TRACK_X, TRACK_Y, 80); scene.add(rails.group);
    const mist = lib.vfx.createMist(ctx, { area: [60, 160], height: 1.5, center: [TRACK_X, -0.6, -30], color: 0x8fa3cc, seed: 401 }); scene.add(mist.group);

    // ---- the train (origin at front coupler, extends along -Z)
    const train = lib.environments.createTrainExterior(ctx, { cars: 4 });
    train.group.position.set(TRACK_X, TRACK_Y, -300);
    scene.add(train.group);
    // headlamp discs so the lights read from 300 m through the fog
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false });
    const lamps = [-0.95, 0.95].map(x => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), lampMat); m.position.set(x, 1.15, 0.3); m.userData.noOutline = true; train.group.add(m); return m; });
    const beam = new THREE.SpotLight(0xfff2cc, 0, 90, 0.42, 0.5, 1.2); beam.position.set(0, 1.4, 0.5); beam.target.position.set(0, 0.5, 60);
    train.group.add(beam, beam.target);
    const steam = lib.vfx.createSteam(ctx, { seed: 402 }); scene.add(steam.group);
    // warm spill from the opened door
    const doorLight = new THREE.PointLight(0xffd9a0, 0, 9, 1.6); doorLight.position.set(-1.9, 1.0, 5.0); scene.add(doorLight);

    // ---- Yuki waiting, in profile to camera, turned a little down-track
    const yuki = lib.characters.createYuki(ctx, { withUmbrella: true, withBag: true });
    yuki.group.position.set(0.3, 0, 3.2);
    yuki.group.rotation.y = -Math.PI / 2 - 0.45;
    scene.add(yuki.group);
    const extras = [[3.6, -16, 410], [4.6, -27, 411], [2.8, -36, 412]].map(([x, z, s]) => { const e = lib.characters.createExtra(ctx, { seed: s }); e.group.position.set(x, 0, z); e.group.rotation.y = -Math.PI / 2; scene.add(e.group); return e; });

    const rig = ctx.camrig(camera)
      .keys([
        { f: 0, pos: [3.5, 1.8, 13.5], look: [-2.6, 1.3, -32], fov: 34 },
        { f: 62, pos: [3.1, 1.68, 12.0], look: [-2.0, 1.4, -12], fov: 35 },
        { f: N - 1, pos: [2.85, 1.6, 10.8], look: [-1.8, 1.25, 1.5], fov: 36 },
      ], ease.inOut)
      .sway(0.006, 0.4)
      .shake(70, 0.035, 14);

    const STOP_Z = 9, START_Z = -230;
    const frontZ = f => f < 10 ? START_Z : ease.lerp(START_Z, STOP_Z, ease.seg(f, 10, 70, ease.outCubic));
    const look = new THREE.Vector3(), P_FAR = new THREE.Vector3(TRACK_X, 1.6, -70), P_DOOR = new THREE.Vector3(-1.8, 1.5, 5.5), P_FRONT = new THREE.Vector3();
    const emitted = new Set();
    return {
      scene, camera, post: 'station',
      update(local) {
        const f = local;
        rig.update(f); kit.update && kit.update(f);
        station.update(f, f / 24); rails.update && rails.update(f, f / 24); mist.update(f); steam.update(f);
        // train motion + lights
        const z = frontZ(f);
        train.group.position.z = z;
        train.update(f, f / 24);
        const on = ease.seg(f, 10, 26, ease.outQuad);
        if (train.headlights) train.headlights.intensity = 7 * on;
        beam.intensity = 60 * on; lampMat.color.setScalar(0.25 + 0.75 * on);
        if (f >= 70 && !emitted.has(70)) { emitted.add(70); steam.emit(f, new THREE.Vector3(TRACK_X + 1.2, -0.5, z - 2)); }
        if (f >= 73 && !emitted.has(73)) { emitted.add(73); steam.emit(f, new THREE.Vector3(TRACK_X + 1.2, -0.5, z - 21)); }
        // doors: use whatever the set exposes (setDoors / openDoors / doors[] with open()), else just the light spill
        const open = ease.seg(f, 76, 92, ease.inOut);
        if (typeof train.setDoors === 'function') train.setDoors(open);
        else if (typeof train.openDoors === 'function') train.openDoors(open);
        else if (Array.isArray(train.doors)) train.doors.forEach(d => { if (typeof d.open === 'function') d.open(open); else if (d.isObject3D) { if (d.userData.baseX === undefined) d.userData.baseX = d.position.x; d.position.x = d.userData.baseX + 0.6 * open; } });
        doorLight.intensity = 5 * open;
        // Yuki: watches the dark, follows the front as it slides past, settles on the door
        const follow = ease.seg(f, 48, 72, ease.inOut), toDoor = ease.seg(f, 72, 86, ease.inOut);
        P_FRONT.set(TRACK_X, 1.6, Math.min(z, 12));
        look.copy(P_FAR).lerp(P_FRONT, follow).lerp(P_DOOR, toDoor);
        yuki.lookAt(look); yuki.pose('idle', f); yuki.umbrellaOpen(0);
        if (f < 60) yuki.setExpression('calm', 1); else yuki.setExpression('smile', ease.seg(f, 74, 90, ease.inOut));
        yuki.update(f);
        extras.forEach(e => e.update(f));
        // station lamps hum
        if (station.lamps) station.lamps.forEach((l, i) => { l.intensity = 2 + 0.25 * Math.sin(f * 0.6 + i * 1.7); });
      },
      dispose() { scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose && x.dispose()); }); }
    };
  }
};
