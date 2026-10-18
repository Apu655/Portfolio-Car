// Ground contact shading (KTD6 of the golden-hour city plan): a small grayscale map of where buildings stand,
// softened so the ground darkens near every wall the way ambient occlusion would. Drawn once at load from the
// layout, so moving a block never needs a model rebuild, and sampled by the ground shaders.
import { CAMPUS, CONTACT_KIOSK, GATE_FRAME, gatePoint, PROJECTS_HALL, ROBOT, SECTION_GATES, TOWER, WORLD_HALF } from '../district/layout';

export interface Footprint {
  x: number;
  z: number;
  /** Half sizes along the footprint's own x and z, before `rotationY`. */
  hx: number;
  hz: number;
  rotationY: number;
}

/** Map size (pixels per side) and the world half-extent it covers (meters). */
export const MASK = { size: 256, half: WORLD_HALF + 5 } as const;

/** Box-blur radius (pixels) and passes: two passes of radius 2 fade a wall's shadow out over about 3 m. */
const BLUR_RADIUS = 2;
const BLUR_PASSES = 2;

/** 0..1 coverage per pixel, row-major with rows running along +Z. */
export function footprintMask(footprints: readonly Footprint[], size: number = MASK.size, half: number = MASK.half): Float32Array {
  const px = (2 * half) / size;
  let grid: Float32Array = new Float32Array(size * size);
  for (const f of footprints) {
    const cos = Math.cos(f.rotationY);
    const sin = Math.sin(f.rotationY);
    const reach = Math.hypot(f.hx, f.hz);
    const c0 = Math.max(0, Math.floor((f.x - reach + half) / px));
    const c1 = Math.min(size - 1, Math.ceil((f.x + reach + half) / px));
    const r0 = Math.max(0, Math.floor((f.z - reach + half) / px));
    const r1 = Math.min(size - 1, Math.ceil((f.z + reach + half) / px));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * px - half - f.x;
        const dz = (r + 0.5) * px - half - f.z;
        // Into the footprint's own frame (the inverse of a rotation about Y by rotationY).
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz) grid[r * size + c] = 1;
      }
    }
  }
  for (let pass = 0; pass < BLUR_PASSES; pass++) grid = blur(blur(grid, size, true), size, false);
  return grid;
}

function blur(src: Float32Array, size: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(size * size);
  const n = 2 * BLUR_RADIUS + 1;
  for (let a = 0; a < size; a++) {
    for (let b = 0; b < size; b++) {
      let sum = 0;
      for (let k = -BLUR_RADIUS; k <= BLUR_RADIUS; k++) {
        const t = Math.min(size - 1, Math.max(0, b + k));
        sum += horizontal ? src[a * size + t] : src[t * size + a];
      }
      if (horizontal) out[a * size + b] = sum / n;
      else out[b * size + a] = sum / n;
    }
  }
  return out;
}

/** Coverage at a world point, sampled bilinearly as the GPU would. */
export function maskAt(mask: Float32Array, x: number, z: number, size: number = MASK.size, half: number = MASK.half): number {
  const fx = ((x + half) / (2 * half)) * size - 0.5;
  const fz = ((z + half) / (2 * half)) * size - 0.5;
  const c = Math.max(0, Math.min(size - 2, Math.floor(fx)));
  const r = Math.max(0, Math.min(size - 2, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - c));
  const tz = Math.min(1, Math.max(0, fz - r));
  const at = (rr: number, cc: number) => mask[rr * size + cc];
  const top = at(r, c) * (1 - tx) + at(r, c + 1) * tx;
  const bottom = at(r + 1, c) * (1 - tx) + at(r + 1, c + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

/** The landmarks' footprints: they lose runtime ambient occlusion, so they need contact shading too. */
export function landmarkFootprints(): Footprint[] {
  const pillar = GATE_FRAME.pillarHalf;
  return [
    { x: TOWER.center[0], z: TOWER.center[1], hx: TOWER.halfSize, hz: TOWER.halfSize, rotationY: 0 },
    { x: PROJECTS_HALL.center[0], z: PROJECTS_HALL.center[1], hx: PROJECTS_HALL.size[0] / 2, hz: PROJECTS_HALL.size[1] / 2, rotationY: 0 },
    { x: CAMPUS.center[0], z: CAMPUS.center[1], hx: CAMPUS.size[0] / 2, hz: CAMPUS.size[1] / 2, rotationY: 0 },
    { x: CONTACT_KIOSK.position[0], z: CONTACT_KIOSK.position[1], hx: 1.7, hz: 0.8, rotationY: 0 },
    { x: ROBOT.position[0], z: ROBOT.position[1], hx: ROBOT.radius, hz: ROBOT.radius, rotationY: 0 },
    ...SECTION_GATES.flatMap((g) =>
      [-1, 1].map((side) => {
        const [x, z] = gatePoint(g, side * g.halfSpan, 0);
        return { x, z, hx: pillar, hz: pillar, rotationY: g.rotationY };
      }),
    ),
  ];
}
