import { distanceToCollider, STATIC_COLLIDERS } from './colliders';
import { BILLBOARD, onRoad, POND, pondDepth, PROPS, SPAWN, TREES, ZONES, zoneAt, zoneFor } from './layout';

const solids = STATIC_COLLIDERS.filter((c) => !c.name.startsWith('wall-'));

describe('district layout', () => {
  it('has the Career Tower zone and the four kiosk zones', () => {
    expect(ZONES.map((z) => z.section)).toEqual(['experience', 'research', 'projects', 'education', 'contact']);
    expect(zoneFor('experience').name).toBe('Career Tower');
  });

  it('puts every zone and parking spot on a road, clear of anything solid', () => {
    for (const zone of ZONES) {
      expect(onRoad(...zone.center), zone.name).toBe(true);
      expect(onRoad(...zone.parking.position), zone.name).toBe(true);
      for (const c of solids) expect(distanceToCollider(c, ...zone.parking.position), `${zone.name} vs ${c.name}`).toBeGreaterThan(2.5);
    }
  });

  it('finds the zone the car is in, and nothing just outside it', () => {
    const career = zoneFor('experience');
    expect(zoneAt(...career.center)?.section).toBe('experience');
    expect(zoneAt(...career.parking.position)?.section).toBe('experience');
    expect(zoneAt(career.center[0] + career.radius + 0.5, career.center[1])).toBeNull();
  });

  it('spawns on the road with clear space ahead, facing the billboard side of the street', () => {
    expect(onRoad(...SPAWN.position)).toBe(true);
    for (const c of solids) expect(distanceToCollider(c, ...SPAWN.position), c.name).toBeGreaterThan(3);
    // Heading east: the billboard is ahead (+X) and to the right (+Z, south).
    expect(BILLBOARD.position[0]).toBeGreaterThan(SPAWN.position[0]);
    expect(BILLBOARD.position[2]).toBeGreaterThan(SPAWN.position[1]);
  });

  it('keeps solid scenery off the roads', () => {
    for (const c of solids) {
      expect(onRoad(c.position[0], c.position[2], -0.5), c.name).toBe(false);
    }
  });

  it('places trees outside the pond and away from props and zones', () => {
    for (const t of TREES) {
      expect(pondDepth(t.position[0], t.position[2])).toBe(0);
      for (const zone of ZONES) expect(Math.hypot(t.position[0] - zone.center[0], t.position[2] - zone.center[1])).toBeGreaterThan(zone.radius);
    }
  });

  it('has a drivable shallow pond: deepest in the middle, zero at the shore', () => {
    expect(pondDepth(...POND.center)).toBe(POND.depth);
    expect(pondDepth(POND.center[0] + POND.radiusX + 0.1, POND.center[1])).toBe(0);
    const shore = pondDepth(POND.center[0] + POND.radiusX - 1, POND.center[1]);
    expect(shore).toBeGreaterThan(0);
    expect(shore).toBeLessThan(POND.depth);
  });

  it('builds a brick wall of several courses and enough props for the playground', () => {
    const bricks = PROPS.filter((p) => p.kind === 'brick');
    expect(bricks.length).toBeGreaterThan(40);
    expect(new Set(bricks.map((b) => b.position[1].toFixed(2))).size).toBe(6);
    expect(PROPS.filter((p) => p.kind === 'cone')).toHaveLength(8);
    expect(new Set(PROPS.map((p) => p.id)).size).toBe(PROPS.length);
  });
});
