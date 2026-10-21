import { carAfterKnock, copyFade, KNOCK, knockIntensity, throwOf } from './knock';

const EAST = -Math.PI / 2; // heading: 0 faces north (-Z), positive turns left

describe('knocking a lamp or tree over', () => {
  it('a car at 15 m/s keeps 92% of its speed through a lamp and 88% through a tree, in the same direction', () => {
    expect(carAfterKnock([15, -0.2, 0], 'lamp')).toEqual([15 * 0.92, -0.2, 0]);
    const [x, , z] = carAfterKnock([9, 0, -12], 'tree');
    expect(Math.hypot(x, z)).toBeCloseTo(15 * 0.88, 6);
    expect(x / z).toBeCloseTo(9 / -12, 6);
  });

  it('throws the object along the car’s path and up, harder the faster the car goes', () => {
    const slow = throwOf([5, 0, 0], EAST, 'lamp', false);
    const fast = throwOf([20, 0, 0], EAST, 'lamp', false);
    expect(slow.linvel[0]).toBeGreaterThan(0);
    expect(Math.abs(slow.linvel[2])).toBeLessThan(1e-9);
    expect(slow.linvel[1]).toBeGreaterThan(0);
    expect(fast.linvel[0]).toBeGreaterThan(slow.linvel[0]);
  });

  it('tips it over forward, away from the car', () => {
    // Driving east (+x): toppling forward turns about -z.
    const { angvel } = throwOf([10, 0, 0], EAST, 'tree', false);
    expect(angvel[2]).toBeLessThan(0);
  });

  it('still throws it clear when the car barely touches it, along the car’s heading', () => {
    const { linvel } = throwOf([0, 0, 0], EAST, 'tree', false);
    expect(linvel[0]).toBeGreaterThanOrEqual(KNOCK.throwBase - 1e-9);
  });

  it('under reduced motion it stays where it stood and simply fades', () => {
    const { linvel, angvel } = throwOf([20, 0, 0], EAST, 'lamp', true);
    expect([...linvel, ...angvel].every((v) => v === 0)).toBe(true);
  });

  it('lies for a while, then fades out and is done', () => {
    expect(copyFade(0).opacity).toBe(1);
    expect(copyFade(KNOCK.lieSeconds - 0.01).opacity).toBe(1);
    expect(copyFade(KNOCK.lieSeconds + KNOCK.fadeSeconds / 2).opacity).toBeCloseTo(0.5, 6);
    expect(copyFade(KNOCK.lieSeconds + KNOCK.fadeSeconds)).toEqual({ opacity: 0, done: true });
    expect(copyFade(KNOCK.lieSeconds).done).toBe(false);
  });

  it('sounds louder for faster hits', () => {
    expect(knockIntensity(25)).toBe(1);
    expect(knockIntensity(6)).toBeGreaterThan(knockIntensity(3));
    expect(knockIntensity(0)).toBeGreaterThan(0);
  });
});
