// Covers AE3 on the real Rapier engine: entering the pond fast throws a big splash and slows the car.
import RAPIER from '@dimforge/rapier3d-compat';
import { POND } from '../district/layout';
import { applyDrive, createChassis, createVehicle, forwardSpeed, headingQuat, placeChassis, type DriveState } from './vehicle';
import { WaterContact, type WaterStep } from './water';

beforeAll(async () => {
  await RAPIER.init();
});

const STEP = 1 / 60;
const idle = { throttle: 0, steer: 0, handbrake: false };

/** Car on flat ground heading east toward the pond's west shore at `speed` m/s, `gap` meters out. */
function approach(speed: number, gap = 8, throttle = 0) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));
  const start: [number, number] = [POND.center[0] - POND.radiusX - gap, POND.center[1]];
  const chassis = createChassis(world, RAPIER, [start[0], 0, start[1]], -Math.PI / 2);
  const vehicle = createVehicle(world, chassis);
  const water = new WaterContact();
  let drive: DriveState = { steer: 0 };
  const events: WaterStep[] = [];
  const step = (seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += STEP) {
      drive = applyDrive(vehicle, { ...idle, throttle }, drive, STEP);
      events.push(water.update(chassis, vehicle, STEP));
      vehicle.updateVehicle(STEP, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
      world.step();
    }
  };
  step(0.6); // settle
  placeChassis(chassis, start, -Math.PI / 2);
  chassis.setRotation(headingQuat(-Math.PI / 2), true);
  chassis.setLinvel({ x: speed, y: 0, z: 0 }, true);
  return { chassis, vehicle, step, events };
}

describe('driving into the pond', () => {
  it('at 30 km/h: a big entry splash and a clear slowdown within a second', () => {
    const car = approach(30 / 3.6);
    let entry: WaterStep | undefined;
    for (let i = 0; i < 300 && !entry; i++) {
      car.step(STEP);
      entry = car.events.find((e) => e.entered);
    }
    expect(entry?.splash?.intensity ?? 0).toBeGreaterThan(0.6);
    const atEntry = forwardSpeed(car.vehicle);
    car.step(1);
    expect(forwardSpeed(car.vehicle)).toBeLessThan(atEntry * 0.75);
  });

  it('at 5 km/h: only a small splash', () => {
    const car = approach(5 / 3.6, 1.5);
    let entry: WaterStep | undefined;
    for (let i = 0; i < 900 && !entry; i++) {
      car.step(STEP);
      entry = car.events.find((e) => e.entered);
    }
    expect(entry).toBeDefined();
    expect(entry!.splash!.intensity).toBeLessThan(0.2);
  });

  it('reports leaving the water', () => {
    const car = approach(30 / 3.6, 8, 1);
    car.step(8);
    expect(car.events.some((e) => e.entered)).toBe(true);
    expect(car.events.some((e) => e.exited)).toBe(true);
  });
});
