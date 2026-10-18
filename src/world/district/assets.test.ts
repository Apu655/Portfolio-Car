// The built models (public/models/*.glb) must expose the node and material names the runtime looks up.
// Reads each file's glTF JSON chunk directly, so no decoder or WebGL is needed.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KIOSKS } from './layout';

interface GltfJson {
  nodes: Array<{ name?: string }>;
  materials?: Array<{ name?: string }>;
}

function gltf(name: string): { nodes: Set<string>; materials: Set<string> } {
  const buffer = readFileSync(resolve(process.cwd(), 'public/models', `${name}.glb`));
  const length = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + length).toString('utf8')) as GltfJson;
  return {
    nodes: new Set(json.nodes.map((n) => n.name ?? '')),
    materials: new Set((json.materials ?? []).map((m) => m.name ?? '')),
  };
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

  it('kiosks: one kiosk per stand-in section, each with its own glow material, plus the five section gates', () => {
    const kiosks = gltf('kiosks');
    for (const k of KIOSKS) {
      expect(kiosks.nodes.has(`kiosk_${k.section}`)).toBe(true);
      expect(kiosks.materials.has(`kiosk_glow_${k.section}`)).toBe(true);
    }
    for (const section of ['experience', 'research', 'projects', 'education', 'contact']) expect(kiosks.nodes.has(`gate_${section}`), section).toBe(true);
    expect(kiosks.nodes.has('city_gate')).toBe(false);
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
