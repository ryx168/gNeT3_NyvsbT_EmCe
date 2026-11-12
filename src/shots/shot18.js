// shot18 — Credits (120 frames)
// Black card; a few faint petals drift through. The titles department draws the credits on the overlay. post 'credits'.
export default {
  id: 'shot18',
  async build(ctx) {
    const { THREE, lib } = ctx;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(35, ctx.width / ctx.height, 0.1, 100);
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
    const petals = lib.vfx.createPetals(ctx, { count: 160, area: [20, 12, 6], center: [0, 0, -2], wind: [0.4, 0, 0], seed: 1801, size: 0.6, fall: 0.5 }); scene.add(petals.group);
    petals.group.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.22; } });
    const dim = new THREE.AmbientLight(0x404050, 0.6); scene.add(dim);
    return { scene, camera, post: 'credits', update(local) { petals.update(local); } };
  }
};
