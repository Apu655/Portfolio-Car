// Headless handling tests on the real Rapier engine (the same build the site ships).
import RAPIER from '@dimforge/rapier3d-compat';
import type { DriveInput } from '../drive/input';
import { BOOST } from './boost';
import {
  CAR_TUNING,
  FlipWatch,
  applyDrive,
  createChassis,
  createVehicle,
  forwardSpeed,
  headingOf,
  recoverChassis,
  uprightness,
  type DriveState,
} from './vehicle';

beforeAll(async () => {
  await RAPIER.init();
});

const STEP = 1 / 60;

function scene(heading = 0, extra?: (world: RAPIER.World) => void) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));
  extra?.(world);
  const chassis = createChassis(world, RAPIER, [0, 0, 0], heading);
  const vehicle = createVehicle(world, chassis);
  let state: DriveState = { steer: 0 };
  const run = (input: DriveInput, seconds: number, boosting = false) => {
    for (let t = 0; t < seconds - 1e-9; t += STEP) {
      state = applyDrive(vehicle, input, state, STEP, boosting);
      vehicle.updateVehicle(STEP, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
      world.step();
    }
  };
  run({ throttle: 0, steer: 0, handbrake: false, boost: false }, 1); // settle on the suspension
  return { world, chassis, vehicle, run };
}

const gas: DriveInput = { throttle: 1, steer: 0, handbrake: false, boost: false };
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false, boost: false };

describe('raycast vehicle handling', () => {
  it('rests on all four wheels after spawning', () => {
    const { vehicle, chassis } = scene();
    expect([0, 1, 2, 3].every((i) => vehicle.wheelIsInContact(i))).toBe(true);
    expect(uprightness(chassis)).toBeGreaterThan(0.99);
  });

  it('accelerates to 80% of top speed in 4–7 s and drives toward its nose (-Z)', () => {
    const { vehicle, chassis, run } = scene();
    let seconds = 0;
    while (forwardSpeed(vehicle) < CAR_TUNING.maxSpeed * 0.8 && seconds < 12) {
      run(gas, 0.1);
      seconds += 0.1;
    }
    expect(seconds).toBeGreaterThanOrEqual(4);
    expect(seconds).toBeLessThanOrEqual(7);
    expect(chassis.translation().z).toBeLessThan(-20);
  });

  it('boost pulls harder and tops out about a third faster', () => {
    const plain = scene();
    plain.run(gas, 12);
    const top = forwardSpeed(plain.vehicle);
    expect(top).toBeLessThan(CAR_TUNING.maxSpeed + 0.5);
    const boosted = scene();
    boosted.run(gas, 3, true);
    const plainAt3 = scene();
    plainAt3.run(gas, 3);
    expect(forwardSpeed(boosted.vehicle)).toBeGreaterThan(forwardSpeed(plainAt3.vehicle) + 2);
    boosted.run(gas, 12, true);
    expect(forwardSpeed(boosted.vehicle)).toBeGreaterThan(CAR_TUNING.maxSpeed * 1.2);
    expect(forwardSpeed(boosted.vehicle)).toBeLessThan(CAR_TUNING.maxSpeed * BOOST.topSpeed + 0.5);
  });

  it('S brakes to a stop first, then reverses', () => {
    const { vehicle, run } = scene();
    run(gas, 3);
    const moving = forwardSpeed(vehicle);
    run({ throttle: -1, steer: 0, handbrake: false, boost: false }, 0.5);
    expect(forwardSpeed(vehicle)).toBeLessThan(moving - 3);
    run({ throttle: -1, steer: 0, handbrake: false, boost: false }, 5);
    expect(forwardSpeed(vehicle)).toBeLessThan(-1);
    expect(forwardSpeed(vehicle)).toBeGreaterThan(-CAR_TUNING.reverseMaxSpeed - 1);
  });

  it('coasts down gradually when nothing is pressed', () => {
    const { vehicle, run } = scene();
    run(gas, 3);
    const before = forwardSpeed(vehicle);
    run(idle, 1);
    expect(forwardSpeed(vehicle)).toBeLessThan(before);
    expect(forwardSpeed(vehicle)).toBeGreaterThan(before * 0.5);
  });

  it('equal left and right steering produce mirrored turns', () => {
    const left = scene();
    left.run(gas, 2);
    left.run({ throttle: 1, steer: 1, handbrake: false, boost: false }, 1.5);
    const right = scene();
    right.run(gas, 2);
    right.run({ throttle: 1, steer: -1, handbrake: false, boost: false }, 1.5);
    const hl = headingOf(left.chassis);
    const hr = headingOf(right.chassis);
    expect(hl).toBeGreaterThan(0.3); // positive steer turns left
    expect(hr).toBeLessThan(-0.3);
    expect(Math.abs(hl + hr)).toBeLessThan(0.1);
  });

  it('eases the throttle in over about a quarter second instead of snapping to full', () => {
    const { vehicle } = scene();
    let state: DriveState = { steer: 0 };
    state = applyDrive(vehicle, gas, state, 1 / 60);
    expect(state.throttle).toBeLessThan(0.5);
    for (let t = 1 / 60; t < 0.3; t += 1 / 60) state = applyDrive(vehicle, gas, state, 1 / 60);
    expect(state.throttle).toBeGreaterThan(0.85);
    for (let t = 0; t < 0.3; t += 1 / 60) state = applyDrive(vehicle, idle, state, 1 / 60);
    expect(state.throttle).toBeLessThan(0.05);
  });

  it('never tunnels through a wall at top speed', () => {
    const { chassis, run } = scene(0, (world) => {
      world.createCollider(RAPIER.ColliderDesc.cuboid(20, 3, 0.3).setTranslation(0, 3, -70));
    });
    run(gas, 10);
    expect(chassis.translation().z).toBeGreaterThan(-70);
  });
});

describe('recovery', () => {
  it('rights a flipped car at its current spot and heading', () => {
    const { chassis, vehicle, run } = scene(0.7);
    chassis.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true); // upside down
    run(idle, 1.5);
    expect(uprightness(chassis)).toBeLessThan(0);
    const before = chassis.translation();
    recoverChassis(chassis);
    run(idle, 1.5);
    expect(uprightness(chassis)).toBeGreaterThan(0.95);
    expect(Math.hypot(chassis.translation().x - before.x, chassis.translation().z - before.z)).toBeLessThan(1);
    expect([0, 1, 2, 3].some((i) => vehicle.wheelIsInContact(i))).toBe(true);
  });

  it('auto-recovers only after 2 s upside down and slow', () => {
    const watch = new FlipWatch(2);
    let fired = false;
    for (let t = 0; t < 1.9; t += 0.1) fired ||= watch.update(-1, 0, 0.1);
    expect(fired).toBe(false);
    for (let t = 0; t < 0.3; t += 0.1) fired ||= watch.update(-1, 0, 0.1);
    expect(fired).toBe(true);
    const rolling = new FlipWatch(2);
    let firedWhileUpright = false;
    for (let t = 0; t < 5; t += 0.1) firedWhileUpright ||= rolling.update(1, 10, 0.1);
    expect(firedWhileUpright).toBe(false);
  });
});
