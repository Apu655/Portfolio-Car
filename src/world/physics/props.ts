// Physical props (KTD8): collider shape, mass, and material per kind; impact strength; and the rule for
// putting disturbed props back. Sizes match assets/blender/models/props.py.
import type { PropKind } from '../district/layout';
import type { PropMaterial } from '../events';

export interface PropSpec {
  shape: 'box' | 'cylinder';
  /** Box half extents (x, y, z); for cylinders [radius, halfHeight, radius]. */
  half: [number, number, number];
  mass: number;
  material: PropMaterial;
  friction: number;
  restitution: number;
}

export const PROP_SPECS: Record<PropKind, PropSpec> = {
  cone: { shape: 'cylinder', half: [0.21, 0.375, 0.21], mass: 3, material: 'plastic', friction: 0.6, restitution: 0.3 },
  crate: { shape: 'box', half: [0.5, 0.5, 0.5], mass: 20, material: 'wood', friction: 0.7, restitution: 0.15 },
  barrel: { shape: 'cylinder', half: [0.35, 0.5, 0.35], mass: 26, material: 'metal', friction: 0.5, restitution: 0.25 },
  sign: { shape: 'box', half: [0.25, 1.3, 0.12], mass: 9, material: 'metal', friction: 0.6, restitution: 0.2 },
  bench: { shape: 'box', half: [0.9, 0.45, 0.3], mass: 32, material: 'wood', friction: 0.7, restitution: 0.1 },
  brick: { shape: 'box', half: [0.29, 0.15, 0.2], mass: 4, material: 'brick', friction: 0.65, restitution: 0.05 },
};

/** Contact force (N) per kg of prop mass that counts as a full-strength impact. */
const FULL_IMPACT_FORCE_PER_KG = 900;
/** Below this, contacts are resting or sliding, not impacts. */
export const MIN_IMPACT = 0.04;

/** 0..1 impact strength from a contact's peak force, normalized by the prop's mass. */
export function impactIntensity(maxForce: number, mass: number): number {
  return Math.min(1, maxForce / (mass * FULL_IMPACT_FORCE_PER_KG));
}

export const RESET = {
  /** Seconds a disturbed prop must lie untouched before it is put back. */
  idleSeconds: 25,
  /** How far (m) a prop must move, or how much it must tilt, to count as disturbed. */
  displacement: 0.25,
  tilt: 0.3,
} as const;

/** Whether a prop should be put back now: disturbed, untouched long enough, and out of the visitor's view. */
export function shouldReset(prop: { displaced: number; tilt: number; idleSeconds: number; visible: boolean }): boolean {
  const disturbed = prop.displaced > RESET.displacement || prop.tilt > RESET.tilt;
  return disturbed && prop.idleSeconds >= RESET.idleSeconds && !prop.visible;
}
