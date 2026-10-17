// The city plan as data: roads, blocks, lots, landmark sites, trees, lights, and colliders.
// Pure (no three.js): the scene renders from it, the car collides against it, tests check it.
import { seededRandom } from '../../models/noise';
import type { Section } from '../../state/route';

export type Vec2 = [number, number];
export type TowerSection = Exclude<Section, 'about'>;

/** Boulevard loop: a rounded square around downtown. */
export const LOOP = {
  /** Half-size of the loop's centerline. */
  half: 160,
  width: 18,
  cornerRadius: 34,
} as const;

export const STREET = { width: 12, positions: [-80, 0, 80] } as const;
export const SIDEWALK = 4;
/** The car can't leave this square. */
export const WORLD_HALF = 270;

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Building extends Box {
  height: number;
  /** 0..1, picks the facade palette. */
  tint: number;
}

export interface TowerSite {
  section: TowerSection;
  name: string;
  /** Accent color for its entrance zone and label. */
  accent: string;
  /** Point on the boulevard centerline the tower faces. */
  roadPoint: Vec2;
  /** Unit vector from the road toward the tower (always the outer side of the loop). */
  outward: Vec2;
  center: Vec2;
  /** Half extents of the tower's ground footprint. */
  halfSize: number;
  height: number;
  /** Center of the interaction zone at the curb. */
  entrance: Vec2;
  /** Where fast travel parks the car, and which way it faces (loop driving direction). */
  parking: { position: Vec2; heading: number };
}

export const ENTRANCE_RADIUS = 8;
/** Distance from the boulevard centerline to the outer lane and to the zone center. */
const OUTER_LANE = 4.5;
const ZONE_OFFSET = 6;
const TOWER_SETBACK = 50;

/** Heading (0 faces -Z) for driving counterclockwise around the loop on each side. */
const HEADING = { east: -Math.PI / 2, north: 0, west: Math.PI / 2, south: Math.PI } as const;

function site(
  section: TowerSection,
  name: string,
  accent: string,
  roadPoint: Vec2,
  outward: Vec2,
  heading: number,
  halfSize: number,
  height: number,
): TowerSite {
  const at = (d: number): Vec2 => [roadPoint[0] + outward[0] * d, roadPoint[1] + outward[1] * d];
  return {
    section,
    name,
    accent,
    roadPoint,
    outward,
    center: at(TOWER_SETBACK),
    halfSize,
    height,
    entrance: at(ZONE_OFFSET),
    parking: { position: at(OUTER_LANE), heading },
  };
}

const H = LOOP.half;

/** In the order the boulevard passes them when driving from the spawn point. */
export const TOWERS: TowerSite[] = [
  site('experience', 'MetLife Career Tower', '#e8b04a', [0, H], [0, 1], HEADING.east, 13, 112),
  site('research', 'AI Research Tower', '#3fd0ff', [H, 40], [1, 0], HEADING.north, 14, 128),
  site('projects', 'Projects Tower', '#ff7a59', [70, -H], [0, -1], HEADING.west, 15, 96),
  site('education', 'Education Tower', '#8fd694', [-70, -H], [0, -1], HEADING.west, 17, 90),
  site('contact', 'Contact Tower', '#ff5fb4', [-H, 40], [-1, 0], HEADING.south, 9, 100),
];

export function towerFor(section: TowerSection): TowerSite {
  return TOWERS.find((t) => t.section === section)!;
}

/** Spawn on the south boulevard, outer lane, heading east with the Career Tower ahead on the right. */
export const SPAWN: { position: Vec2; heading: number } = { position: [-118, H + OUTER_LANE], heading: HEADING.east };

/** The tower whose entrance zone contains (x, z), if any. */
export function towerAtZone(x: number, z: number): TowerSite | null {
  for (const t of TOWERS) {
    if (Math.hypot(x - t.entrance[0], z - t.entrance[1]) <= ENTRANCE_RADIUS) return t;
  }
  return null;
}

/** Signed distance from (x, z) to the loop centerline (a rounded square). */
export function distanceToLoop(x: number, z: number): number {
  const r = LOOP.cornerRadius;
  const inner = LOOP.half - r;
  const qx = Math.abs(x) - inner;
  const qz = Math.abs(z) - inner;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qz), 0);
  return outside + inside - r;
}

/** True when (x, z) is on the boulevard's paved width. */
export function onBoulevard(x: number, z: number, margin = 0): boolean {
  return Math.abs(distanceToLoop(x, z)) <= LOOP.width / 2 + margin;
}

/** True when (x, z) is on one of the downtown streets (inside the loop). */
export function onStreet(x: number, z: number, margin = 0): boolean {
  if (distanceToLoop(x, z) > 0) return false;
  const half = STREET.width / 2 + margin;
  return STREET.positions.some((p) => Math.abs(x - p) <= half || Math.abs(z - p) <= half);
}

// ---------- Blocks and lots ----------

export interface Block extends Box {
  /** Parks get trees instead of buildings. */
  park: boolean;
}

function intervals(): Array<[number, number]> {
  const edges = [-H, ...STREET.positions, H];
  const result: Array<[number, number]> = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i] + (i === 0 ? LOOP.width / 2 : STREET.width / 2);
    const hi = edges[i + 1] - (i === edges.length - 2 ? LOOP.width / 2 : STREET.width / 2);
    result.push([lo, hi]);
  }
  return result;
}

/** Downtown blocks (curb to curb), inside the loop. */
export const BLOCKS: Block[] = (() => {
  const result: Block[] = [];
  const spans = intervals();
  spans.forEach(([minX, maxX], ix) =>
    spans.forEach(([minZ, maxZ], iz) => {
      result.push({ minX, maxX, minZ, maxZ, park: ix === 1 && iz === 2 });
    }),
  );
  return result;
})();

/** Inside the loop's inner curb, with `margin` to spare. */
function insideLoop(x: number, z: number, margin: number): boolean {
  return distanceToLoop(x, z) <= -(LOOP.width / 2 + margin);
}

function boxInsideLoop(b: Box, margin: number): boolean {
  return (
    insideLoop(b.minX, b.minZ, margin) &&
    insideLoop(b.maxX, b.minZ, margin) &&
    insideLoop(b.minX, b.maxZ, margin) &&
    insideLoop(b.maxX, b.maxZ, margin)
  );
}

/** Filler buildings: each block's area inside its sidewalk, split into 2×2 lots. Taller toward the center. */
export const BUILDINGS: Building[] = (() => {
  const random = seededRandom(1907);
  const result: Building[] = [];
  for (const block of BLOCKS) {
    if (block.park) continue;
    const minX = block.minX + SIDEWALK + 1;
    const maxX = block.maxX - SIDEWALK - 1;
    const minZ = block.minZ + SIDEWALK + 1;
    const maxZ = block.maxZ - SIDEWALK - 1;
    const midX = (minX + maxX) / 2 + (random() - 0.5) * 8;
    const midZ = (minZ + maxZ) / 2 + (random() - 0.5) * 8;
    const xs: Array<[number, number]> = [
      [minX, midX - 1.5],
      [midX + 1.5, maxX],
    ];
    const zs: Array<[number, number]> = [
      [minZ, midZ - 1.5],
      [midZ + 1.5, maxZ],
    ];
    for (const [x0, x1] of xs) {
      for (const [z0, z1] of zs) {
        const inset = random() * 2.5;
        const lot: Box = { minX: x0 + inset, maxX: x1 - inset, minZ: z0 + inset, maxZ: z1 - inset };
        if (!boxInsideLoop(lot, SIDEWALK)) continue;
        const cx = (lot.minX + lot.maxX) / 2;
        const cz = (lot.minZ + lot.maxZ) / 2;
        const centrality = 1 - Math.min(1, Math.hypot(cx, cz) / (H * 1.1));
        const height = 12 + random() * 16 + centrality * centrality * 42 * (0.6 + random() * 0.4);
        result.push({ ...lot, height, tint: random() });
      }
    }
  }
  return result;
})();

// ---------- Street furniture ----------

export interface Prop {
  position: Vec2;
  /** Trees vary in size; lamps face the road. */
  scale: number;
  rotation: number;
}

function sampleLoop(spacing: number, offset: number): Array<{ position: Vec2; normal: Vec2 }> {
  // Walk the rounded square at `offset` from the centerline (positive = outward).
  const points: Array<{ position: Vec2; normal: Vec2 }> = [];
  const r = LOOP.cornerRadius;
  const inner = H - r;
  const sides: Array<{ from: Vec2; to: Vec2; normal: Vec2 }> = [
    { from: [-inner, H], to: [inner, H], normal: [0, 1] },
    { from: [H, inner], to: [H, -inner], normal: [1, 0] },
    { from: [inner, -H], to: [-inner, -H], normal: [0, -1] },
    { from: [-H, -inner], to: [-H, inner], normal: [-1, 0] },
  ];
  for (const side of sides) {
    const length = Math.hypot(side.to[0] - side.from[0], side.to[1] - side.from[1]);
    for (let d = spacing / 2; d < length; d += spacing) {
      const t = d / length;
      const x = side.from[0] + (side.to[0] - side.from[0]) * t + side.normal[0] * offset;
      const z = side.from[1] + (side.to[1] - side.from[1]) * t + side.normal[1] * offset;
      points.push({ position: [x, z], normal: side.normal });
    }
  }
  return points;
}

const nearTowerSite = (x: number, z: number, clearance: number) =>
  TOWERS.some((t) => Math.abs(x - t.center[0]) < t.halfSize + clearance && Math.abs(z - t.center[1]) < t.halfSize + clearance) ||
  TOWERS.some((t) => Math.hypot(x - t.entrance[0], z - t.entrance[1]) < ENTRANCE_RADIUS + 3);

export const STREETLIGHTS: Prop[] = [
  ...sampleLoop(34, LOOP.width / 2 + 1.2).map(({ position, normal }) => ({
    position,
    scale: 1,
    rotation: Math.atan2(normal[0], normal[1]) + Math.PI, // arm reaches over the road
  })),
  ...sampleLoop(34, -(LOOP.width / 2 + 1.2)).map(({ position, normal }) => ({
    position,
    scale: 1,
    rotation: Math.atan2(normal[0], normal[1]),
  })),
].filter((p) => !nearTowerSite(p.position[0], p.position[1], 0));

export const TREES: Prop[] = (() => {
  const random = seededRandom(77);
  const result: Prop[] = [];
  const add = (x: number, z: number, scale: number) => result.push({ position: [x, z], scale, rotation: random() * Math.PI * 2 });
  // Boulevard sidewalk trees, between the streetlights.
  for (const { position } of sampleLoop(17, LOOP.width / 2 + 2.6)) {
    if (!nearTowerSite(position[0], position[1], 2)) add(position[0], position[1], 0.85 + random() * 0.3);
  }
  // Park block and the green ring outside the loop.
  for (const block of BLOCKS.filter((b) => b.park)) {
    for (let i = 0; i < 26; i++) {
      add(block.minX + 6 + random() * (block.maxX - block.minX - 12), block.minZ + 6 + random() * (block.maxZ - block.minZ - 12), 0.9 + random() * 0.6);
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = (random() * 2 - 1) * (WORLD_HALF - 8);
    const z = (random() * 2 - 1) * (WORLD_HALF - 8);
    if (distanceToLoop(x, z) < LOOP.width / 2 + SIDEWALK + 6 || nearTowerSite(x, z, 10)) continue;
    add(x, z, 1 + random() * 0.7);
  }
  return result;
})();

// ---------- Colliders ----------

const TREE_HALF = 0.6;
const LAMP_HALF = 0.25;

/** Everything the car slides against. */
export const OBSTACLES: Box[] = [
  ...BUILDINGS.map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ })),
  ...TOWERS.map(({ center: [x, z], halfSize }) => ({ minX: x - halfSize, maxX: x + halfSize, minZ: z - halfSize, maxZ: z + halfSize })),
  ...TREES.map(({ position: [x, z] }) => ({ minX: x - TREE_HALF, maxX: x + TREE_HALF, minZ: z - TREE_HALF, maxZ: z + TREE_HALF })),
  ...STREETLIGHTS.map(({ position: [x, z] }) => ({ minX: x - LAMP_HALF, maxX: x + LAMP_HALF, minZ: z - LAMP_HALF, maxZ: z + LAMP_HALF })),
];

/** Tall things the chase camera must not pass through. */
export const CAMERA_BLOCKERS: Array<Box & { height: number }> = [
  ...BUILDINGS.map(({ minX, maxX, minZ, maxZ, height }) => ({ minX, maxX, minZ, maxZ, height })),
  ...TOWERS.map(({ center: [x, z], halfSize, height }) => ({ minX: x - halfSize, maxX: x + halfSize, minZ: z - halfSize, maxZ: z + halfSize, height })),
];

/** Angle used to check landmark order around the loop: 0 at the south side, increasing counterclockwise. */
export function loopAngle(x: number, z: number): number {
  const a = Math.atan2(x, z);
  return a < 0 ? a + Math.PI * 2 : a;
}
