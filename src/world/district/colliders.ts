// Static colliders derived from the layout: everything solid the car can hit except the ground (a trimesh
// from the district model) and the physical props (their own bodies).
import { BILLBOARD, BUILDING_HALF, BUILDINGS, GATE_FRAME, gatePoint, KIOSK_Z, KIOSKS, LAMPS, PLAZAS, SECTION_GATES, TOWER, TREES, WORLD_HALF, type Vec3 } from './layout';

export interface BoxCollider {
  kind: 'box';
  name: string;
  /** Center of the box. */
  position: Vec3;
  half: Vec3;
  rotationY: number;
}

export interface CylinderCollider {
  kind: 'cylinder';
  name: string;
  /** Center of the cylinder. */
  position: Vec3;
  radius: number;
  halfHeight: number;
}

export type StaticCollider = BoxCollider | CylinderCollider;

const box = (name: string, x: number, z: number, hx: number, height: number, hz: number, rotationY = 0, y0 = 0): BoxCollider => ({
  kind: 'box',
  name,
  position: [x, y0 + height / 2, z],
  half: [hx, height / 2, hz],
  rotationY,
});

const cylinder = (name: string, x: number, z: number, radius: number, height: number): CylinderCollider => ({
  kind: 'cylinder',
  name,
  position: [x, height / 2, z],
  radius,
  halfHeight: height / 2,
});

export const STATIC_COLLIDERS: StaticCollider[] = [
  // Career Tower: podium and shaft.
  box('tower-podium', TOWER.center[0], TOWER.center[1], TOWER.halfSize, 8.6, TOWER.halfSize),
  box('tower-shaft', TOWER.center[0], TOWER.center[1], 9.5, TOWER.height, 9.5),
  box('tower-canopy-posts', TOWER.center[0] - TOWER.halfSize - 3.6, TOWER.center[1], 0.2, 5.8, 3.8),
  // Kiosks and the section gates' pillars.
  ...KIOSKS.map((k) => box(`kiosk-${k.section}`, k.focus[0], KIOSK_Z, 1.7, 4.4, 0.8)),
  ...SECTION_GATES.flatMap((g) =>
    [-1, 1].map((side) => {
      const [x, z] = gatePoint(g, side * g.halfSpan, 0);
      return box(`gate-${g.section}-pillar-${side}`, x, z, GATE_FRAME.pillarHalf, GATE_FRAME.pillarHeight, GATE_FRAME.pillarHalf, g.rotationY);
    }),
  ),
  // Billboard posts (the board itself is above car height).
  ...[-1, 1].map((side) => {
    const offset = (BILLBOARD.width / 3) * side;
    const x = BILLBOARD.position[0] + Math.cos(BILLBOARD.rotationY) * offset;
    const z = BILLBOARD.position[2] - Math.sin(BILLBOARD.rotationY) * offset;
    return box(`billboard-post-${side}`, x, z, 0.7, 5.6, 0.7, BILLBOARD.rotationY);
  }),
  // Forecourt hedges.
  ...[-1, 1].map((side) => box(`hedge-${side}`, PLAZAS[0].center[0], TOWER.center[1] + side * 12.5, 7, 1.05, 0.6)),
  // Backdrop buildings.
  ...BUILDINGS.map((b, i) => {
    const half = BUILDING_HALF[b.variant] * b.scale;
    return box(`building-${i}`, b.position[0], b.position[2], half, 40, half, b.rotationY);
  }),
  // Streetlight poles and tree trunks.
  ...LAMPS.map((l, i) => cylinder(`lamp-${i}`, l.position[0], l.position[2], 0.2, 6.5)),
  ...TREES.map((t, i) => cylinder(`tree-${i}`, t.position[0], t.position[2], 0.28 * t.scale, 3)),
  // Invisible walls around the world.
  box('wall-north', 0, -WORLD_HALF - 1, WORLD_HALF + 2, 6, 1),
  box('wall-south', 0, WORLD_HALF + 1, WORLD_HALF + 2, 6, 1),
  box('wall-east', WORLD_HALF + 1, 0, 1, 6, WORLD_HALF + 2),
  box('wall-west', -WORLD_HALF - 1, 0, 1, 6, WORLD_HALF + 2),
];

/** Horizontal distance from (x, z) to a collider's footprint (0 when inside). */
export function distanceToCollider(c: StaticCollider, x: number, z: number): number {
  if (c.kind === 'cylinder') return Math.max(0, Math.hypot(x - c.position[0], z - c.position[2]) - c.radius);
  const cos = Math.cos(-c.rotationY);
  const sin = Math.sin(-c.rotationY);
  const dx = x - c.position[0];
  const dz = z - c.position[2];
  const lx = Math.abs(dx * cos - dz * sin) - c.half[0];
  const lz = Math.abs(dx * sin + dz * cos) - c.half[2];
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
}
