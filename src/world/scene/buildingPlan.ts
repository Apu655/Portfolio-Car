// City buildings (U5 of the golden-hour city plan), assembled at runtime at each block's exact size, after the
// look-dev's `building()` and `rooftop()`. Nothing is stretched: walls are boxes cut to the footprint and height,
// and the plinth, storefront band, awnings, cornice, parapet and rooftop props keep their modeled sizes. The wall
// shader (surfaceShaders.ts) draws the windows. These helpers only plan the parts and build their geometry, so
// they stay testable without a renderer; CityBuildings.tsx turns a plan into meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../models/noise';
import type { Building, Vec2, Vec3 } from '../district/layout';
import type { WallParams } from '../lighting/surfaceShaders';

/** Wall colors, indexed by a building's `palette`: limestone, sand, terracotta, brick, sage, slate blue. */
export const WALL_COLORS = ['#e3d6bf', '#d8c19a', '#c56e4c', '#a85a42', '#9fb08c', '#6f7f96'];
/** The roof color the wall shader paints on a wall box's top face. */
export const ROOF_COLOR = '#8a8379';
/** Section accents, for neon signs. */
export const NEON_ACCENTS = ['#59c3d6', '#d77fb5', '#e9b85a', '#8cc97f'];

/** Parapet height above the roof; a building's `height` is the parapet's top. */
export const PARAPET = 0.9;
const PARAPET_THICKNESS = 0.35;
/** Rooftop props keep this far in from the wall faces: the parapet plus a walkway. */
export const ROOF_MARGIN = 0.6;
/** Height of the brass line above the storefronts (the wall shader's storefronts end at 4.4 m). */
export const BAND_Y = 4.5;
const PLINTH = 0.7;
const CORNICE = { depth: 0.55, overhang: 0.4 };
/** Storefront bay width, as the wall shader divides each face. */
const BAY = 3.1;
/** Above this height a building steps back into a narrower upper volume, as the look-dev's tower does. */
const HIGH_RISE = 30;
/** The wall shader's floor grid: storefronts to 4.4 m, then 3.4 m floors. */
const FLOOR = { base: 4.4, height: 3.4 };

const COLORS = {
  plinth: '#8f8576',
  brass: '#c8984a',
  cream: '#efe6d3',
  steel: '#9aa1aa',
  fan: '#2b2f38',
  wood: '#8a5a36',
  planter: '#6d6358',
  glass: '#33505f',
  door: '#5a4636',
  awnings: ['#b4523a', '#2f6f73', '#d2a03f', '#5a6f3a'],
  leaves: [['#3f6f35', '#6f9c43'], ['#55833b', '#8db353'], ['#365f3f', '#5c8a52']],
};

export type PropKind = 'tank' | 'ac' | 'garden' | 'hut' | 'skylight';
const PROP_KINDS: PropKind[] = ['tank', 'ac', 'garden', 'hut', 'skylight'];

export interface Part {
  role: 'plinth' | 'band' | 'cornice' | 'parapet' | 'awning' | 'prop' | 'sign';
  shape: 'box' | 'cylinder' | 'cone' | 'sphere';
  /** Box: full sizes along x, y, z. Cylinder and cone: [radius, height, radius]. Sphere: [radius, radius, radius]. */
  size: Vec3;
  /** Center in the building's frame: on its footprint center at ground level, with world axes. */
  at: Vec3;
  /** Euler rotation (x, y, z), for awnings. */
  tilt?: Vec3;
  color: string;
  /** A second color the part fades to at its top (bushes). */
  top?: string;
  /** Rooftop props: which kind, and which placed prop the part belongs to. */
  prop?: PropKind;
  group?: number;
}

/** One wall box and the window-grid uniforms the wall shader draws on it. */
export interface WallVolume {
  size: Vec3;
  at: Vec3;
  wall: WallParams;
}

export interface BuildingPlan {
  /** The wall box, plus a setback upper volume on a high-rise. */
  walls: WallVolume[];
  /** Every other part: one merged, vertex-colored mesh. */
  parts: Part[];
  /** A section-accent blade sign and storefront strip, glowing at night, or null. */
  neon: { accent: number; parts: Part[] } | null;
  /** The top roof the props stand on: its height and half sizes. */
  roof: { y: number; half: Vec2 };
}

const box = (role: Part['role'], size: Vec3, at: Vec3, color: string): Part => ({ role, shape: 'box', size, at, color });

/** A cornice band under the roof line and a parapet ring above it, around a wall box of half sizes `half`. */
function crown([hx, hz]: Vec2, roofY: number): Part[] {
  const { depth, overhang: o } = CORNICE;
  const cy = roofY + 0.05 - depth / 2;
  const t = PARAPET_THICKNESS;
  const py = roofY + PARAPET / 2;
  // Ring pieces never overlap, so no two top faces share a plane over the same ground.
  return [
    box('cornice', [hx * 2 + o * 2, depth, o], [0, cy, -hz - o / 2], COLORS.cream),
    box('cornice', [hx * 2 + o * 2, depth, o], [0, cy, hz + o / 2], COLORS.cream),
    box('cornice', [o, depth, hz * 2], [-hx - o / 2, cy, 0], COLORS.cream),
    box('cornice', [o, depth, hz * 2], [hx + o / 2, cy, 0], COLORS.cream),
    box('parapet', [hx * 2, PARAPET, t], [0, py, -hz + t / 2], COLORS.cream),
    box('parapet', [hx * 2, PARAPET, t], [0, py, hz - t / 2], COLORS.cream),
    box('parapet', [t, PARAPET, hz * 2 - t * 2], [-hx + t / 2, py, 0], COLORS.cream),
    box('parapet', [t, PARAPET, hz * 2 - t * 2], [hx - t / 2, py, 0], COLORS.cream),
  ];
}

/** A rooftop prop at its modeled size, centered on the ground point (0, 0) of its footprint, and that footprint's half sizes. */
function propParts(kind: PropKind, random: () => number): { parts: Part[]; half: Vec2 } {
  const part = (shape: Part['shape'], size: Vec3, at: Vec3, color: string, top?: string): Part => ({ role: 'prop', shape, size, at, color, top, prop: kind });
  switch (kind) {
    case 'tank': {
      // A timber water tank on steel legs under a cone roof: 3.8 m tall, below the occluders' rooftop allowance.
      const legs = [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].map(([x, z]) => part('box', [0.15, 1.1, 0.15], [x, 0.55, z], COLORS.fan));
      return { parts: [...legs, part('cylinder', [1.2, 2, 1.2], [0, 2.1, 0], COLORS.wood), part('cone', [1.35, 0.7, 1.35], [0, 3.45, 0], COLORS.fan)], half: [1.35, 1.35] };
    }
    case 'ac':
      return {
        parts: [-1.6, 0, 1.6].flatMap((x) => [part('box', [1.3, 0.9, 1.7], [x, 0.45, 0], COLORS.steel), part('cylinder', [0.45, 0.06, 0.45], [x, 0.93, 0], COLORS.fan)]),
        half: [2.25, 0.85],
      };
    case 'garden': {
      const bushes = [-1.75, -0.875, 0, 0.875, 1.75].map((x) => {
        const r = 0.45 + random() * 0.3;
        const leaves = COLORS.leaves[Math.floor(random() * COLORS.leaves.length)];
        return part('sphere', [r, r, r], [x, 0.6 + r * 0.55, (random() - 0.5) * (1.5 - r) * 2 * 0.8], leaves[0], leaves[1]);
      });
      return { parts: [part('box', [5, 0.6, 3], [0, 0.3, 0], COLORS.planter), ...bushes], half: [2.5, 1.5] };
    }
    case 'hut':
      // A stair hut with its door on its +z side.
      return { parts: [part('box', [3, 2.6, 3], [0, 1.3, 0], COLORS.cream), part('box', [0.9, 2, 0.06], [0.6, 1, 1.53], COLORS.door)], half: [1.5, 1.56] };
    case 'skylight':
      return { parts: [part('box', [3.5, 0.6, 2.2], [0, 0.3, 0], COLORS.glass)], half: [1.75, 1.1] };
  }
}

/** Swap a prop's x and z (a quarter turn of a footprint symmetric about both axes). */
const turned = (p: Part): Part => ({ ...p, size: [p.size[2], p.size[1], p.size[0]], at: [p.at[2], p.at[1], p.at[0]] });

/** Two or three seeded props on a roof of half sizes `half` at height `y`, kept `ROOF_MARGIN` in from its edges. */
function rooftop(half: Vec2, y: number, index: number): Part[] {
  // Kinds come from their own stream, so a building keeps its props whatever its height or roof size.
  const pick = seededRandom(index * 7919 + 11);
  const place = seededRandom(index * 104729 + 3);
  const kinds = [...PROP_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const count = 2 + Math.floor(pick() * 2);
  const room: Vec2 = [half[0] - ROOF_MARGIN, half[1] - ROOF_MARGIN];
  const taken: Array<{ x: number; z: number; half: Vec2 }> = [];
  const parts: Part[] = [];
  for (const kind of kinds) {
    if (taken.length >= count) break;
    const prop = propParts(kind, place);
    // Turn a prop a quarter if that fits the roof better.
    const turn = (room[0] - prop.half[0] < 0 || room[1] - prop.half[1] < 0) && room[0] - prop.half[1] >= 0 && room[1] - prop.half[0] >= 0;
    const ph: Vec2 = turn ? [prop.half[1], prop.half[0]] : prop.half;
    const free: Vec2 = [room[0] - ph[0], room[1] - ph[1]];
    if (free[0] < 0 || free[1] < 0) continue;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = (place() * 2 - 1) * free[0];
      const z = (place() * 2 - 1) * free[1];
      if (taken.some((t) => Math.abs(t.x - x) < t.half[0] + ph[0] + 0.4 && Math.abs(t.z - z) < t.half[1] + ph[1] + 0.4)) continue;
      const group = taken.length;
      taken.push({ x, z, half: ph });
      for (const p of prop.parts) {
        const q = turn ? turned(p) : p;
        parts.push({ ...q, at: [q.at[0] + x, q.at[1] + y, q.at[2] + z], group });
      }
      break;
    }
  }
  return parts;
}

/** Height of a setback's lower wall top: near `target`, placed so its top window row ends cleanly. */
function setbackTop(target: number): number {
  // The wall shader stops window rows 1.6 m under a wall's top; 9.0 + 3.4k falls between two rows.
  return 9 + FLOOR.height * Math.max(0, Math.round((target - 9) / FLOOR.height));
}

/**
 * Every part of building `index`: walls cut to its footprint and height, the street-level details, the crown,
 * rooftop props, and on a few camera-facing storefronts a neon sign. Seeded by index alone.
 */
export function buildingPlan(b: Building, index: number): BuildingPlan {
  const random = seededRandom(index * 2654435761 + 1);
  const [hx, hz] = b.half;
  const roofY = b.height - PARAPET;
  const wall = (half: Vec2, bottom: number, top: number): WallVolume => ({
    size: [half[0] * 2, top - bottom, half[1] * 2],
    at: [0, (bottom + top) / 2, 0],
    // The records hold world-axis half sizes, so the shader's building frame is the world's (rotationY 0).
    wall: { origin: [b.center[0], b.center[1]], half: [half[0], half[1]], rotationY: 0, top, seed: (index * 37.31) % 100, roof: ROOF_COLOR },
  });

  const parts: Part[] = [
    box('plinth', [hx * 2 + 0.3, PLINTH, hz * 2 + 0.3], [0, PLINTH / 2, 0], COLORS.plinth),
    box('band', [hx * 2 + 0.2, 0.22, hz * 2 + 0.2], [0, BAND_Y, 0], COLORS.brass),
  ];

  // A high-rise steps back above a lower volume, when its footprint leaves the upper one room for props.
  const stepped = b.height > HIGH_RISE && Math.min(hx, hz) >= 4;
  let walls: WallVolume[];
  let roof: BuildingPlan['roof'];
  if (stepped) {
    const lower = setbackTop(b.height * 0.55);
    const upper: Vec2 = [hx * 0.65, hz * 0.65];
    walls = [wall(b.half, 0, lower), wall(upper, lower, roofY)];
    parts.push(...crown(b.half, lower), ...crown(upper, roofY));
    roof = { y: roofY, half: upper };
  } else {
    walls = [wall(b.half, 0, roofY)];
    parts.push(...crown(b.half, roofY));
    roof = { y: roofY, half: b.half };
  }

  // The front faces along rotationY (HEADING convention: 0 faces -Z). Its tangent runs across the storefronts.
  const front: Vec2 = [Math.round(-Math.sin(b.rotationY)), Math.round(-Math.cos(b.rotationY))];
  const alongX = front[1] !== 0;
  const width = alongX ? hx * 2 : hz * 2;
  const reach = alongX ? hz : hx;
  /** A point in the building's frame, `out` metres in front of the front face and `across` along it. */
  const onFront = (across: number, y: number, out: number): Vec3 =>
    alongX ? [across, y, front[1] * (reach + out)] : [front[0] * (reach + out), y, across];
  const sized = (across: number, y: number, out: number): Vec3 => (alongX ? [across, y, out] : [out, y, across]);

  // Awnings over the storefront bays, the bays the wall shader draws; a few bays are left bare.
  const bays = Math.max(1, Math.round(width / BAY));
  const bay = width / bays;
  const fabric = COLORS.awnings[Math.floor(random() * COLORS.awnings.length)];
  const slope = 0.32;
  // Tilted so the outer edge hangs lower, about the tangent axis.
  const tilt: Vec3 = alongX ? [front[1] * slope, 0, 0] : [0, 0, -front[0] * slope];
  for (let i = 0; i < bays; i++) {
    if (random() < 0.3 && bays > 1) continue;
    parts.push({ ...box('awning', sized(bay * 0.86, 0.08, 0.6), onFront(-width / 2 + bay * (i + 0.5), 3.9, 0.28), fabric), tilt });
  }

  // Neon on every fifth building whose front faces the camera (south or west, the camera looking north-east),
  // where it can be seen; their storefronts stand on the far side of each road from the camera.
  const facesCamera = front[1] > 0 || front[0] < 0;
  const blade = Math.min(8.9, (stepped ? walls[0].size[1] : roofY) - 0.7);
  let neon: BuildingPlan['neon'] = null;
  if (facesCamera && index % 5 === 0 && blade - 5.4 >= 1.5) {
    const accent = (index / 5) % NEON_ACCENTS.length;
    const color = NEON_ACCENTS[accent];
    neon = {
      accent,
      parts: [
        // A blade sign standing out from the face near one end, above the brass line.
        box('sign', sized(0.14, blade - 5.4, 0.55), onFront(width / 2 - Math.min(1.4, width * 0.15), (5.4 + blade) / 2, 0.305), color),
        // A strip along the storefront, just above the brass line.
        box('sign', sized(width * 0.55, 0.2, 0.08), onFront(0, 4.95, 0.1), color),
      ],
    };
  }

  parts.push(...rooftop(roof.half, roof.y, index));
  return { walls, parts, neon, roof };
}

/** One part's geometry, placed in the building's frame, with its color in a vertex attribute. */
export function partGeometry(part: Part): THREE.BufferGeometry {
  const [sx, sy, sz] = part.size;
  const g =
    part.shape === 'box'
      ? new THREE.BoxGeometry(sx, sy, sz)
      : part.shape === 'cylinder'
        ? new THREE.CylinderGeometry(sx, sx, sy, 16)
        : part.shape === 'cone'
          ? new THREE.ConeGeometry(sx, sy, 16)
          : new THREE.SphereGeometry(sx, 9, 6);
  g.deleteAttribute('uv');
  if (part.tilt) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...part.tilt)));
  g.translate(...part.at);
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(part.color);
  const top = part.top ? new THREE.Color(part.top) : null;
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    // Bushes: darker underneath, lighter on top.
    const t = top ? THREE.MathUtils.clamp((position.getY(i) - part.at[1]) / sy / 2 + 0.5, 0, 1) : 0;
    c.copy(base);
    if (top) c.lerp(top, t * t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** A building's parts merged into one geometry, drawn with one vertex-colored material. */
export function mergeParts(parts: Part[]): THREE.BufferGeometry {
  const pieces = parts.map(partGeometry);
  const merged = mergeGeometries(pieces)!;
  pieces.forEach((g) => g.dispose());
  return merged;
}

const neonMaterials = new Map<number, THREE.MeshStandardMaterial>();

/** The shared emissive material of neon accent `accent`; `NIGHT_GLOW` brightens `neon_` materials at night. */
export function neonMaterial(accent: number): THREE.MeshStandardMaterial {
  let material = neonMaterials.get(accent);
  if (!material) {
    const color = NEON_ACCENTS[accent];
    material = new THREE.MeshStandardMaterial({ name: `neon_${accent}`, color, emissive: color, emissiveIntensity: 0.3, roughness: 0.4 });
    neonMaterials.set(accent, material);
  }
  return material;
}
