// Shallow-water physics for the pond (KTD7). Raycast wheels are not colliders, so water is detected per wheel
// from its ray contact point against the pond volume each physics step; the vehicle's rays ignore sensors.
import type RAPIER from '@dimforge/rapier3d-compat';
import { pondDepth } from '../district/layout';
import { CAR_TUNING } from './vehicle';

type RigidBody = RAPIER.RigidBody;
type Controller = RAPIER.DynamicRayCastVehicleController;

export const WATER = {
  /** Fraction of horizontal speed lost per second with all four wheels in water. */
  drag: 0.9,
  /** Tire grip multiplier in water. */
  grip: 0.55,
  /** A wheel counts as "in water" where the pond is at least this deep. */
  minDepth: 0.06,
  /** Seconds between continuous splashes while driving through water. */
  splashInterval: 0.22,
  /** Speed (m/s) that produces a full-intensity splash. */
  fullSplashSpeed: 11,
} as const;

export interface WaterStep {
  wheelsInWater: number;
  entered: boolean;
  exited: boolean;
  splash: { intensity: number; position: [number, number, number] } | null;
}

export class WaterContact {
  private inWater = false;
  private sinceSplash = 0;

  /** Detect wheels in water, apply drag and reduced grip, and report entry, exit, and splashes. */
  update(chassis: RigidBody, vehicle: Controller, dt: number): WaterStep {
    let wheels = 0;
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < 4; i++) {
      const point = vehicle.wheelIsInContact(i) ? vehicle.wheelContactPoint(i) : vehicle.wheelHardPoint(i);
      if (point && pondDepth(point.x, point.z) >= WATER.minDepth) {
        wheels++;
        sx += point.x;
        sz += point.z;
        vehicle.setWheelFrictionSlip(i, CAR_TUNING.frictionSlip * WATER.grip);
      }
    }

    const v = chassis.linvel();
    const horizontal = Math.hypot(v.x, v.z);
    if (wheels > 0 && horizontal > 0.01) {
      // Linear drag on the horizontal velocity, scaled by how many wheels are wet.
      const loss = 1 - Math.exp(-WATER.drag * (wheels / 4) * dt);
      const mass = chassis.mass();
      chassis.applyImpulse({ x: -v.x * loss * mass, y: 0, z: -v.z * loss * mass }, true);
    }

    const entered = wheels > 0 && !this.inWater;
    const exited = wheels === 0 && this.inWater;
    this.inWater = wheels > 0;

    let splash: WaterStep['splash'] = null;
    this.sinceSplash += dt;
    if (wheels > 0 && (entered || (this.sinceSplash >= WATER.splashInterval && horizontal > 1.5))) {
      this.sinceSplash = 0;
      const intensity = Math.min(1, horizontal / WATER.fullSplashSpeed);
      splash = { intensity, position: [sx / wheels, 0, sz / wheels] };
    }
    return { wheelsInWater: wheels, entered, exited, splash };
  }
}
