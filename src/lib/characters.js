// CHARACTERS department. STUB — the characters agent replaces internals, keeps every export + return shape.
import * as THREE from 'three';
import * as look from './look.js';

/**
 * createYuki(ctx, { withUmbrella, withBag, scale }) -> rig
 * rig = {
 *   group,                       // THREE.Group, feet at y=0, facing +Z, ~1.6 units tall
 *   parts: { head, hair, torso, armL, armR, legL, legR, bag, umbrella, eyeL, eyeR, mouth },
 *   pose(name, f, opts),         // apply a named animation at frame f (0-based from pose start). Names:
 *                                //   'idle' 'stand' 'walk' 'sit' 'sitIdle' 'sleep' 'wake' 'closeUmbrella'
 *                                //   'readLetter' 'foldPlane' 'throw' 'stepDown' 'touchGlass' 'lookUp'
 *   setExpression(name, blend),  // 'neutral' 'sad' 'calm' 'surprise' 'smile' 'closed'
 *   lookAt(vec3 | null),         // head turns toward world point
 *   update(f),                   // per-frame: blink, hair sway, breathing. Call every frame after pose().
 *   holdLetter(bool), holdPlane(bool), umbrellaOpen(0..1)
 * }
 */
export function createYuki(ctx, { withUmbrella = false, withBag = true, scale = 1 } = {}) {
  const group = new THREE.Group();
  const skin = look.toonMaterial({ color: 0xffe9dc });
  const hairM = look.toonMaterial({ color: 0x1e2140 });
  const cloth = look.toonMaterial({ color: 0xf3eee4 });
  const navy = look.toonMaterial({ color: 0x2b3560 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.35, 4, 12), cloth); torso.position.y = 1.05;
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.4, 16, 1, true), navy); skirt.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), skin); head.position.y = 1.47;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM); hair.position.y = 1.5;
  const legGeo = new THREE.CapsuleGeometry(0.06, 0.45, 4, 10);
  const legL = new THREE.Mesh(legGeo, skin); legL.position.set(0.09, 0.32, 0);
  const legR = new THREE.Mesh(legGeo, skin); legR.position.set(-0.09, 0.32, 0);
  const armGeo = new THREE.CapsuleGeometry(0.05, 0.4, 4, 10);
  const armL = new THREE.Mesh(armGeo, cloth); armL.position.set(0.25, 1.1, 0);
  const armR = new THREE.Mesh(armGeo, cloth); armR.position.set(-0.25, 1.1, 0);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1b1530 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeM); eyeL.position.set(0.07, 1.49, 0.17);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeM); eyeR.position.set(-0.07, 1.49, 0.17);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), eyeM); mouth.position.set(0, 1.42, 0.185);
  let bag = null, umbrella = null;
  if (withBag) { bag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.07), look.toonMaterial({ color: 0x6b7a4a })); bag.position.set(0.22, 0.85, 0.05); }
  if (withUmbrella) { umbrella = new THREE.Group(); const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), look.toonMaterial({ color: 0xcfe8ff, opacity: 0.45 })); canopy.position.y = 1.9;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), navy); shaft.position.y = 1.5; umbrella.add(canopy, shaft); umbrella.position.x = -0.3; }
  group.add(torso, skirt, head, hair, legL, legR, armL, armR, eyeL, eyeR, mouth);
  if (bag) group.add(bag); if (umbrella) group.add(umbrella);
  look.addOutline(group, { thickness: 0.012 });
  group.scale.setScalar(scale);

  const parts = { head, hair, torso, armL, armR, legL, legR, bag, umbrella, eyeL, eyeR, mouth };
  const rig = {
    group, parts,
    pose(name, f = 0) {
      const s = f / 24;
      if (name === 'walk') { legL.rotation.x = Math.sin(s * 6) * 0.5; legR.rotation.x = -Math.sin(s * 6) * 0.5; armL.rotation.x = -Math.sin(s * 6) * 0.4; armR.rotation.x = Math.sin(s * 6) * 0.4; }
      else if (name === 'sit' || name === 'sitIdle' || name === 'sleep' || name === 'wake' || name === 'readLetter' || name === 'foldPlane') { legL.rotation.x = legR.rotation.x = -Math.PI / 2; legL.position.y = legR.position.y = 0.55; }
      else { legL.rotation.x = legR.rotation.x = 0; armL.rotation.x = armR.rotation.x = 0; }
    },
    setExpression() {},
    lookAt(v) { if (v) head.lookAt(v); else head.rotation.set(0, 0, 0); },
    update(f) { const b = (f % 96) < 3 ? 0.15 : 1; eyeL.scale.y = eyeR.scale.y = b; torso.position.y = 1.05 + Math.sin(f / 24 * 1.5) * 0.004; },
    holdLetter() {}, holdPlane() {}, umbrellaOpen() {},
  };
  return rig;
}

/** background passengers / silhouettes for station & train shots -> { group, update(f) } */
export function createExtra(ctx, { seed = 1, scale = 1 } = {}) {
  const group = new THREE.Group();
  const m = look.toonMaterial({ color: 0x2a2f45 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.9, 4, 10), m); body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), m); head.position.y = 1.5;
  group.add(body, head); group.scale.setScalar(scale);
  return { group, update() {} };
}
