import { framing, ZOOM } from '../camera/framing';
import { STATIC_COLLIDERS } from './colliders';
import { BILLBOARD, BUILDINGS, HEADING, ROADS, ROADSIDE_SLOTS, ROBOT, SECTION_GATES, SPAWN, TOWER, type Building, type Vec2, type Vec3 } from './layout';
import { blockingOccluders, OCCLUDERS, ROOFTOP_ALLOWANCE } from './occluders';

/** Where the fixed-view camera stands when following a car at `car`. */
const cameraFor = (car: Vec3): Vec3 => framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6 }).position;

/** A building on the camera side of its road (south or west of it) faces north or east (KTD4). */
const cameraSide = (b: Building) => Math.abs(b.rotationY - HEADING.north) < 1e-6 || Math.abs(b.rotationY - HEADING.east) < 1e-6;

/** Points along every road's centerline about `step` apart, each with a unit normal: the loop, then the cross street. */
function roadSamples(step: number): Array<{ at: Vec2; normal: Vec2 }> {
  const { halfX, halfZ, cornerRadius: r } = ROADS.loop;
  const ix = halfX - r;
  const iz = halfZ - r;
  const out: Array<{ at: Vec2; normal: Vec2 }> = [];
  const line = (from: Vec2, to: Vec2, normal: Vec2) => {
    const n = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step);
    for (let i = 0; i <= n; i++) out.push({ at: [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n], normal });
  };
  line([ix, -halfZ], [-ix, -halfZ], [0, -1]);
  line([-halfX, -iz], [-halfX, iz], [-1, 0]);
  line([-ix, halfZ], [ix, halfZ], [0, 1]);
  line([halfX, iz], [halfX, -iz], [1, 0]);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const n = Math.ceil((r * Math.PI) / 2 / step);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      const normal: Vec2 = [sx * Math.cos(a), sz * Math.sin(a)];
      out.push({ at: [sx * ix + normal[0] * r, sz * iz + normal[1] * r], normal });
    }
  }
  line([ROADS.crossStreetX, -halfZ], [ROADS.crossStreetX, halfZ], [1, 0]);
  return out;
}

describe('what blocks the camera', () => {
  it('finds the Career Tower when the car is behind it as seen from the camera (AE1)', () => {
    const car: Vec3 = [TOWER.center[0] + 15, 1, TOWER.center[1] - 17]; // north-east of the tower
    expect(blockingOccluders(cameraFor(car), car)).toContain('tower');
  });

  it('finds nothing for a car on open road', () => {
    const car: Vec3 = [SPAWN.position[0], 1, SPAWN.position[1]];
    expect(blockingOccluders(cameraFor(car), car)).toEqual([]);
  });

  it('ignores a building beside the line of sight', () => {
    const tower = OCCLUDERS.find((o) => o.key === 'tower')!;
    // A car south-west of the tower: the camera is even farther south-west, so the tower is behind the car.
    const car: Vec3 = [tower.center[0] - 25, 1, tower.center[2] + 25];
    expect(blockingOccluders(cameraFor(car), car)).not.toContain('tower');
  });

  it('finds the billboard when the line of sight passes above its posts', () => {
    const car: Vec3 = [BILLBOARD.position[0] + 6, 1, BILLBOARD.position[2] - 6];
    expect(blockingOccluders(cameraFor(car), car)).toContain('billboard');
  });

  it('gives every building a collider and an occluder enclosing its footprint, parapet and rooftop', () => {
    BUILDINGS.forEach((b, i) => {
      const o = OCCLUDERS.find((v) => v.key === `building-${i}`)!;
      expect(o, `building-${i}`).toBeDefined();
      expect(o.rotationY).toBe(0);
      expect(o.center[0] - o.half[0]).toBeLessThanOrEqual(b.center[0] - b.half[0]);
      expect(o.center[0] + o.half[0]).toBeGreaterThanOrEqual(b.center[0] + b.half[0]);
      expect(o.center[2] - o.half[2]).toBeLessThanOrEqual(b.center[1] - b.half[1]);
      expect(o.center[2] + o.half[2]).toBeGreaterThanOrEqual(b.center[1] + b.half[1]);
      expect(o.center[1] - o.half[1]).toBeLessThanOrEqual(0);
      expect(o.center[1] + o.half[1]).toBeGreaterThanOrEqual(b.height + ROOFTOP_ALLOWANCE);
      const c = STATIC_COLLIDERS.find((v) => v.name === `building-${i}`)!;
      expect(c, `building-${i} collider`).toBeDefined();
      expect(c.kind).toBe('box');
      if (c.kind !== 'box') return;
      expect(c.rotationY).toBe(0);
      expect([c.position[0], c.position[2]]).toEqual(b.center);
      expect([c.half[0], c.half[2]]).toEqual(b.half);
      expect(c.position[1] + c.half[1]).toBeGreaterThanOrEqual(b.height);
    });
    expect(OCCLUDERS.filter((o) => o.key.startsWith('building-'))).toHaveLength(BUILDINGS.length);
  });

  it('never hides the car behind a camera-side building, on any lane of any road (KTD4)', () => {
    const keys = new Set(BUILDINGS.flatMap((b, i) => (cameraSide(b) ? [`building-${i}`] : [])));
    expect(keys.size).toBeGreaterThan(0);
    const hidden: string[] = [];
    for (const { at, normal } of roadSamples(3)) {
      for (const side of [-1, 1]) {
        const car: Vec3 = [at[0] + normal[0] * side * ROADS.laneOffset, 1, at[1] + normal[1] * side * ROADS.laneOffset];
        for (const key of blockingOccluders(cameraFor(car), car)) if (keys.has(key)) hidden.push(`${key} hides a car at ${car[0].toFixed(1)},${car[2].toFixed(1)}`);
      }
    }
    expect(hidden).toEqual([]);
  });

  it('finds a section gate when the car has just driven through it', () => {
    const gate = SECTION_GATES.find((g) => g.section === 'research')!;
    const car: Vec3 = [gate.center[0] + 2, 1, gate.center[1] - 2]; // just past the gate, as seen from the south-west
    expect(blockingOccluders(cameraFor(car), car)).toContain('gate-research');
  });

  it('finds a roadside billboard and the robot when each stands between the camera and the car', () => {
    const slot = ROADSIDE_SLOTS.find((s) => s.key === 'roadside-research-2')!;
    const behindBoard: Vec3 = [slot.position[0] + 3, 1, slot.position[1] - 3];
    expect(blockingOccluders(cameraFor(behindBoard), behindBoard)).toContain('roadside-research-2');
    const behindRobot: Vec3 = [ROBOT.position[0] + 2, 1, ROBOT.position[1] - 2];
    expect(blockingOccluders(cameraFor(behindRobot), behindRobot)).toContain('robot');
  });
});
