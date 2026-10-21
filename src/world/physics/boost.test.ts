import { BOOST, FULL_TANK, tickBoost, type BoostState } from './boost';

const STEP = 1 / 60;

/** Tick the tank for `seconds` with the same request every step. */
function hold(state: BoostState, wanted: boolean, seconds: number): BoostState {
  for (let t = 0; t < seconds - 1e-9; t += STEP) state = tickBoost(state, STEP, wanted);
  return state;
}

describe('boost tank', () => {
  it('starts full and boosts while held', () => {
    const s = tickBoost(FULL_TANK, STEP, true);
    expect(s.active).toBe(true);
    expect(s.level).toBeLessThan(1);
  });

  it('empties after about 3 s held, then stops boosting while still held', () => {
    const empty = hold(FULL_TANK, true, BOOST.seconds + 0.05);
    expect(empty.level).toBe(0);
    expect(empty.active).toBe(false);
    expect(empty.locked).toBe(true);
    const stillHeld = hold(empty, true, 1);
    expect(stillHeld.active).toBe(false);
    expect(stillHeld.level).toBe(0);
  });

  it('waits a moment after release, then refills fully in about 2.5 s', () => {
    const empty = hold(FULL_TANK, true, BOOST.seconds + 0.05);
    const waiting = hold(empty, false, BOOST.refillDelay - 0.05);
    expect(waiting.level).toBe(0);
    const almost = hold(waiting, false, 0.05 + BOOST.refillSeconds - 0.2);
    expect(almost.level).toBeGreaterThan(0.85);
    expect(almost.level).toBeLessThan(1);
    expect(hold(almost, false, 0.3).level).toBe(1);
  });

  it('stays locked out after running dry until the tank refills to the re-arm level', () => {
    const empty = hold(FULL_TANK, true, BOOST.seconds + 0.05);
    const low = hold(empty, false, BOOST.refillDelay + BOOST.refillSeconds * (BOOST.rearm - 0.05));
    expect(low.level).toBeGreaterThan(0);
    expect(tickBoost(low, STEP, true).active).toBe(false);
    const armed = hold(low, false, BOOST.refillSeconds * 0.1);
    expect(armed.locked).toBe(false);
    expect(tickBoost(armed, STEP, true).active).toBe(true);
  });

  it('a partly used tank boosts again straight away', () => {
    const used = hold(FULL_TANK, true, 1);
    const released = hold(used, false, 0.1);
    expect(tickBoost(released, STEP, true).active).toBe(true);
  });

  it('does not refill while boost is held', () => {
    const used = hold(FULL_TANK, true, 1);
    expect(hold(used, true, 0.5).level).toBeLessThan(used.level);
  });
});
