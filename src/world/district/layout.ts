// The Career District plan as data. Single source of truth: the runtime reads it directly, and
// `npm run layout:export` writes it to JSON for the Blender scripts that model the district.
// Units are meters; +X east, +Z south, Y up. Headings: 0 faces -Z (north), positive turns left.
import { seededRandom } from '../../models/noise';
import type { TowerSection } from '../events';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const HEADING = { north: 0, west: Math.PI / 2, south: Math.PI, east: -Math.PI / 2 } as const;

/** Rounded-rectangle road loop plus one north–south cross street. */
export const ROADS = {
  loop: { halfX: 70, halfZ: 55, cornerRadius: 20 },
  width: 10,
  laneOffset: 2.5,
  sidewalk: 3,
  curbHeight: 0.15,
  crossStreetX: 0,
} as const;

export const WORLD_HALF = 105;

export interface Zone {
  section: TowerSection;
  name: string;
  center: Vec2;
  radius: number;
  /** Where fast travel parks the car (on the lane beside the zone) and which way it faces. */
  parking: { position: Vec2; heading: number };
  /** Point the camera frames while the panel is open. */
  focus: Vec3;
  accent: string;
}

export const TOWER = {
  center: [35, -18] as Vec2,
  halfSize: 11,
  height: 96,
  /** The entrance faces the cross street (west). */
  facing: HEADING.west,
};

const careerZone: Zone = {
  section: 'experience',
  name: 'Career Tower',
  center: [2.5, -18],
  radius: 6,
  parking: { position: [2.5, -14], heading: HEADING.north },
  focus: [TOWER.center[0], TOWER.height * 0.55, TOWER.center[1]],
  accent: '#e9b85a',
};

export const KIOSK_Z = -69;
const kioskZone = (section: TowerSection, name: string, x: number, accent: string): Zone => ({
  section,
  name,
  center: [x, -57.5],
  radius: 5.5,
  parking: { position: [x + 3, -57.5], heading: HEADING.west },
  focus: [x, 3, KIOSK_Z],
  accent,
});

/** Signpost kiosks along the north road stand in for the four other landmarks until M2. */
export const KIOSKS: Zone[] = [
  kioskZone('research', 'Research kiosk', 45, '#59c3d6'),
  kioskZone('projects', 'Projects kiosk', 15, '#e8875c'),
  kioskZone('education', 'Education kiosk', -15, '#8cc97f'),
  kioskZone('contact', 'Contact kiosk', -45, '#d77fb5'),
];

export const ZONES: Zone[] = [careerZone, ...KIOSKS];

export function zoneFor(section: TowerSection): Zone {
  return ZONES.find((z) => z.section === section)!;
}

/** The zone containing (x, z), if any. */
export function zoneAt(x: number, z: number): Zone | null {
  return ZONES.find((zone) => Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius) ?? null;
}

export const SPAWN = { position: [-40, 57.5] as Vec2, heading: HEADING.east };

/** Paved plazas (center x/z, size x/z): the tower forecourt, the prop plaza, and the kiosk promenade. */
export const PLAZAS = [
  { name: 'forecourt', center: [TOWER.center[0] - TOWER.halfSize - 8, TOWER.center[1]] as Vec2, size: [16, 26] as Vec2 },
  { name: 'props', center: [30, 35] as Vec2, size: [34, 20] as Vec2 },
  { name: 'kiosks', center: [0, KIOSK_Z] as Vec2, size: [120, 12] as Vec2 },
];

const inPlaza = (x: number, z: number, margin: number) =>
  PLAZAS.some((p) => Math.abs(x - p.center[0]) < p.size[0] / 2 + margin && Math.abs(z - p.center[1]) < p.size[1] / 2 + margin);

/** Shallow pond in the park (west half of the loop). */
export const POND = { center: [-35, -6] as Vec2, radiusX: 14, radiusZ: 10, depth: 0.7, shore: 3.5 };

/** Bulb-marquee name sign, ahead and to the right of the spawn point, turned toward the arriving car. */
export const BILLBOARD = {
  text: 'APU ISLAM',
  position: [8, 0, 76] as Vec3,
  rotationY: Math.atan2(SPAWN.position[0] - 8, SPAWN.position[1] - 76) * 0.75,
  width: 22,
  height: 13,
};

/** Brass city-gate arch spanning the north road between the kiosks; pillars stand on the two sidewalks. */
export const GATE = { x: -30, pillarsZ: [-48.5, -61.5] as Vec2, height: 8.5, pillarHalf: 0.8 };

/** Point on the pond surface ellipse test: >1 outside, <1 inside. */
export function pondNorm(x: number, z: number): number {
  return Math.hypot((x - POND.center[0]) / POND.radiusX, (z - POND.center[1]) / POND.radiusZ);
}

/** Water depth at (x, z): full depth in the middle, shelving up across the shore band. */
export function pondDepth(x: number, z: number): number {
  const n = pondNorm(x, z);
  const shoreStart = 1 - POND.shore / Math.min(POND.radiusX, POND.radiusZ);
  if (n >= 1) return 0;
  if (n <= shoreStart) return POND.depth;
  return POND.depth * ((1 - n) / (1 - shoreStart));
}

// ---------- Props, furniture, backdrop ----------

export type PropKind = 'cone' | 'crate' | 'sign' | 'bench' | 'brick' | 'barrel';

/** A physical prop at rest. `position` is the center of its bottom face. */
export interface PropPlacement {
  id: string;
  kind: PropKind;
  position: Vec3;
  rotationY: number;
}

const BRICK = { length: 0.9, height: 0.38, depth: 0.45 };

function brickWall(origin: Vec2, length: number, courses: number): PropPlacement[] {
  const bricks: PropPlacement[] = [];
  const perCourse = Math.floor(length / BRICK.length);
  for (let row = 0; row < courses; row++) {
    const offset = row % 2 === 0 ? 0 : BRICK.length / 2;
    for (let i = 0; i < perCourse - (row % 2); i++) {
      bricks.push({
        id: `brick-${row}-${i}`,
        kind: 'brick',
        position: [origin[0] + offset + i * BRICK.length + BRICK.length / 2, BRICK.height * row + 0.002, origin[1]],
        rotationY: 0,
      });
    }
  }
  return bricks;
}

export const BRICK_SIZE = BRICK;

export const PROPS: PropPlacement[] = (() => {
  const list: PropPlacement[] = [];
  // Cone slalom down the cross street.
  for (let i = 0; i < 8; i++) {
    list.push({ id: `cone-${i}`, kind: 'cone', position: [i % 2 === 0 ? -1.6 : 1.6, 0, 42 - i * 6], rotationY: 0 });
  }
  // Crate stack on the south-east plaza.
  const crates: Vec3[] = [
    [20, 0.5, 38], [21.1, 0.5, 38], [22.2, 0.5, 38], [20.55, 1.5, 38], [21.65, 1.5, 38], [21.1, 2.5, 38],
  ];
  crates.forEach((p, i) => list.push({ id: `crate-${i}`, kind: 'crate', position: p, rotationY: 0 }));
  // Barrels by the tower forecourt.
  [[16, -31], [17.4, -31.5], [16.6, -32.8]].forEach(([x, z], i) => list.push({ id: `barrel-${i}`, kind: 'barrel', position: [x, 0, z], rotationY: 0 }));
  // Street signs at the T-junctions and park benches.
  list.push({ id: 'sign-0', kind: 'sign', position: [7, 0, 47.5], rotationY: 0 });
  list.push({ id: 'sign-1', kind: 'sign', position: [-7, 0, -47.5], rotationY: Math.PI });
  [[-50, 8, 0.4], [-20, 8, -0.4], [-35, -22, Math.PI]].forEach(([x, z, r], i) =>
    list.push({ id: `bench-${i}`, kind: 'bench', position: [x, 0, z], rotationY: r }),
  );
  list.push(...brickWall([30, 30], 12, 5));
  return list;
})();

export interface StaticPlacement {
  position: Vec3;
  rotationY: number;
  scale: number;
  variant: number;
}

/** Point lies on a road's paved width (with optional margin). */
export function onRoad(x: number, z: number, margin = 0): boolean {
  const { halfX, halfZ, cornerRadius } = ROADS.loop;
  const ix = halfX - cornerRadius;
  const iz = halfZ - cornerRadius;
  const qx = Math.abs(x) - ix;
  const qz = Math.abs(z) - iz;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - cornerRadius;
  const half = ROADS.width / 2 + margin;
  if (Math.abs(d) <= half) return true;
  return Math.abs(x - ROADS.crossStreetX) <= half && Math.abs(z) <= halfZ;
}

export const TREES: StaticPlacement[] = (() => {
  const random = seededRandom(2026);
  const result: StaticPlacement[] = [];
  const blocked = (x: number, z: number) =>
    onRoad(x, z, 2.5) ||
    pondNorm(x, z) < 1.25 ||
    (Math.abs(x - TOWER.center[0]) < TOWER.halfSize + 6 && Math.abs(z - TOWER.center[1]) < TOWER.halfSize + 6) ||
    Math.hypot(x - BILLBOARD.position[0], z - BILLBOARD.position[2]) < 16 ||
    PROPS.some((p) => Math.hypot(x - p.position[0], z - p.position[2]) < 3) ||
    ZONES.some((zone) => Math.hypot(x - zone.center[0], z - zone.center[1]) < zone.radius + 3) ||
    inPlaza(x, z, 2.5);
  for (let i = 0; i < 260 && result.length < 90; i++) {
    const x = (random() * 2 - 1) * (WORLD_HALF - 18);
    const z = (random() * 2 - 1) * (WORLD_HALF - 18);
    if (blocked(x, z)) continue;
    result.push({ position: [x, 0, z], rotationY: random() * Math.PI * 2, scale: 0.85 + random() * 0.45, variant: Math.floor(random() * 3) });
  }
  return result;
})();

/** Streetlights along the loop's inner and outer sidewalks. */
export const LAMPS: StaticPlacement[] = (() => {
  const result: StaticPlacement[] = [];
  const { halfX, halfZ } = ROADS.loop;
  const off = ROADS.width / 2 + 1.2;
  for (let x = -40; x <= 40; x += 20) {
    result.push({ position: [x, 0, halfZ + off], rotationY: HEADING.north, scale: 1, variant: 0 });
    result.push({ position: [x + 10, 0, -halfZ + off], rotationY: HEADING.south, scale: 1, variant: 0 });
  }
  for (let z = -30; z <= 30; z += 20) {
    result.push({ position: [halfX + off, 0, z], rotationY: HEADING.west, scale: 1, variant: 0 });
    result.push({ position: [-halfX - off, 0, z + 10], rotationY: HEADING.east, scale: 1, variant: 0 });
  }
  return result.filter((l) => !ZONES.some((zone) => Math.hypot(l.position[0] - zone.center[0], l.position[2] - zone.center[1]) < zone.radius + 2));
})();

/** Backdrop buildings ringing the district (static, collidable). */
export const BUILDINGS: StaticPlacement[] = (() => {
  const random = seededRandom(77);
  const result: StaticPlacement[] = [];
  const add = (x: number, z: number, rotationY: number) =>
    result.push({ position: [x, 0, z], rotationY, scale: 0.9 + random() * 0.3, variant: Math.floor(random() * 4) });
  for (let x = -84; x <= 84; x += 24) {
    add(x, -94, HEADING.south);
    if (Math.abs(x - BILLBOARD.position[0]) > 26) add(x, 96, HEADING.north);
  }
  for (let z = -60; z <= 60; z += 24) {
    add(96, z, HEADING.west);
    add(-96, z, HEADING.east);
  }
  return result;
})();

/** Footprint half-size of each backdrop building variant, before per-instance scale. */
export const BUILDING_HALF = [7, 8, 6.5, 7.5];

/** The opening camera reveal: a sweep across the district that settles behind the car. */
export const REVEAL = [
  { position: [-90, 70, -90] as Vec3, target: [20, 20, 0] as Vec3 },
  { position: [70, 55, -60] as Vec3, target: [TOWER.center[0], 50, TOWER.center[1]] as Vec3 },
  { position: [60, 18, 80] as Vec3, target: [BILLBOARD.position[0], 8, BILLBOARD.position[2]] as Vec3 },
];
