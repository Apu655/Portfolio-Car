// Where the fixed-view camera stands (KTD2): a pure function of the car's position, the visitor's zoom, speed,
// viewport shape, and the arrival and panel blends. The camera always looks along VIEW (R1); only the distance
// and the point it frames change.
import { VIEW, type Vec2, type Vec3 } from '../district/layout';

export type { Vec3 };

/** Camera distance (m) along the fixed direction: the visitor's zoom range (R4). */
export const ZOOM = { min: 26, max: 110, default: 52 } as const;
/** Extra distance (m) at top speed, so more road ahead shows when driving fast (R6). */
export const SPEED_EXTRA = 12;
const TOP_SPEED = 26;
/** Opening framing: high and wide over the middle of the district (R7). */
export const ARRIVAL = { center: [0, 0] as Vec2, distance: 200 } as const;
/** An open panel frames its stop this much closer than the follow distance (R8)... */
const PANEL_SCALE = 0.75;
/** ...but never closer than this multiple of the stop's focus height, so a tall tower fits in view. */
const TALL_STOP_FACTOR = 1.25;
/** A jump larger than this (m) between frames is a teleport: cut, don't glide (KTD4). */
export const SNAP_DISTANCE = 15;
/** The look-at point sits this far above the ground so the car sits slightly low in frame. */
const TARGET_HEIGHT = 0.8;

/** Unit vector from the framed point toward the camera. */
export const TO_CAMERA: Vec3 = (() => {
  // Looking along `heading` (0 = north = -Z), so the camera sits on the opposite side, raised by `elevation`.
  const lookX = -Math.sin(VIEW.heading);
  const lookZ = -Math.cos(VIEW.heading);
  const flat = Math.cos(VIEW.elevation);
  return [-lookX * flat, Math.sin(VIEW.elevation), -lookZ * flat];
})();

export interface FramingInput {
  /** The point being followed (the car), in world space. */
  follow: Vec3;
  /** The visitor's zoom: a camera distance before speed and viewport adjustments. */
  zoom: number;
  /** Car speed (m/s, either direction). */
  speed: number;
  /** Viewport width / height. */
  aspect: number;
  /** 0 at the start of the opening, 1 when it hands over to driving; absent means done. */
  arrival?: number;
  /** An open stop's focus (ground position and height to aim at) and how far the camera has eased toward it (0..1). */
  panel?: { focus: Vec2; height: number; blend: number };
}

export interface Framing {
  position: Vec3;
  target: Vec3;
  distance: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
}

/** Portrait screens show less width, so they start farther out to show a comparable area (R12). */
export function viewportFactor(aspect: number): number {
  return aspect >= 1 ? 1 : Math.min(1.7, 1 / Math.sqrt(aspect));
}

export function shouldSnap(from: Vec3, to: Vec3): boolean {
  return Math.hypot(to[0] - from[0], to[2] - from[2]) > SNAP_DISTANCE;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function framing(input: FramingInput): Framing {
  const speedExtra = SPEED_EXTRA * Math.min(1, Math.abs(input.speed) / TOP_SPEED);
  let distance = clampZoom(input.zoom) * viewportFactor(input.aspect) + speedExtra;
  let fx = input.follow[0];
  let fy = TARGET_HEIGHT;
  let fz = input.follow[2];

  if (input.panel && input.panel.blend > 0) {
    const t = input.panel.blend;
    fx = lerp(fx, input.panel.focus[0], t);
    fy = lerp(fy, Math.max(TARGET_HEIGHT, input.panel.height), t);
    fz = lerp(fz, input.panel.focus[1], t);
    distance = lerp(distance, Math.max(distance * PANEL_SCALE, input.panel.height * TALL_STOP_FACTOR), t);
  }
  if (input.arrival !== undefined && input.arrival < 1) {
    const t = Math.max(0, input.arrival);
    fx = lerp(ARRIVAL.center[0], fx, t);
    fz = lerp(ARRIVAL.center[1], fz, t);
    // Zoom geometrically so the descent feels even from far to near.
    distance = ARRIVAL.distance * Math.pow(distance / ARRIVAL.distance, t);
  }

  const target: Vec3 = [fx, fy, fz];
  const position: Vec3 = [fx + TO_CAMERA[0] * distance, fy + TO_CAMERA[1] * distance, fz + TO_CAMERA[2] * distance];
  return { position, target, distance };
}
