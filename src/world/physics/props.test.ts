// Covers AE1 on the real Rapier engine, plus impact strength and the reset rule.
import RAPIER from '@dimforge/rapier3d-compat';
import { PROPS } from '../district/layout';
import { impactIntensity, PROP_SPECS, shouldReset } from './props';
import { applyDrive, createChassis, createVehicle, headingQuat, type DriveState } from './vehicle';

beforeAll(async () => {
  await RAPIER.init();
});

const STEP = 1 / 60;

function addProp(world: RAPIER.World, kind: keyof typeof PROP_SPECS, x: number, y: number, z: number): RAPIER.RigidBody {
  const spec = PROP_SPECS[kind];
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y + spec.half[1], z));
  const desc = spec.shape === 'box' ? RAPIER.ColliderDesc.cuboid(...spec.half) : RAPIER.ColliderDesc.cylinder(spec.half[1], spec.half[0]);
  world.createCollider(desc.setMass(spec.mass).setFriction(spec.friction).setRestitution(spec.restitution), body);
  return body;
}

/** Drive into the layout's brick wall (oriented along X at z = 30) from the south at `kmh`. */
function hitWall(kmh: number): number {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0).setFriction(1));
  const bricks = PROPS.filter((p) => p.kind === 'brick').map((p) => {
    const body = addProp(world, 'brick', p.position[0], p.position[1], p.position[2]);
    return { body, start: { ...body.translation() } };
  });
  for (let i = 0; i < 60; i++) world.step(); // let the wall settle
  bricks.forEach((b) => (b.start = { ...b.body.translation() }));

  const chassis = createChassis(world, RAPIER, [36, 0, 40], 0);
  const vehicle = createVehicle(world, chassis);
  let drive: DriveState = { steer: 0 };
  chassis.setRotation(headingQuat(0), true);
  chassis.setLinvel({ x: 0, y: 0, z: -kmh / 3.6 }, true);
  // Hold speed with throttle until contact, then let the collision play out.
  for (let t = 0; t < 4; t += STEP) {
    drive = applyDrive(vehicle, { throttle: chassis.translation().z > 32 ? 1 : 0, steer: 0, handbrake: false }, drive, STEP);
    if (chassis.translation().z > 32) {
      const v = chassis.linvel();
      chassis.setLinvel({ x: v.x, y: v.y, z: -kmh / 3.6 }, true);
    }
    vehicle.updateVehicle(STEP, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    world.step();
  }
  return bricks.filter((b) => {
    const p = b.body.translation();
    return Math.hypot(p.x - b.start.x, p.y - b.start.y, p.z - b.start.z) > 0.2;
  }).length;
}

describe('brick wall (AE1)', () => {
  it('a 5 km/h nudge dislodges at most 6 bricks', () => {
    expect(hitWall(5)).toBeLessThanOrEqual(6);
  });

  it('a 40 km/h hit scatters at least 20 bricks', () => {
    expect(hitWall(40)).toBeGreaterThanOrEqual(20);
  });
});

describe('impacts', () => {
  it('a hit at 50 km/h sends a cone farther than a crate', () => {
    const distance = (kind: 'cone' | 'crate') => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      world.timestep = STEP;
      world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0).setFriction(1));
      const prop = addProp(world, kind, 0, 0, -10);
      const chassis = createChassis(world, RAPIER, [0, 0, 0], 0);
      createVehicle(world, chassis);
      chassis.setLinvel({ x: 0, y: 0, z: -50 / 3.6 }, true);
      for (let t = 0; t < 3; t += STEP) world.step();
      const p = prop.translation();
      return Math.hypot(p.x, p.z + 10);
    };
    expect(distance('cone')).toBeGreaterThan(distance('crate'));
  });

  it('impact strength rises with force and is normalized by mass', () => {
    expect(impactIntensity(1000, 3)).toBeGreaterThan(impactIntensity(200, 3));
    expect(impactIntensity(5000, 3)).toBeGreaterThan(impactIntensity(5000, 20));
    expect(impactIntensity(1e9, 3)).toBe(1);
  });
});

describe('putting props back', () => {
  it('resets a displaced prop after 25 s untouched, but only out of view', () => {
    expect(shouldReset({ displaced: 2, tilt: 0, idleSeconds: 26, visible: false })).toBe(true);
    expect(shouldReset({ displaced: 2, tilt: 0, idleSeconds: 26, visible: true })).toBe(false);
    expect(shouldReset({ displaced: 2, tilt: 0, idleSeconds: 10, visible: false })).toBe(false);
    expect(shouldReset({ displaced: 0.05, tilt: 0.05, idleSeconds: 60, visible: false })).toBe(false);
  });
});
