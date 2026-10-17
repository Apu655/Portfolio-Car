import * as THREE from 'three';
import { PALETTE, glow } from './materials';
import { seededRandom } from './noise';

export const CITY = {
  /** Buildings stay inside this radius (the island's flat area). */
  radius: 100,
  /** Lot grid: a block plus the road beside it. */
  cell: 20,
  road: 6,
  /** Open plaza around the career tower. */
  plazaRadius: 36,
  maxHeight: 34,
} as const;

export interface CityBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  tint: number;
}

/** Deterministic city layout: each block is split into 1–4 buildings, taller toward the center. */
export function layoutCity(seed = 42): CityBuilding[] {
  const random = seededRandom(seed);
  const buildings: CityBuilding[] = [];
  const blockSize = CITY.cell - CITY.road;
  const cellsPerSide = Math.ceil(CITY.radius / CITY.cell);
  for (let gx = -cellsPerSide; gx < cellsPerSide; gx++) {
    for (let gz = -cellsPerSide; gz < cellsPerSide; gz++) {
      const cx = (gx + 0.5) * CITY.cell;
      const cz = (gz + 0.5) * CITY.cell;
      const distance = Math.hypot(cx, cz);
      if (distance + blockSize * 0.7 > CITY.radius || distance < CITY.plazaRadius) continue;
      const split = random() < 0.45 ? 1 : 2;
      const sub = blockSize / split;
      for (let ix = 0; ix < split; ix++) {
        for (let iz = 0; iz < split; iz++) {
          const centrality = 1 - distance / CITY.radius;
          const height = 5 + random() * 10 + centrality * centrality * (CITY.maxHeight - 15) * (0.5 + random() * 0.5);
          buildings.push({
            x: cx - blockSize / 2 + sub * (ix + 0.5),
            z: cz - blockSize / 2 + sub * (iz + 0.5),
            width: sub - 1.2 - random() * 1.5,
            depth: sub - 1.2 - random() * 1.5,
            height,
            tint: random(),
          });
        }
      }
    }
  }
  return buildings;
}

/** Fast lookup of the tallest roof under a point, used to keep the ship gliding over rooftops. */
export class CityHeightField {
  private readonly resolution = 2;
  private readonly size: number;
  private readonly heights: Float32Array;

  constructor(buildings: CityBuilding[], margin = 2) {
    this.size = Math.ceil((CITY.radius * 2) / this.resolution);
    this.heights = new Float32Array(this.size * this.size);
    for (const b of buildings) {
      const x0 = this.toCell(b.x - b.width / 2 - margin);
      const x1 = this.toCell(b.x + b.width / 2 + margin);
      const z0 = this.toCell(b.z - b.depth / 2 - margin);
      const z1 = this.toCell(b.z + b.depth / 2 + margin);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const index = iz * this.size + ix;
          this.heights[index] = Math.max(this.heights[index], b.height);
        }
      }
    }
  }

  private toCell(value: number): number {
    return Math.min(this.size - 1, Math.max(0, Math.floor((value + CITY.radius) / this.resolution)));
  }

  heightAt(x: number, z: number): number {
    if (Math.abs(x) >= CITY.radius || Math.abs(z) >= CITY.radius) return 0;
    return this.heights[this.toCell(z) * this.size + this.toCell(x)];
  }
}

const BUILDING_COLORS = ['#1e2a55', '#2a2150', '#16304a', '#33285e'];
const NEON_COLORS = [PALETTE.neonCyan, PALETTE.neonMagenta, PALETTE.neonAmber];

/** Buildings as two instanced meshes (bodies + neon crowns) plus glowing road lines: a handful of draw calls. */
export function createCity(buildings: CityBuilding[]): THREE.Group {
  const city = new THREE.Group();
  city.name = 'City';
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  const bodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.35, emissive: '#0d1640', emissiveIntensity: 0.6 }),
    buildings.length,
  );
  bodies.name = 'city-buildings';
  // Unlit so each instance shows its own neon color at full brightness.
  const crowns = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    buildings.length,
  );
  crowns.name = 'city-neon';
  buildings.forEach((b, i) => {
    matrix.makeScale(b.width, b.height, b.depth).setPosition(b.x, 0, b.z);
    bodies.setMatrixAt(i, matrix);
    bodies.setColorAt(i, color.set(BUILDING_COLORS[Math.floor(b.tint * BUILDING_COLORS.length)]));
    const bandHeight = 0.5;
    matrix.makeScale(b.width + 0.15, bandHeight, b.depth + 0.15).setPosition(b.x, b.height - 1.6 - b.tint * 2, b.z);
    crowns.setMatrixAt(i, matrix);
    crowns.setColorAt(i, color.set(NEON_COLORS[Math.floor(b.tint * 97) % NEON_COLORS.length]));
  });
  city.add(bodies, crowns);

  // Road center lines on the street grid.
  const lines: number[] = [];
  const extent = CITY.radius;
  for (let v = -extent; v <= extent; v += CITY.cell) {
    const reach = Math.sqrt(Math.max(0, extent * extent - v * v));
    lines.push(-reach, 0.06, v, reach, 0.06, v, v, 0.06, -reach, v, 0.06, reach);
  }
  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const roads = new THREE.LineSegments(
    roadGeometry,
    new THREE.LineBasicMaterial({ color: PALETTE.neonCyan, transparent: true, opacity: 0.35 }),
  );
  roads.name = 'city-roads';
  city.add(roads);

  const plaza = new THREE.Mesh(
    new THREE.RingGeometry(CITY.plazaRadius - 1.2, CITY.plazaRadius - 0.6, 64).rotateX(-Math.PI / 2),
    glow(PALETTE.neonMagenta, 1.2),
  );
  plaza.position.y = 0.05;
  plaza.name = 'plaza-ring';
  city.add(plaza);

  return city;
}
