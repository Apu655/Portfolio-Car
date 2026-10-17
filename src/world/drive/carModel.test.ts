import type { Box } from '../city/cityLayout';
import { CAR, createCarState, forward, NO_DRIVE_INPUT, parkCar, stepCar, wrapAngle, type CarState, type DriveEnvironment, type DriveInput } from './carModel';

const open: DriveEnvironment = { obstacles: [], bound: 1000 };
const gas: DriveInput = { throttle: 1, steer: 0, handbrake: false };
const brake: DriveInput = { throttle: -1, steer: 0, handbrake: false };

function drive(state: CarState, input: DriveInput, seconds: number, dt = 1 / 60, env = open): CarState {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = stepCar(s, input, dt, env);
  return s;
}

describe('acceleration and braking', () => {
  it('builds speed smoothly and eases off toward top speed', () => {
    const start = createCarState([0, 0]);
    const speeds = [0.25, 1, 3, 8].map((t) => drive(start, gas, t).speed);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
    expect(speeds[0]).toBeLessThan(3); // no instant launch
    expect(speeds[3]).toBeLessThanOrEqual(CAR.maxSpeed);
    expect(speeds[3]).toBeGreaterThan(CAR.maxSpeed * 0.85);
  });

  it('drives toward -Z at heading 0', () => {
    const s = drive(createCarState([0, 0]), gas, 2);
    expect(s.position[1]).toBeLessThan(-5);
    expect(Math.abs(s.position[0])).toBeLessThan(1e-6);
  });

  it('feels the same at 30 fps and 144 fps', () => {
    const input: DriveInput = { throttle: 1, steer: 0.6, handbrake: false };
    const slow = drive(createCarState([0, 0]), input, 3, 1 / 30);
    const fast = drive(createCarState([0, 0]), input, 3, 1 / 144);
    expect(Math.abs(slow.speed - fast.speed)).toBeLessThan(0.6);
    expect(Math.abs(wrapAngle(slow.heading - fast.heading))).toBeLessThan(0.15);
    expect(Math.hypot(slow.position[0] - fast.position[0], slow.position[1] - fast.position[1])).toBeLessThan(2.5);
  });

  it('S brakes to a stop first, then reverses slowly', () => {
    const moving = drive(createCarState([0, 0]), gas, 3);
    const braking = drive(moving, brake, 0.3);
    expect(braking.speed).toBeLessThan(moving.speed);
    expect(braking.speed).toBeGreaterThan(0);
    const reversing = drive(moving, brake, 6);
    expect(reversing.speed).toBeLessThan(0);
    expect(reversing.speed).toBeGreaterThanOrEqual(-CAR.reverseSpeed);
  });

  it('coasts down gradually when nothing is pressed', () => {
    const moving = drive(createCarState([0, 0]), gas, 3);
    const coasting = drive(moving, NO_DRIVE_INPUT, 1);
    expect(coasting.speed).toBeLessThan(moving.speed);
    expect(coasting.speed).toBeGreaterThan(moving.speed * 0.6);
    expect(drive(moving, NO_DRIVE_INPUT, 20).speed).toBe(0);
  });

  it('the handbrake stops the car faster than coasting', () => {
    const moving = drive(createCarState([0, 0]), gas, 3);
    const handbrake = drive(moving, { throttle: 0, steer: 0, handbrake: true }, 0.8);
    const coasting = drive(moving, NO_DRIVE_INPUT, 0.8);
    expect(handbrake.speed).toBeLessThan(coasting.speed);
  });
});

describe('steering', () => {
  it('turns left on positive steer and right on negative', () => {
    const moving = drive(createCarState([0, 0]), gas, 2);
    expect(drive(moving, { throttle: 1, steer: 1, handbrake: false }, 0.5).heading).toBeGreaterThan(moving.heading + 0.2);
    expect(drive(moving, { throttle: 1, steer: -1, handbrake: false }, 0.5).heading).toBeLessThan(moving.heading - 0.2);
  });

  it('does not turn when stationary', () => {
    const s = drive(createCarState([0, 0]), { throttle: 0, steer: 1, handbrake: false }, 1);
    expect(s.heading).toBe(0);
  });

  it('steers less sharply at high speed so it stays stable', () => {
    const slow = drive(createCarState([0, 0]), { throttle: 0.4, steer: 0, handbrake: false }, 1.5);
    const fast = drive(createCarState([0, 0]), gas, 6);
    // Same input, but the steering angle actually applied (yaw per meter travelled) shrinks with speed.
    const turnPerMeter = (s: CarState) => {
      const next = drive(s, { throttle: Math.sign(s.speed), steer: 1, handbrake: false }, 0.5);
      return Math.abs(wrapAngle(next.heading - s.heading)) / (Math.abs(s.speed) * 0.5);
    };
    expect(turnPerMeter(fast)).toBeLessThan(turnPerMeter(slow));
  });

  it('reversing with left steer swings the nose the other way, like a real car', () => {
    const backing = drive(createCarState([0, 0]), brake, 2);
    const turned = drive(backing, { throttle: -1, steer: 1, handbrake: false }, 1);
    expect(turned.heading).toBeLessThan(0);
  });
});

describe('collisions', () => {
  const wall: Box = { minX: -20, maxX: 20, minZ: -12, maxZ: -10 };
  const env: DriveEnvironment = { obstacles: [wall], bound: 1000 };

  it('never drives into a building', () => {
    const s = drive(createCarState([0, 0]), gas, 4, 1 / 60, env);
    const [fx, fz] = forward(s.heading);
    const nose = [s.position[0] + fx * CAR.colliderOffset, s.position[1] + fz * CAR.colliderOffset];
    expect(nose[1]).toBeGreaterThanOrEqual(wall.maxZ + CAR.colliderRadius - 1e-6);
  });

  it('a head-on hit scrubs most speed; a glancing one keeps it (sliding along the wall)', () => {
    const headOn = drive(createCarState([0, 0]), gas, 4, 1 / 60, env);
    expect(Math.abs(headOn.speed)).toBeLessThan(CAR.maxSpeed * 0.4);

    // Heading almost parallel to the wall (mostly +X), drifting into it.
    const glancingStart = createCarState([-15, -8.5], -Math.PI / 2 + 0.12);
    glancingStart.speed = 18;
    const glancing = drive(glancingStart, gas, 0.6, 1 / 60, env);
    expect(glancing.speed).toBeGreaterThan(12);
    expect(glancing.position[0]).toBeGreaterThan(-5); // it kept moving along the wall
  });

  it('stays inside the world bounds', () => {
    const s = drive(createCarState([0, 0]), gas, 10, 1 / 60, { obstacles: [], bound: 30 });
    expect(Math.abs(s.position[1])).toBeLessThanOrEqual(30);
  });
});

describe('parking', () => {
  it('brings a moving car to rest within a couple of seconds', () => {
    let s = drive(createCarState([0, 0]), gas, 3);
    for (let i = 0; i < 120; i++) s = parkCar(s, 1 / 60, open);
    expect(s.speed).toBe(0);
  });
});
