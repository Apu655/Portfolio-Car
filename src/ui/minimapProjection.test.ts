import { mapAngle, MAP_SIZE, toMap } from './minimapProjection';

describe('minimap projection', () => {
  it('puts the district centre in the middle of the map', () => {
    const [x, y] = toMap(0, 0);
    expect(x).toBeCloseTo(MAP_SIZE / 2, 5);
    expect(y).toBeCloseTo(MAP_SIZE / 2, 5);
  });

  it('matches the screen: north-east is up and south-east is right', () => {
    const [, upY] = toMap(30, -30); // north-east
    const [rightX] = toMap(30, 30); // south-east
    expect(upY).toBeLessThan(MAP_SIZE / 2);
    expect(rightX).toBeGreaterThan(MAP_SIZE / 2);
  });

  it('keeps the road loop and every stop on the map', () => {
    for (const [x, z] of [[-75, -60], [75, -60], [75, 60], [-75, 60], [45, -69], [-45, -69]]) {
      const [mx, my] = toMap(x, z);
      expect(mx).toBeGreaterThanOrEqual(0);
      expect(mx).toBeLessThanOrEqual(MAP_SIZE);
      expect(my).toBeGreaterThanOrEqual(0);
      expect(my).toBeLessThanOrEqual(MAP_SIZE);
    }
  });

  it('points the car arrow up the map when the car heads north-east', () => {
    expect(mapAngle(-Math.PI / 4)).toBeCloseTo(0, 5);
  });
});
