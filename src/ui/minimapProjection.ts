// Projection for the corner minimap: the district drawn the way the fixed camera shows it, so "up" on the map is
// "up" on screen (north-east) and the screen-relative joystick and the map agree.
import { ROADS, VIEW } from '../world/district/layout';

/** Map width and height in SVG units. */
export const MAP_SIZE = 200;

const UP = [-Math.sin(VIEW.heading), -Math.cos(VIEW.heading)] as const;
const RIGHT = [-UP[1], UP[0]] as const;
/** How far past the road loop's outer edge the map reaches (m), so the kiosks and gates stay on it. */
const MARGIN = 16;
const EXTENT_X = ROADS.loop.halfX + ROADS.width / 2 + MARGIN;
const EXTENT_Z = ROADS.loop.halfZ + ROADS.width / 2 + MARGIN;
/** Map units per meter: the road loop and its surroundings fill the map. */
export const MAP_SCALE = (MAP_SIZE / 2 - 4) / Math.max(EXTENT_X * Math.abs(RIGHT[0]) + EXTENT_Z * Math.abs(RIGHT[1]), EXTENT_X * Math.abs(UP[0]) + EXTENT_Z * Math.abs(UP[1]));

/** World (x, z) to map (x, y), with y growing down. Points beyond the loop's surroundings fall off the map. */
export function toMap(x: number, z: number): [number, number] {
  return [MAP_SIZE / 2 + MAP_SCALE * (x * RIGHT[0] + z * RIGHT[1]), MAP_SIZE / 2 - MAP_SCALE * (x * UP[0] + z * UP[1])];
}

/** Clockwise rotation (degrees) of the car arrow for a car heading (layout convention: 0 north, + left). */
export function mapAngle(carHeading: number): number {
  const dx = -Math.sin(carHeading);
  const dz = -Math.cos(carHeading);
  return (Math.atan2(dx * RIGHT[0] + dz * RIGHT[1], dx * UP[0] + dz * UP[1]) * 180) / Math.PI;
}
