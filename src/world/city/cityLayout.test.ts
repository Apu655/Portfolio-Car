import {
  BUILDINGS,
  distanceToLoop,
  ENTRANCE_RADIUS,
  loopAngle,
  LOOP,
  onBoulevard,
  onStreet,
  SPAWN,
  STREETLIGHTS,
  TOWERS,
  towerAtZone,
  TREES,
  type Box,
} from './cityLayout';
import { forward as forwardOf } from '../drive/carModel';

const overlaps = (a: Box, b: Box) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const towerBox = (t: (typeof TOWERS)[number]): Box => ({
  minX: t.center[0] - t.halfSize,
  maxX: t.center[0] + t.halfSize,
  minZ: t.center[1] - t.halfSize,
  maxZ: t.center[1] + t.halfSize,
});

describe('boulevard loop and landmarks', () => {
  it('passes the five towers in order: Career, AI Research, Projects, Education, Contact', () => {
    expect(TOWERS.map((t) => t.section)).toEqual(['experience', 'research', 'projects', 'education', 'contact']);
    const angles = TOWERS.map((t) => loopAngle(t.roadPoint[0], t.roadPoint[1]));
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]);
  });

  it('puts every entrance zone and parking spot on the boulevard, curb side', () => {
    for (const t of TOWERS) {
      expect(Math.abs(distanceToLoop(...t.roadPoint))).toBeLessThan(1e-6);
      expect(onBoulevard(...t.entrance)).toBe(true);
      expect(onBoulevard(...t.parking.position)).toBe(true);
      expect(distanceToLoop(...t.parking.position)).toBeGreaterThan(0); // outer (curb) lane
    }
  });

  it('parks the car facing along the loop direction', () => {
    for (const t of TOWERS) {
      const [fx, fz] = forwardOf(t.parking.heading);
      const ahead: [number, number] = [t.roadPoint[0] + fx * 20, t.roadPoint[1] + fz * 20];
      expect(loopAngle(...ahead)).toBeGreaterThan(loopAngle(...t.roadPoint));
    }
  });

  it('keeps landmarks off the road and away from each other', () => {
    for (const t of TOWERS) {
      const box = towerBox(t);
      for (const [x, z] of [
        [box.minX, box.minZ],
        [box.maxX, box.maxZ],
      ]) {
        expect(onBoulevard(x, z, 2)).toBe(false);
      }
      for (const other of TOWERS) if (other !== t) expect(overlaps(box, towerBox(other))).toBe(false);
    }
  });

  it('spawns on the boulevard with the Career Tower ahead and to the right', () => {
    expect(onBoulevard(...SPAWN.position)).toBe(true);
    const career = TOWERS[0];
    const [fx, fz] = forwardOf(SPAWN.heading);
    const dx = career.center[0] - SPAWN.position[0];
    const dz = career.center[1] - SPAWN.position[1];
    const ahead = dx * fx + dz * fz;
    const right = dx * -fz + dz * fx; // right-hand vector of the heading
    expect(ahead).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(Math.atan2(right, ahead)).toBeLessThan(Math.PI / 6);
  });
});

describe('entrance zones', () => {
  const career = TOWERS[0];
  it('finds the tower when the car is anywhere inside its zone', () => {
    expect(towerAtZone(...career.entrance)?.section).toBe('experience');
    expect(towerAtZone(career.entrance[0] + ENTRANCE_RADIUS - 0.5, career.entrance[1])?.section).toBe('experience');
    expect(towerAtZone(...career.parking.position)?.section).toBe('experience');
  });

  it('finds nothing just outside a zone, or in the far lane', () => {
    expect(towerAtZone(career.entrance[0] + ENTRANCE_RADIUS + 0.5, career.entrance[1])).toBeNull();
    const farLane: [number, number] = [career.roadPoint[0] - career.outward[0] * 4.5, career.roadPoint[1] - career.outward[1] * 4.5];
    expect(towerAtZone(...farLane)).toBeNull();
  });
});

describe('downtown', () => {
  it('fills the blocks with buildings, none on a road or the boulevard', () => {
    expect(BUILDINGS.length).toBeGreaterThan(30);
    for (const b of BUILDINGS) {
      for (const [x, z] of [
        [b.minX, b.minZ],
        [b.maxX, b.minZ],
        [b.minX, b.maxZ],
        [b.maxX, b.maxZ],
      ]) {
        expect(onStreet(x, z)).toBe(false);
        expect(distanceToLoop(x, z)).toBeLessThan(-LOOP.width / 2);
      }
    }
  });

  it('keeps landmarks the tallest buildings in the skyline', () => {
    const tallestFiller = Math.max(...BUILDINGS.map((b) => b.height));
    expect(Math.min(...TOWERS.map((t) => t.height))).toBeGreaterThan(tallestFiller);
  });

  it('keeps trees and streetlights off the driving lanes', () => {
    for (const p of [...TREES, ...STREETLIGHTS]) {
      expect(onBoulevard(p.position[0], p.position[1])).toBe(false);
    }
  });
});
