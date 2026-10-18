import { framing, ZOOM } from '../camera/framing';
import { BILLBOARD, BUILDING_HALF, BUILDING_HEIGHT, BUILDINGS, SECTION_GATES, SPAWN, TOWER, type Vec3 } from './layout';
import { blockingOccluders, OCCLUDERS } from './occluders';

/** Where the fixed-view camera stands when following a car at `car`. */
const cameraFor = (car: Vec3): Vec3 => framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6 }).position;

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

  it('gives every backdrop building a volume enclosing its footprint and roof', () => {
    BUILDINGS.forEach((b, i) => {
      const o = OCCLUDERS.find((v) => v.key === `building-${i}`)!;
      expect(o, `building-${i}`).toBeDefined();
      expect(o.half[0]).toBeGreaterThanOrEqual(BUILDING_HALF[b.variant] * b.scale);
      expect(o.center[1] + o.half[1]).toBeGreaterThanOrEqual(BUILDING_HEIGHT[b.variant] * b.scale);
    });
  });

  it('finds a section gate when the car has just driven through it', () => {
    const gate = SECTION_GATES.find((g) => g.section === 'research')!;
    const car: Vec3 = [gate.center[0] + 2, 1, gate.center[1] - 2]; // just past the gate, as seen from the south-west
    expect(blockingOccluders(cameraFor(car), car)).toContain('gate-research');
  });
});
