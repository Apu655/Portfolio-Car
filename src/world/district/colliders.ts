// Static colliders derived from the layout: everything solid the car can hit except the ground (a trimesh
// from the district model) and the physical props (their own bodies).
import {
  BILLBOARD,
  BUILDINGS,
  CAMPUS,
  CONTACT_KIOSK,
  GATE_FRAME,
  gatePoint,
  LAMPS,
  PITCH,
  PLAZAS,
  PROJECTS_HALL,
  ROADSIDE_FRAME,
  ROADSIDE_SLOTS,
  roadsidePoint,
  ROBOT,
  SECTION_GATES,
  TOWER,
  TREES,
  WORLD_HALF,
  type Vec3,
} from './layout';

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
  // The Contact kiosk, the section landmarks, and the section gates' pillars.
  box('kiosk-contact', CONTACT_KIOSK.position[0], CONTACT_KIOSK.position[1], 1.7, 4.4, 0.8),
  box('projects-hall', PROJECTS_HALL.center[0], PROJECTS_HALL.center[1], PROJECTS_HALL.size[0] / 2, PROJECTS_HALL.height, PROJECTS_HALL.size[1] / 2),
  box('campus', CAMPUS.center[0], CAMPUS.center[1], CAMPUS.size[0] / 2, CAMPUS.height, CAMPUS.size[1] / 2),
  // The robot stands in the road on purpose (R8): solid, so the car stops against it.
  cylinder('robot', ROBOT.position[0], ROBOT.position[1], ROBOT.radius, ROBOT.height),
  ...SECTION_GATES.flatMap((g) =>
    [-1, 1].map((side) => {
      const [x, z] = gatePoint(g, side * g.halfSpan, 0);
      return box(`gate-${g.section}-pillar-${side}`, x, z, GATE_FRAME.pillarHalf, GATE_FRAME.pillarHeight, GATE_FRAME.pillarHalf, g.rotationY);
    }),
  ),
  // Roadside billboard posts (the faces are above car height).
  ...ROADSIDE_SLOTS.flatMap((slot) =>
    [-1, 1].map((side) => {
      const [x, z] = roadsidePoint(slot.position, side * ROADSIDE_FRAME.postOffset, 0);
      const h = ROADSIDE_FRAME.postHalf;
      return box(`${slot.key}-post${side}`, x, z, h, ROADSIDE_FRAME.centerY, h, ROADSIDE_FRAME.rotationY);
    }),
  ),
  // Name billboard posts (the board itself is above car height).
  ...[-1, 1].map((side) => {
    const offset = (BILLBOARD.width / 3) * side;
    const x = BILLBOARD.position[0] + Math.cos(BILLBOARD.rotationY) * offset;
    const z = BILLBOARD.position[2] - Math.sin(BILLBOARD.rotationY) * offset;
    return box(`billboard-post-${side}`, x, z, 0.7, 5.6, 0.7, BILLBOARD.rotationY);
  }),
  // Football goals at each end of the pitch: posts, crossbar, and the net's back and sides.
  ...[-1, 1].flatMap((s) => {
    const { width: w, height: h, depth: d } = PITCH.goal;
    const x = PITCH.center[0] + (s * PITCH.size[0]) / 2;
    const z = PITCH.center[1];
    return [
      ...[-1, 1].map((t) => box(`goal${s}-post${t}`, x, z + (t * w) / 2, 0.08, h, 0.08)),
      box(`goal${s}-bar`, x, z, 0.08, 0.16, w / 2, 0, h - 0.08),
      box(`goal${s}-back`, x + s * d, z, 0.05, h, w / 2),
      ...[-1, 1].map((t) => box(`goal${s}-side${t}`, x + (s * d) / 2, z + (t * w) / 2, d / 2, h, 0.05)),
    ];
  }),
  // Forecourt hedges.
  ...[-1, 1].map((side) => box(`hedge-${side}`, PLAZAS[0].center[0], TOWER.center[1] + side * 12.5, 7, 1.05, 0.6)),
  // City blocks: each building's footprint, up to its parapet.
  ...BUILDINGS.map((b, i) => box(`building-${i}`, b.center[0], b.center[1], b.half[0], b.height, b.half[1])),
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
