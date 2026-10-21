import { PROJECTS_HALL, TOWER } from '../district/layout';
import { footprintMask, LAMP_POOL, lampPoolMap, landmarkFootprints, MASK, maskAt } from './groundMask';

describe('ground contact mask', () => {
  const building = { x: 0, z: 0, hx: 6, hz: 4, rotationY: 0 };
  const mask = footprintMask([building]);

  it('is dark under a building', () => {
    expect(maskAt(mask, 0, 0)).toBeGreaterThan(0.97);
  });

  it('is half-dark at the wall and fades to clear within about 3 m outside it', () => {
    const atWall = maskAt(mask, 6, 0);
    expect(atWall).toBeGreaterThan(0.3);
    expect(atWall).toBeLessThan(0.75);
    expect(maskAt(mask, 6 + 1, 0)).toBeGreaterThan(maskAt(mask, 6 + 2, 0));
    expect(maskAt(mask, 6 + 3.5, 0)).toBeLessThan(0.06);
  });

  it('is clear on open ground far from any building', () => {
    expect(maskAt(mask, 40, 30)).toBe(0);
  });

  it('follows a footprint turned to its road', () => {
    const turned = footprintMask([{ x: 0, z: 0, hx: 12, hz: 3, rotationY: Math.PI / 4 }]);
    // Along the turned diagonal: inside. Along the unturned axis at the same distance: outside.
    expect(maskAt(turned, 5, -5)).toBeGreaterThan(0.8);
    expect(maskAt(turned, 11, 0)).toBeLessThan(0.1);
  });

  it('covers the landmarks, which lose runtime ambient occlusion', () => {
    const landmarks = footprintMask(landmarkFootprints());
    expect(maskAt(landmarks, TOWER.center[0] + TOWER.halfSize - 0.5, TOWER.center[1])).toBeGreaterThan(0.6);
    expect(maskAt(landmarks, PROJECTS_HALL.center[0], PROJECTS_HALL.center[1] + PROJECTS_HALL.size[1] / 2 - 0.5)).toBeGreaterThan(0.6);
  });

  it('spans the whole world', () => {
    expect(MASK.half).toBeGreaterThanOrEqual(105);
  });
});

describe('streetlight pools painted on the ground', () => {
  const at = (map: Float32Array, x: number, z: number) => maskAt(map, x, z, LAMP_POOL.size, MASK.half);

  it('is brightest under a lamp head and fades out within about 12 m', () => {
    const map = lampPoolMap([{ x: 10, y: -20 }]);
    expect(at(map, 10, -20)).toBeGreaterThan(0.95);
    expect(at(map, 15, -20)).toBeCloseTo(Math.exp(-25 / 26), 1);
    expect(at(map, 10, -8)).toBeLessThan(0.01);
  });

  it('adds up where two pools meet, up to a cap', () => {
    const map = lampPoolMap([{ x: 0, y: 0 }, { x: 0.5, y: 0 }]);
    expect(at(map, 0.25, 0)).toBeLessThanOrEqual(LAMP_POOL.max + 1e-6);
    expect(at(map, 0.25, 0)).toBeGreaterThan(1.2);
  });

  it('is dark everywhere with no lamps', () => {
    expect(lampPoolMap([]).every((v) => v === 0)).toBe(true);
  });
});
