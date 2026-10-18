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
  /** The item the stop opens, when it stands for one item rather than its whole section (the SeCAREly robot). */
  itemId?: string;
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

/**
 * The robot standing in the middle of the east road just past the Research gate (R7, R8). It turns toward the car
 * and greets it with SeCAREly text; its zone opens the SeCAREly paper.
 */
export const ROBOT = { position: [70, 22] as Vec2, radius: 1.1, height: 3.6, facing: HEADING.south };

/**
 * One building for all the projects, north of the north road (R10). `size` is its world footprint (x, z); the
 * model is built facing north at the origin and turned to `facing`. `sign` is the painted panel on its front:
 * the name band and a strip of project screenshots (width, height, height of its center).
 */
export const PROJECTS_HALL = {
  center: [12, -75] as Vec2,
  size: [18, 12] as Vec2,
  height: 12,
  facing: HEADING.south,
  sign: { width: 14, height: 4.6, centerY: 7.4 },
};

/** A small university-style hall east of the west road (R11); the clock tower rises to `towerHeight`. */
export const CAMPUS = {
  center: [-54, 12] as Vec2,
  size: [12, 16] as Vec2,
  height: 10,
  towerHeight: 16,
  facing: HEADING.west,
  sign: { width: 6.4, height: 1.3, centerY: 6.9 },
};

/** The Contact kiosk, north of the south road a little west of the start (R12). Its face looks south. */
export const CONTACT_KIOSK = { position: [-28, 46] as Vec2, accent: '#d77fb5' };

const robotZone: Zone = {
  section: 'research',
  name: 'SeCAREly robot',
  itemId: 'secarely',
  center: ROBOT.position,
  radius: 7,
  parking: { position: [67.5, 28], heading: HEADING.north },
  focus: [ROBOT.position[0], 2.4, ROBOT.position[1]],
  accent: '#59c3d6',
};

const projectsZone: Zone = {
  section: 'projects',
  name: 'Projects Hall',
  center: [PROJECTS_HALL.center[0], -57.5],
  radius: 6,
  parking: { position: [PROJECTS_HALL.center[0] + 3, -57.5], heading: HEADING.west },
  focus: [PROJECTS_HALL.center[0], 6, PROJECTS_HALL.center[1]],
  accent: '#e8875c',
};

const campusZone: Zone = {
  section: 'education',
  name: 'Campus',
  center: [-67.5, CAMPUS.center[1]],
  radius: 6,
  parking: { position: [-67.5, CAMPUS.center[1] - 4], heading: HEADING.south },
  focus: [CAMPUS.center[0], 5, CAMPUS.center[1]],
  accent: '#8cc97f',
};

const contactZone: Zone = {
  section: 'contact',
  name: 'Contact kiosk',
  center: [CONTACT_KIOSK.position[0], 52.5],
  radius: 5.5,
  parking: { position: [CONTACT_KIOSK.position[0] + 3, 52.5], heading: HEADING.east },
  focus: [CONTACT_KIOSK.position[0], 3, CONTACT_KIOSK.position[1]],
  accent: CONTACT_KIOSK.accent,
};

/** The stops after the Career Tower, one per section road. */
export const STOPS: Zone[] = [robotZone, projectsZone, campusZone, contactZone];

export const ZONES: Zone[] = [careerZone, ...STOPS];

export function zoneFor(section: TowerSection): Zone {
  return ZONES.find((z) => z.section === section)!;
}

/** The zone containing (x, z), if any. */
export function zoneAt(x: number, z: number): Zone | null {
  return ZONES.find((zone) => Math.hypot(x - zone.center[0], z - zone.center[1]) <= zone.radius) ?? null;
}

/** On the south road just past the Contact stop, so a counter-clockwise tour of the sections ends back here (R2). */
export const SPAWN = { position: [-18, 57.5] as Vec2, heading: HEADING.east };

/** Paved plazas (center x/z, size x/z): the tower forecourt, the prop plaza, and the Projects Hall forecourt. */
export const PLAZAS = [
  { name: 'forecourt', center: [TOWER.center[0] - TOWER.halfSize - 8, TOWER.center[1]] as Vec2, size: [16, 26] as Vec2 },
  { name: 'props', center: [30, 35] as Vec2, size: [34, 20] as Vec2 },
  { name: 'projects', center: [PROJECTS_HALL.center[0], -66] as Vec2, size: [20, 6] as Vec2 },
];

const inPlaza = (x: number, z: number, margin: number) =>
  PLAZAS.some((p) => Math.abs(x - p.center[0]) < p.size[0] / 2 + margin && Math.abs(z - p.center[1]) < p.size[1] / 2 + margin);

/** A small football pitch just inside the loop from the start, with a goal at each end (R11). */
export const PITCH = { center: [-32, 31] as Vec2, size: [24, 14] as Vec2, goal: { width: 4.2, height: 2, depth: 1.4 } };

/** Where the tech-stack footballs start: two rows of four across the middle of the pitch. */
export const FOOTBALLS: Vec2[] = [-1, 1].flatMap((row) => [-1.5, -0.5, 0.5, 1.5].map((col): Vec2 => [PITCH.center[0] + col * 3.2, PITCH.center[1] + row * 2.4]));

const onPitch = (x: number, z: number, margin: number) =>
  Math.abs(x - PITCH.center[0]) < PITCH.size[0] / 2 + margin && Math.abs(z - PITCH.center[1]) < PITCH.size[1] / 2 + margin;

/** Shallow pond in the park (west half of the loop). */
export const POND = { center: [-35, -6] as Vec2, radiusX: 14, radiusZ: 10, depth: 0.7, shore: 3.5 };

/**
 * The fixed camera view (KTD1 of the isometric camera plan): the camera always looks toward the north-east, from
 * the south-west, about 48° down. From here the Career Tower's west entrance and the kiosks' south faces show.
 */
export const VIEW = {
  /** Heading the camera looks along (same convention as HEADING): north-east. */
  heading: -Math.PI / 4,
  /** Angle below the horizon, radians. */
  elevation: (48 * Math.PI) / 180,
  /** Vertical field of view, degrees: narrow, for gentle perspective. */
  fov: 32,
} as const;

/** Bulb-marquee name sign, ahead and to the right of the spawn point, turned to face the fixed camera (R13). */
export const BILLBOARD = {
  text: 'APU ISLAM',
  position: [8, 0, 76] as Vec3,
  // Its face (local +Z) points back along the view, toward the camera.
  rotationY: VIEW.heading,
  width: 22,
  height: 13,
};

/** Map and gate letters for each section: W work experience, R research, P projects, E education, C contact. */
export const SECTION_LETTERS: Record<TowerSection, string> = { experience: 'W', research: 'R', projects: 'P', education: 'E', contact: 'C' };

/** Each section's gate header text. */
export const SECTION_TITLES: Record<TowerSection, string> = {
  experience: 'Work experience',
  research: 'Research',
  projects: 'Projects',
  education: 'Education',
  contact: 'Contact',
};

/**
 * Section gates: a stone-and-brass frame across the entrance of each section's road (R1, R3), carrying a lettered
 * header sign. Past the gate stand the section's billboards and its stop. Each gate's face (local +Z) points toward
 * the fixed camera's side of the road; its pillars stand on the sidewalks at local x = ±halfSpan.
 */
export interface SectionGate {
  section: TowerSection;
  center: Vec2;
  rotationY: number;
  halfSpan: number;
}

/** Gate geometry in the gate's own frame (meters; y up from the ground, x across the road, z toward the face). */
export const GATE_FRAME = {
  pillarHalf: 0.8,
  pillarHeight: 9.4,
  beamBottom: 6.2,
  beamTop: 9.4,
  /** Screens lean back (top away from the road) so the high fixed camera sees them nearly face-on. */
  screen: { width: 5.2, height: 2.9, centerY: 7.8, offsetX: 2.85, z: 0.95, tilt: (32 * Math.PI) / 180 },
  header: { width: 5.4, height: 1.3, centerY: 10.35, z: 0.45, tilt: (18 * Math.PI) / 180 },
} as const;

export const SECTION_GATES: SectionGate[] = [
  // Gates across north–south roads face south and those across east–west roads face west, toward the camera.
  { section: 'experience', center: [0, 40], rotationY: 0, halfSpan: 6.5 },
  { section: 'research', center: [70, 32], rotationY: 0, halfSpan: 6.5 },
  { section: 'projects', center: [40, -55], rotationY: -Math.PI / 2, halfSpan: 6.5 },
  { section: 'education', center: [-70, -30], rotationY: 0, halfSpan: 6.5 },
  { section: 'contact', center: [-48, 55], rotationY: -Math.PI / 2, halfSpan: 6.5 },
];

/** Which way a counter-clockwise tour drives along each section's road (unit vector on the ground, x/z). */
export const TRAVEL: Record<TowerSection, Vec2> = {
  experience: [0, -1],
  research: [0, -1],
  projects: [-1, 0],
  education: [0, 1],
  contact: [1, 0],
};

/**
 * Roadside billboard frame (KTD3), in the board's own frame: two posts carry a face that leans back so the high
 * fixed camera sees it nearly face-on. Every board turns to face the camera, like the name billboard.
 */
export const ROADSIDE_FRAME = {
  width: 7,
  height: 3.94,
  /** Height of the face's center above the ground. */
  centerY: 5.4,
  /** Lean back from vertical, top away from the camera. */
  tilt: (32 * Math.PI) / 180,
  postHalf: 0.22,
  /** Posts stand this far either side of the board's center, along its width. */
  postOffset: 2.6,
  rotationY: VIEW.heading,
} as const;

/**
 * Where each section's billboards stand (KTD2, KTD4): beside its road on the side away from the camera, after its
 * gate in the direction of travel. Slots pair in order with the section's showcase items; Research skips
 * SeCAREly (the robot carries it), Projects has none (the hall stands for them), and Contact's entries share one.
 */
export const ROADSIDE_BILLBOARDS: Record<TowerSection, Vec2[]> = {
  experience: [21, 13.5, 6, -1.5].map((z): Vec2 => [11, z]),
  research: [14, 5, -4, -13, -22, -31, -40, -49].map((z): Vec2 => [81, z]),
  projects: [],
  education: [-20, -10].map((z): Vec2 => [-58.5, z]),
  contact: [[-40, 44]],
};

/** Every billboard slot with a stable key, in section order. */
export const ROADSIDE_SLOTS = (Object.entries(ROADSIDE_BILLBOARDS) as Array<[TowerSection, Vec2[]]>).flatMap(([section, slots]) =>
  slots.map((position, index) => ({ key: `roadside-${section}-${index}`, section, index, position })),
);

/** World position of a point given in a billboard's own frame (x along its width, z toward its face). */
export function roadsidePoint(position: Vec2, x: number, z: number): Vec2 {
  const cos = Math.cos(ROADSIDE_FRAME.rotationY);
  const sin = Math.sin(ROADSIDE_FRAME.rotationY);
  return [position[0] + x * cos + z * sin, position[1] - x * sin + z * cos];
}

/** World position of a point given in a gate's own frame. */
export function gatePoint(gate: SectionGate, x: number, z: number): Vec2 {
  const cos = Math.cos(gate.rotationY);
  const sin = Math.sin(gate.rotationY);
  return [gate.center[0] + x * cos + z * sin, gate.center[1] - x * sin + z * cos];
}

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

const BRICK = { length: 0.6, height: 0.3, depth: 0.4 };

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
  [[-30, 14, 0.2], [-20, 8, -0.4], [-35, -22, Math.PI]].forEach(([x, z, r], i) =>
    list.push({ id: `bench-${i}`, kind: 'bench', position: [x, 0, z], rotationY: r }),
  );
  list.push(...brickWall([30, 30], 12, 6));
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

/** Ground points the section structures stand on, each with a clearance radius, for keeping trees and lamps away. */
const STRUCTURES: Array<{ at: Vec2; clear: number }> = [
  ...SECTION_GATES.flatMap((g) => [-1, 1].map((side) => ({ at: gatePoint(g, side * g.halfSpan, 0), clear: 3 }))),
  ...ROADSIDE_SLOTS.map((s) => ({ at: s.position, clear: ROADSIDE_FRAME.width / 2 + 2 })),
  { at: ROBOT.position, clear: ROBOT.radius + 3 },
  { at: PROJECTS_HALL.center, clear: Math.hypot(...PROJECTS_HALL.size) / 2 + 3 },
  { at: CAMPUS.center, clear: Math.hypot(...CAMPUS.size) / 2 + 3 },
  { at: CONTACT_KIOSK.position, clear: 4 },
];

const nearStructure = (x: number, z: number) => STRUCTURES.some((s) => Math.hypot(x - s.at[0], z - s.at[1]) < s.clear);

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
    inPlaza(x, z, 2.5) ||
    onPitch(x, z, 6) ||
    nearStructure(x, z);
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
  return result.filter(
    (l) => !ZONES.some((zone) => Math.hypot(l.position[0] - zone.center[0], l.position[2] - zone.center[1]) < zone.radius + 2) && !nearStructure(l.position[0], l.position[2]),
  );
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
/** Roof height of each backdrop building variant including its cap or crown, before per-instance scale. */
export const BUILDING_HEIGHT = [31, 46, 26, 37];

