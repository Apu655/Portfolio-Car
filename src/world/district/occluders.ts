// Things tall enough to hide the car from the fixed camera (KTD5 of the isometric camera plan): one box per
// fadeable object, sized to what you see rather than to its collider, keyed by the name its scene object
// registers under. The camera-to-car line is tested against these each frame.
import {
  BILLBOARD,
  BUILDING_HALF,
  BUILDING_HEIGHT,
  BUILDINGS,
  CAMPUS,
  CONTACT_KIOSK,
  GATE_FRAME,
  PROJECTS_HALL,
  ROADSIDE_FRAME,
  ROADSIDE_SLOTS,
  ROBOT,
  SECTION_GATES,
  TOWER,
  type Vec3,
} from './layout';

export interface Occluder {
  key: string;
  center: Vec3;
  half: Vec3;
  /** Rotation about Y, same convention as a three.js object's `rotation.y`. */
  rotationY: number;
}

/** Top of the Career Tower's sky-garden crown. */
const TOWER_TOP = TOWER.height + 9;
/** The bulb board's top edge and thickness. */
const BILLBOARD_TOP = 11;

const box = (key: string, x: number, z: number, hx: number, height: number, hz: number, rotationY = 0): Occluder => ({
  key,
  center: [x, height / 2, z],
  half: [hx, height / 2, hz],
  rotationY,
});

export const OCCLUDERS: Occluder[] = [
  box('tower', TOWER.center[0], TOWER.center[1], TOWER.halfSize, TOWER_TOP, TOWER.halfSize),
  box('billboard', BILLBOARD.position[0], BILLBOARD.position[2], BILLBOARD.width / 2 + 0.6, BILLBOARD_TOP, 0.8, BILLBOARD.rotationY),
  // Section gates: the whole frame, up to the top of the header sign.
  ...SECTION_GATES.map((g) =>
    box(`gate-${g.section}`, g.center[0], g.center[1], g.halfSpan + GATE_FRAME.pillarHalf, GATE_FRAME.header.centerY + GATE_FRAME.header.height / 2 + 0.3, 2.2, g.rotationY),
  ),
  box('kiosk-contact', CONTACT_KIOSK.position[0], CONTACT_KIOSK.position[1], 1.8, 4.6, 0.9),
  // Roadside billboards: the leaning face and its frame, up to the top edge.
  ...ROADSIDE_SLOTS.map((s) =>
    box(s.key, s.position[0], s.position[1], ROADSIDE_FRAME.width / 2 + 0.3, ROADSIDE_FRAME.centerY + ROADSIDE_FRAME.height / 2 + 0.4, 1.4, ROADSIDE_FRAME.rotationY),
  ),
  box('robot', ROBOT.position[0], ROBOT.position[1], ROBOT.radius + 0.3, ROBOT.height + 0.4, ROBOT.radius + 0.3),
  box('projects-hall', PROJECTS_HALL.center[0], PROJECTS_HALL.center[1], PROJECTS_HALL.size[0] / 2, PROJECTS_HALL.height + 1.5, PROJECTS_HALL.size[1] / 2),
  box('campus', CAMPUS.center[0], CAMPUS.center[1], CAMPUS.size[0] / 2, CAMPUS.towerHeight, CAMPUS.size[1] / 2),
  ...BUILDINGS.map((b, i) => {
    const half = BUILDING_HALF[b.variant] * b.scale;
    return box(`building-${i}`, b.position[0], b.position[2], half, BUILDING_HEIGHT[b.variant] * b.scale, half, b.rotationY);
  }),
];

/** Whether the segment from `a` to `b` passes through the box (slab test in the box's own frame). */
export function segmentHitsBox(a: Vec3, b: Vec3, o: Occluder): boolean {
  const cos = Math.cos(o.rotationY);
  const sin = Math.sin(o.rotationY);
  const toLocal = (p: Vec3): Vec3 => {
    const dx = p[0] - o.center[0];
    const dz = p[2] - o.center[2];
    return [dx * cos - dz * sin, p[1] - o.center[1], dx * sin + dz * cos];
  };
  const la = toLocal(a);
  const lb = toLocal(b);
  let t0 = 0;
  let t1 = 1;
  for (let axis = 0; axis < 3; axis++) {
    const d = lb[axis] - la[axis];
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(la[axis]) > o.half[axis]) return false;
      continue;
    }
    let near = (-o.half[axis] - la[axis]) / d;
    let far = (o.half[axis] - la[axis]) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

/** Keys of every occluder between `from` (the camera) and `to` (a point on the car). */
export function blockingOccluders(from: Vec3, to: Vec3, list: readonly Occluder[] = OCCLUDERS): string[] {
  return list.filter((o) => segmentHitsBox(from, to, o)).map((o) => o.key);
}
