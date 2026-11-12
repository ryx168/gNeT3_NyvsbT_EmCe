// PLACEHOLDER shot15: To the water's edge
// Beat: Beach. Yuki walks down the sand to where the waves run in; low sun, long shadow. She stops at the edge of the foam and takes out the paper plane.
// Replace this whole file. See bible/DIRECTOR.md for the contract.
export default {
  id: "shot15",
  async build(ctx) {
    const { THREE, lib } = ctx;
    const scene = new THREE.Scene();
    const sky = lib.look.createSkyDome({ top: 0x1a1b3a, horizon: 0x3b2a5a, bottom: 0x0a0a16 }); scene.add(sky.mesh);
    const camera = new THREE.PerspectiveCamera(35, ctx.width / ctx.height, 0.1, 2000);
    lib.look.lightingKit(scene, "neutral");
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lib.look.toonMaterial({ color: 0xff3fa4 }));
    lib.look.addOutline(box); scene.add(box);
    const rig = ctx.camrig(camera).keys([{ f: 0, pos: [0, 1, 5], look: [0, 0, 0] }, { f: ctx.shot.frames - 1, pos: [2, 1.5, 4], look: [0, 0, 0] }]);
    return { scene, camera, post: "neutral", update(local) { box.rotation.y = local * 0.05; rig.update(local); } };
  }
};
