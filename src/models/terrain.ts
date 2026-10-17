import * as THREE from 'three';
import { PALETTE } from './materials';
import { fbm } from './noise';

/** The city sits on a floating island: flat in the middle, hilly at the rim, rocky underneath. */
export const ISLAND = {
  radius: 150,
  flatRadius: 112,
  rimHeight: 16,
  undersideDepth: 95,
} as const;

const SEED = 7;

/** Height of the island's top surface at (x, z); 0 across the city, rising into hills at the rim. */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= ISLAND.flatRadius || r > ISLAND.radius) return 0;
  const t = (r - ISLAND.flatRadius) / (ISLAND.radius - ISLAND.flatRadius); // 0 → 1 across the rim
  const ridge = Math.sin(t * Math.PI); // up then back down at the cliff edge
  const noise = fbm(x * 0.045, z * 0.045, 4, SEED);
  return ridge * ISLAND.rimHeight * (0.45 + noise);
}

function colorForHeight(height: number, target: THREE.Color): THREE.Color {
  const ground = new THREE.Color(PALETTE.ground);
  const rock = new THREE.Color(PALETTE.rock);
  return target.copy(ground).lerp(rock, Math.min(1, height / 8));
}

export function createIsland(): THREE.Group {
  const island = new THREE.Group();
  island.name = 'Island';

  // Top surface: polar grid so the edge is a clean circle.
  const rings = 44;
  const segments = 120;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  positions.push(0, 0, 0);
  colorForHeight(0, color);
  colors.push(color.r, color.g, color.b);
  for (let ring = 1; ring <= rings; ring++) {
    const r = (ring / rings) * ISLAND.radius;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      colorForHeight(y, color);
      colors.push(color.r, color.g, color.b);
    }
  }
  const vertex = (ring: number, s: number) => (ring === 0 ? 0 : 1 + (ring - 1) * segments + (s % segments));
  for (let s = 0; s < segments; s++) indices.push(0, vertex(1, s + 1), vertex(1, s));
  for (let ring = 1; ring < rings; ring++) {
    for (let s = 0; s < segments; s++) {
      const a = vertex(ring, s);
      const b = vertex(ring, s + 1);
      const c = vertex(ring + 1, s);
      const d = vertex(ring + 1, s + 1);
      indices.push(a, b, c, b, d, c);
    }
  }
  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  topGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  topGeometry.setIndex(indices);
  topGeometry.computeVertexNormals();
  const top = new THREE.Mesh(
    topGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05 }),
  );
  top.name = 'island-top';
  island.add(top);

  // Underside: an inverted, noise-roughened cone.
  const underside = new THREE.ConeGeometry(ISLAND.radius, ISLAND.undersideDepth, 64, 10, true);
  underside.rotateX(Math.PI); // apex down
  underside.translate(0, -ISLAND.undersideDepth / 2 - 0.2, 0);
  const p = underside.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (y > -1) continue; // keep the rim seamless with the top surface
    const n = fbm(x * 0.03 + 11, z * 0.03 + y * 0.05, 3, SEED + 3);
    const scale = 0.82 + n * 0.36;
    p.setXYZ(i, x * scale, y * (0.9 + n * 0.25), z * scale);
  }
  underside.computeVertexNormals();
  const rock = new THREE.Mesh(
    underside,
    new THREE.MeshStandardMaterial({ color: PALETTE.rockDark, roughness: 1, flatShading: true }),
  );
  rock.name = 'island-underside';
  island.add(rock);

  return island;
}
