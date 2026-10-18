// Rendering quality tiers (KTD5, KTD10): pick a starting tier from the device, then step down one tier when the frame
// rate stays low. Pure so it can be unit-tested.

export type Tier = 'high' | 'medium' | 'low';

export interface TierSettings {
  shadows: boolean;
  shadowMapSize: number;
  /** Bloom's blur resolution as a share of the screen: 1 is the full mipmap blur, 0.5 a cheaper half-size blur. */
  bloomScale: number;
  bloomIntensity: number;
  /** Resolution scale range; the upper bound caps it on retina screens. */
  dpr: [number, number];
}

/** Every tier runs the composer, so the grade, vignette and tone mapping hold everywhere (KTD10). */
export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  high: { shadows: true, shadowMapSize: 2048, bloomScale: 1, bloomIntensity: 0.7, dpr: [1, 1.5] },
  medium: { shadows: true, shadowMapSize: 1024, bloomScale: 1, bloomIntensity: 0.7, dpr: [1, 1.25] },
  low: { shadows: false, shadowMapSize: 512, bloomScale: 0.5, bloomIntensity: 0.5, dpr: [1, 1] },
};

export interface DeviceInfo {
  coarsePointer: boolean;
  /** navigator.deviceMemory in GB when the browser reports it. */
  memoryGB?: number;
  cores?: number;
  softwareRenderer?: boolean;
}

export function chooseTier(device: DeviceInfo): Tier {
  if (device.softwareRenderer) return 'low';
  if (device.coarsePointer) return 'low';
  if ((device.memoryGB !== undefined && device.memoryGB < 4) || (device.cores !== undefined && device.cores < 4)) return 'medium';
  return 'high';
}

export function lowerTier(tier: Tier): Tier {
  return tier === 'high' ? 'medium' : 'low';
}

/** Signals a drop after the frame rate stays under the floor for `window` seconds. */
export class FrameRateMonitor {
  private below = 0;
  constructor(
    private readonly floorFps: number,
    private readonly windowSeconds = 3,
  ) {}

  /** Feed one frame's duration; returns true when the tier should drop (then starts measuring afresh). */
  frame(dt: number): boolean {
    if (dt <= 0) return false;
    const fps = 1 / dt;
    this.below = fps < this.floorFps ? this.below + dt : 0;
    if (this.below >= this.windowSeconds) {
      this.below = 0;
      return true;
    }
    return false;
  }
}

/** Desktop downgrades below 55 fps, touch devices below 26 fps (KTD5). */
export function floorFpsFor(coarsePointer: boolean): number {
  return coarsePointer ? 26 : 55;
}
