// Camera rig: declarative keyframed camera moves + handheld sway, all deterministic.
import * as E from './ease.js';
import * as THREE from 'three';

/**
 * createRig(camera) -> rig
 *   rig.keys([{ f: 0, pos:[x,y,z], look:[x,y,z], fov: 35, roll: 0 }, { f: 95, ... }], easeFn)
 *   rig.update(localFrame)        // interpolates between keys, applies sway, sets camera
 *   rig.sway(amount, speed)       // gentle handheld; amount in world units (0 = off)
 *   rig.shake(frame, amp)         // one-off impulse (e.g. train jolt)
 */
export function createRig(camera) {
  const rig = { camera, _keys: [], _ease: E.inOut, _sway: 0, _swaySpeed: 1, _shakes: [] };
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  rig.keys = (keys, easeFn) => { rig._keys = keys.slice().sort((a, b) => a.f - b.f); if (easeFn) rig._ease = easeFn; return rig; };
  rig.sway = (amount, speed = 1) => { rig._sway = amount; rig._swaySpeed = speed; return rig; };
  rig.shake = (frame, amp = 0.05, len = 10) => { rig._shakes.push({ frame, amp, len }); return rig; };
  rig.update = (f) => {
    const k = rig._keys; if (!k.length) return;
    let a = k[0], b = k[0];
    for (let i = 0; i < k.length; i++) { if (k[i].f <= f) { a = k[i]; b = k[Math.min(i + 1, k.length - 1)]; } }
    const t = a === b ? 0 : (b.ease || rig._ease)(E.clamp((f - a.f) / Math.max(1, b.f - a.f)));
    tmpPos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
    tmpLook.set(...(a.look || [0, 0, 0])).lerp(new THREE.Vector3(...(b.look || a.look || [0, 0, 0])), t);
    const fov = E.lerp(a.fov ?? camera.fov, b.fov ?? a.fov ?? camera.fov, t);
    const roll = E.lerp(a.roll || 0, b.roll || 0, t);
    if (rig._sway > 0) {
      const s = f * 0.05 * rig._swaySpeed;
      tmpPos.x += (E.noise1(s, 1) - 0.5) * rig._sway;
      tmpPos.y += (E.noise1(s, 2) - 0.5) * rig._sway;
      tmpLook.x += (E.noise1(s, 3) - 0.5) * rig._sway * 0.5;
      tmpLook.y += (E.noise1(s, 4) - 0.5) * rig._sway * 0.5;
    }
    for (const sh of rig._shakes) {
      const d = f - sh.frame; if (d < 0 || d > sh.len) continue;
      const k2 = (1 - d / sh.len) * sh.amp;
      tmpPos.x += Math.sin(d * 7.3) * k2; tmpPos.y += Math.cos(d * 9.1) * k2;
    }
    camera.position.copy(tmpPos);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(tmpLook);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };
  return rig;
}
