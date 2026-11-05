import { canEnter, doorPoint, exitSpots, pickExit, PLAYER, pressF, settle, travelTarget } from './player';

const EAST = -Math.PI / 2; // heading: 0 faces north (-Z), positive turns left
const car: [number, number] = [10, 20];

describe('getting in and out of the car', () => {
  it('puts the driver’s door on the car’s right-hand side', () => {
    // Facing north, right is east.
    const [x, z] = doorPoint(car, 0, 1);
    expect(x).toBeCloseTo(car[0] + PLAYER.doorOffset, 6);
    expect(z).toBeCloseTo(car[1], 6);
    // Facing east, right is south (+Z).
    const [x2, z2] = doorPoint(car, EAST, 1);
    expect(x2).toBeCloseTo(car[0], 6);
    expect(z2).toBeCloseTo(car[1] + PLAYER.doorOffset, 6);
  });

  it('F gets in only within reach of the driver’s door (AE1)', () => {
    const door = doorPoint(car, 0, 1);
    expect(canEnter([door[0] + 2.9, door[1]], car, 0)).toBe(true);
    expect(canEnter([door[0] + 5, door[1]], car, 0)).toBe(false);
    expect(pressF('foot', true)).toBe('entering');
    expect(pressF('foot', false)).toBe('foot');
  });

  it('steps in, then drives', () => {
    expect(settle('entering', PLAYER.enterSeconds - 0.01, 0, true)).toBe('entering');
    expect(settle('entering', PLAYER.enterSeconds, 0, true)).toBe('driving');
  });

  it('F while driving brakes first, and steps out only once the car has stopped', () => {
    expect(pressF('driving', false)).toBe('stopping');
    expect(settle('stopping', 0.2, 10, true)).toBe('stopping');
    expect(settle('stopping', 0.9, 0.3, true)).toBe('foot');
  });

  it('refuses to step out when there is nowhere clear to stand, and keeps driving', () => {
    expect(settle('stopping', 0.9, 0.2, false)).toBe('driving');
  });

  it('picks the driver’s side, then the passenger side, then behind the car', () => {
    const [driver, passenger, behind] = exitSpots(car, 0);
    expect(pickExit(car, 0, () => true)).toEqual(driver);
    // A wall along the driver's (east) side.
    const wallEast = (x: number) => x < car[0] + 0.5;
    expect(pickExit(car, 0, wallEast)).toEqual(passenger);
    expect(passenger[0]).toBeLessThan(car[0]);
    // Walls on both sides: behind the car (facing north, behind is +Z).
    const bothSides = (x: number) => Math.abs(x - car[0]) < 0.5;
    expect(pickExit(car, 0, bothSides)).toEqual(behind);
    expect(behind[1]).toBeGreaterThan(car[1]);
    expect(pickExit(car, 0, () => false)).toBeNull();
  });

  it('fast travel moves whoever the visitor is controlling (AE2)', () => {
    expect(travelTarget('foot')).toBe('walker');
    expect(travelTarget('driving')).toBe('car');
    expect(travelTarget('entering')).toBe('car');
    expect(travelTarget('stopping')).toBe('car');
  });
});
