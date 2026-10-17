// The opening camera reveal: a sweep across the district along the layout's key poses that settles into the
// chase position behind the car. Pure, so it can be tested.
import * as THREE from 'three';
import { REVEAL } from '../district/layout';

export const REVEAL_SECONDS = 7;

const smooth = (t: number) => t * t * (3 - 2 * t);
const toVec = (v: readonly number[]) => new THREE.Vector3(v[0], v[1], v[2]);

/**
 * Camera pose `seconds` into the reveal. The last leg blends from the final key pose into `chase`/`chaseTarget`
 * (the live chase pose), so the hand-off to driving has no jump.
 */
export function revealPose(seconds: number, chase: THREE.Vector3, chaseTarget: THREE.Vector3): { position: THREE.Vector3; target: THREE.Vector3 } {
  const keys = [...REVEAL.map((k) => ({ position: toVec(k.position), target: toVec(k.target) })), { position: chase.clone(), target: chaseTarget.clone() }];
  const legs = keys.length - 1;
  const t = Math.min(1, Math.max(0, seconds / REVEAL_SECONDS)) * legs;
  const i = Math.min(legs - 1, Math.floor(t));
  const f = smooth(t - i);
  return {
    position: keys[i].position.clone().lerp(keys[i + 1].position, f),
    target: keys[i].target.clone().lerp(keys[i + 1].target, f),
  };
}
