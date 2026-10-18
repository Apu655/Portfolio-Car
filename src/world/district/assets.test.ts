// The built models (public/models/*.glb) must expose the node and material names the runtime looks up.
// Reads each file's glTF JSON chunk directly, so no decoder or WebGL is needed.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAMPUS, PROJECTS_HALL, ROADSIDE_FRAME, ROBOT } from './layout';

interface GltfNode {
  name?: string;
  children?: number[];
  mesh?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
}

interface GltfJson {
  nodes: GltfNode[];
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  accessors?: Array<{ min?: number[]; max?: number[]; normalized?: boolean; componentType: number }>;
}

function readJson(name: string): GltfJson {
  const buffer = readFileSync(resolve(process.cwd(), 'public/models', `${name}.glb`));
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8')) as GltfJson;
}

function gltf(name: string): { nodes: Set<string>; materials: Set<string> } {
  const json = readJson(name);
  return {
    nodes: new Set(json.nodes.map((n) => n.name ?? '')),
    materials: new Set((json.materials ?? []).map((m) => m.name ?? '')),
  };
}

type Mat4 = number[]; // column-major, as glTF stores it

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
  return out;
}

function local(node: GltfNode): Mat4 {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/** Undo KHR_mesh_quantization's normalized integer storage for an accessor bound. */
function dequantize(value: number, componentType: number, normalized?: boolean): number {
  if (!normalized) return value;
  const scale = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[componentType] ?? 1;
  return Math.max(value / scale, -1);
}

/**
 * Axis-aligned bounds of a node's meshes in the node's own frame (its own transform left out), from the POSITION
 * accessors' min/max and the node transforms beneath it, which carry the meshopt dequantization offset and scale.
 */
function bounds(json: GltfJson, rootName: string): { min: number[]; max: number[] } {
  const root = json.nodes.findIndex((n) => n.name === rootName);
  expect(root, rootName).toBeGreaterThanOrEqual(0);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visit = (index: number, world: Mat4) => {
    const node = json.nodes[index];
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes![node.mesh].primitives) {
        const accessor = json.accessors![primitive.attributes.POSITION];
        const lo = accessor.min!.map((v) => dequantize(v, accessor.componentType, accessor.normalized));
        const hi = accessor.max!.map((v) => dequantize(v, accessor.componentType, accessor.normalized));
        for (let corner = 0; corner < 8; corner++) {
          const p = [corner & 1 ? hi[0] : lo[0], corner & 2 ? hi[1] : lo[1], corner & 4 ? hi[2] : lo[2]];
          for (let axis = 0; axis < 3; axis++) {
            const v = world[axis] * p[0] + world[4 + axis] * p[1] + world[8 + axis] * p[2] + world[12 + axis];
            min[axis] = Math.min(min[axis], v);
            max[axis] = Math.max(max[axis], v);
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child, multiply(world, local(json.nodes[child])));
  };
  visit(root, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { min, max };
}

/** Expect a bound to land on its layout value within the tolerance. */
function near(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`).toBeLessThanOrEqual(0.5);
}

/** Local (x, z) footprint of a building built facing north and turned to `facing` in the world. */
function localFootprint(size: [number, number], facing: number): [number, number] {
  return Math.abs(Math.sin(facing)) > 0.5 ? [size[1], size[0]] : size;
}

describe('built models expose the runtime contract', () => {
  it('car: body, four wheel hubs, headlight markers, and driven light materials', () => {
    const car = gltf('car');
    for (const node of ['body', 'wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR', 'light_head_L', 'light_head_R']) {
      expect(car.nodes.has(node), node).toBe(true);
    }
    for (const material of ['headlight', 'brakelight', 'reverselight', 'car_paint']) expect(car.materials.has(material), material).toBe(true);
  });

  it('billboard: one node per letter of APU ISLAM (8 letters, no space)', () => {
    const billboard = gltf('billboard');
    for (let i = 0; i < 8; i++) expect(billboard.nodes.has(`letter_${i}`)).toBe(true);
    expect(billboard.nodes.has('letter_8')).toBe(false);
    expect(billboard.materials.has('billboard_bulb')).toBe(true);
  });

  it('kiosks: only the Contact kiosk with its glow material, plus the five section gates', () => {
    const kiosks = gltf('kiosks');
    expect(kiosks.nodes.has('kiosk_contact')).toBe(true);
    expect(kiosks.materials.has('kiosk_glow_contact')).toBe(true);
    for (const section of ['experience', 'research', 'projects', 'education', 'contact']) expect(kiosks.nodes.has(`gate_${section}`), section).toBe(true);
    expect([...kiosks.nodes].filter((n) => n.startsWith('kiosk_') && !n.startsWith('kiosk_contact'))).toEqual([]);
    expect([...kiosks.materials].filter((m) => m.startsWith('kiosk_glow_') && m !== 'kiosk_glow_contact')).toEqual([]);
    expect(kiosks.nodes.has('city_gate')).toBe(false);
  });

  it('landmarks: the robot and its joints, the campus, the Projects Hall, and the roadside billboard frame', () => {
    const landmarks = gltf('landmarks');
    for (const node of ['robot', 'robot_head', 'robot_arm_l', 'robot_arm_r', 'campus', 'projects_hall', 'roadside_billboard']) {
      expect(landmarks.nodes.has(node), node).toBe(true);
    }
    for (const material of ['robot_eye', 'robot_screen', 'hall_window_lit', 'campus_window_lit', 'roadside_lamp']) {
      expect(landmarks.materials.has(material), material).toBe(true);
    }
  });

  it('landmarks: each model fills its layout footprint within 0.5 m', () => {
    const json = readJson('landmarks');

    const robot = bounds(json, 'robot');
    near(robot.min[1], 0, 'robot bottom');
    near(robot.max[1], ROBOT.height, 'robot top');
    for (const axis of [0, 2]) {
      expect(Math.max(-robot.min[axis], robot.max[axis]), 'robot footprint').toBeLessThanOrEqual(ROBOT.radius + 0.5);
    }

    for (const [name, spec] of [['projects_hall', PROJECTS_HALL], ['campus', CAMPUS]] as const) {
      const box = bounds(json, name);
      const [width, depth] = localFootprint(spec.size, spec.facing);
      near(box.min[0], -width / 2, `${name} west`);
      near(box.max[0], width / 2, `${name} east`);
      near(box.min[2], -depth / 2, `${name} front`);
      near(box.max[2], depth / 2, `${name} back`);
      near(box.min[1], 0, `${name} bottom`);
      near(box.max[1], 'towerHeight' in spec ? spec.towerHeight : spec.height, `${name} top`);
    }

    const board = bounds(json, 'roadside_billboard');
    near(board.min[0], -ROADSIDE_FRAME.width / 2, 'billboard left');
    near(board.max[0], ROADSIDE_FRAME.width / 2, 'billboard right');
    near(board.min[1], 0, 'billboard bottom');
    near(board.max[1], ROADSIDE_FRAME.centerY + (ROADSIDE_FRAME.height / 2) * Math.cos(ROADSIDE_FRAME.tilt), 'billboard top');
  });

  it('district: a drivable ground collider and night-lit streetlights', () => {
    const district = gltf('district');
    expect(district.nodes.has('collider_mesh_ground')).toBe(true);
    expect(district.materials.has('street_lamp')).toBe(true);
  });

  it('career tower: night-lit windows and crown', () => {
    const tower = gltf('career_tower');
    expect(tower.materials.has('tower_window_lit')).toBe(true);
    expect(tower.materials.has('tower_crown_glow')).toBe(true);
  });

  it('props and backdrop buildings: every kind and variant the layout uses', () => {
    const props = gltf('props');
    for (const kind of ['cone', 'crate', 'barrel', 'sign', 'bench', 'brick']) expect(props.nodes.has(`prop_${kind}`), kind).toBe(true);
    const buildings = gltf('buildings');
    for (let i = 0; i < 4; i++) expect(buildings.nodes.has(`building_${i}`)).toBe(true);
    expect(buildings.materials.has('building_window_lit')).toBe(true);
  });
});
