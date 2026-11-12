// PLACEHOLDER shot12: The letter
// Beat: Insert, over the shoulder. Yuki unfolds a letter in her hands, reads it, then folds it carefully into a paper plane. Sunlight and petal shadows move across the paper.
// Replace this whole file. See bible/DIRECTOR.md for the contract.
export default {
  id: "shot12",
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
