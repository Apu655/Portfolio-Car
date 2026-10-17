import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BLOCKS,
  BUILDINGS,
  LOOP,
  SIDEWALK,
  STREET,
  STREETLIGHTS,
  TOWERS,
  TREES,
  WORLD_HALF,
  type Block,
  type Building,
  type Prop,
} from '../world/city/cityLayout';
import { byNight, facade, PALETTE, standard } from './materials';
import { seededRandom } from './noise';
import { radialTexture, scaleFacadeUVsByInstance } from './textures';

const H = LOOP.half;
const R = LOOP.cornerRadius;
const HALF_W = LOOP.width / 2;

/** Rounded square outline (centered at the origin) as a THREE.Shape or Path. */
function roundedSquarePath<T extends THREE.Path>(path: T, half: number, radius: number): T {
  const inner = half - radius;
  path.moveTo(-inner, -half);
  path.lineTo(inner, -half);
  path.absarc(inner, -inner, radius, -Math.PI / 2, 0, false);
  path.lineTo(half, inner);
  path.absarc(inner, inner, radius, 0, Math.PI / 2, false);
  path.lineTo(-inner, half);
  path.absarc(-inner, inner, radius, Math.PI / 2, Math.PI, false);
  path.lineTo(-half, -inner);
  path.absarc(-inner, -inner, radius, Math.PI, Math.PI * 1.5, false);
  return path;
}

function ring(outerHalf: number, outerRadius: number, innerHalf: number, innerRadius: number): THREE.Shape {
  const shape = roundedSquarePath(new THREE.Shape(), outerHalf, outerRadius);
  shape.holes.push(roundedSquarePath(new THREE.Path(), innerHalf, innerRadius));
  return shape;
}

/** Flat shape on the ground (shape y → world -z, which is symmetric for everything here). */
function flat(geometry: THREE.BufferGeometry, y: number): THREE.BufferGeometry {
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/** Points along the loop at `offset` from the centerline, every `step` meters, with their travel direction. */
export function loopPath(offset: number, step: number): Array<{ x: number; z: number; angle: number }> {
  const half = H + offset;
  const radius = R + offset;
  const inner = H - R;
  const points: Array<{ x: number; z: number; angle: number }> = [];
  const straight = (x0: number, z0: number, x1: number, z1: number) => {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const angle = Math.atan2(x1 - x0, z1 - z0);
    for (let d = 0; d < length; d += step) points.push({ x: x0 + ((x1 - x0) * d) / length, z: z0 + ((z1 - z0) * d) / length, angle });
  };
  // Corners turn the same way as the loop (counterclockwise seen from above), i.e. decreasing angle.
  const arc = (cx: number, cz: number, from: number) => {
    const length = (Math.PI / 2) * radius;
    for (let d = 0; d < length; d += step) {
      const a = from - d / radius;
      const x = cx + Math.cos(a) * radius;
      const z = cz + Math.sin(a) * radius;
      points.push({ x, z, angle: Math.atan2(Math.sin(a), -Math.cos(a)) });
    }
  };
  straight(-inner, half, inner, half);
  arc(inner, inner, Math.PI / 2);
  straight(half, inner, half, -inner);
  arc(inner, -inner, 0);
  straight(inner, -half, -inner, -half);
  arc(-inner, -inner, -Math.PI / 2);
  straight(-half, -inner, -half, inner);
  arc(-inner, inner, Math.PI);
  return points;
}

function instancedStripes(points: Array<{ x: number; z: number; angle: number }>, width: number, length: number, material: THREE.Material): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2), material, points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  points.forEach((p, i) => {
    q.setFromAxisAngle(up, p.angle);
    m.compose(new THREE.Vector3(p.x, 0.045, p.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.receiveShadow = true;
  return mesh;
}

/** Block sidewalk slab; corner blocks follow the boulevard's curve. */
function blockSlab(block: Block): THREE.Shape {
  const inner = H - R;
  const arcRadius = R - HALF_W;
  const corner = (x: number, z: number) => Math.abs(x) >= H - HALF_W - 0.01 || Math.abs(z) >= H - HALF_W - 0.01;
  const shape = new THREE.Shape();
  // Shape space uses (x, -z) because the slab is laid flat with rotateX(-π/2).
  const pts: Array<[number, number]> = [
    [block.minX, block.minZ],
    [block.maxX, block.minZ],
    [block.maxX, block.maxZ],
    [block.minX, block.maxZ],
  ];
  pts.forEach(([x, z], i) => {
    const isLoopCorner = corner(x, 0) && corner(0, z);
    const sx = Math.sign(x);
    const sz = Math.sign(z);
    if (isLoopCorner) {
      // Replace the square corner with the curb's arc around (±inner, ±inner).
      const steps = 10;
      const arcPoints: Array<[number, number]> = [];
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        // Sweep from the x-edge to the z-edge of this corner.
        const angle = (Math.PI / 2) * t;
        arcPoints.push([sx * (inner + Math.cos(angle) * arcRadius), sz * (inner + Math.sin(angle) * arcRadius)]);
      }
      // Order the arc to continue the polygon's winding.
      const prev = pts[(i + 3) % 4];
      const fromX = Math.abs(prev[0] - x) < 0.01; // previous point shares x → we arrive along the x edge
      const ordered = fromX ? arcPoints : arcPoints.reverse();
      ordered.forEach(([ax, az], k) => (i === 0 && k === 0 ? shape.moveTo(ax, -az) : shape.lineTo(ax, -az)));
    } else if (i === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  });
  shape.closePath();
  return shape;
}

export function createGroundAndRoads(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'GroundAndRoads';
  const asphalt = standard(PALETTE.asphalt, { roughness: 0.92 });
  const sidewalk = standard(PALETTE.sidewalk, { roughness: 0.95 });
  const grass = standard(PALETTE.grass, { roughness: 1 });
  const plaza = standard('#c9c2b4', { roughness: 0.9 });

  const ground = new THREE.Mesh(flat(new THREE.PlaneGeometry(2400, 2400), 0), grass);
  ground.receiveShadow = true;
  group.add(ground);

  const roads: THREE.BufferGeometry[] = [flat(new THREE.ShapeGeometry(ring(H + HALF_W, R + HALF_W, H - HALF_W, R - HALF_W), 24), 0.02)];
  const streetLength = 2 * (H - HALF_W) + 2;
  for (const p of STREET.positions) {
    roads.push(flat(new THREE.PlaneGeometry(STREET.width, streetLength), 0.025).translate(p, 0, 0));
    roads.push(flat(new THREE.PlaneGeometry(streetLength, STREET.width), 0.025).translate(0, 0, p));
  }
  for (const t of TOWERS) {
    // Driveway from the boulevard to each landmark's plaza.
    const length = 50 - t.halfSize - 6 - HALF_W;
    const along = HALF_W + length / 2;
    const g = flat(new THREE.PlaneGeometry(10, length), 0.03);
    g.rotateY(Math.atan2(t.outward[0], t.outward[1]));
    g.translate(t.roadPoint[0] + t.outward[0] * along, 0, t.roadPoint[1] + t.outward[1] * along);
    roads.push(g);
  }
  const roadMesh = new THREE.Mesh(mergeAll(roads), asphalt);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const slabs: THREE.BufferGeometry[] = [];
  const extrude = (shape: THREE.Shape) => flat(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 16 }), 0);
  for (const block of BLOCKS) {
    if (block.park) continue;
    slabs.push(extrude(blockSlab(block)));
  }
  slabs.push(extrude(ring(H + HALF_W + SIDEWALK, R + HALF_W + SIDEWALK, H + HALF_W, R + HALF_W)));
  const sidewalkMesh = new THREE.Mesh(mergeAll(slabs), sidewalk);
  sidewalkMesh.receiveShadow = true;
  group.add(sidewalkMesh);

  const park = BLOCKS.find((b) => b.park);
  if (park) {
    const lawn = new THREE.Mesh(extrude(blockSlab(park)), standard('#5a7d45', { roughness: 1 }));
    lawn.receiveShadow = true;
    group.add(lawn);
  }

  const plazas: THREE.BufferGeometry[] = TOWERS.map((t) => {
    const size = (t.halfSize + 7) * 2;
    return new THREE.BoxGeometry(size, 0.2, size).translate(t.center[0], 0.1, t.center[1]);
  });
  const plazaMesh = new THREE.Mesh(mergeAll(plazas), plaza);
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  group.add(createRoadMarkings());
  return group;
}

/** Merge mixed indexed/non-indexed geometries (shapes, planes, extrusions) into one draw call. */
function mergeAll(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(geometries.map((g) => (g.index ? g.toNonIndexed() : g)));
}

function createRoadMarkings(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RoadMarkings';
  const white = standard('#e9e7df', { roughness: 0.6 });
  const yellow = standard('#e7b53c', { roughness: 0.6 });

  const centerLines = [...loopPath(-0.2, 1), ...loopPath(0.2, 1)];
  group.add(instancedStripes(centerLines, 0.14, 1.05, yellow));
  const edges = [...loopPath(-(HALF_W - 0.5), 1), ...loopPath(HALF_W - 0.5, 1)];
  group.add(instancedStripes(edges, 0.16, 1.05, white));
  const lanes = [...loopPath(-4.5, 9), ...loopPath(4.5, 9)];
  group.add(instancedStripes(lanes, 0.14, 3, white));

  // Downtown: dashed center lines and zebra crossings at every intersection.
  const dashes: Array<{ x: number; z: number; angle: number }> = [];
  for (const p of STREET.positions) {
    for (let d = -H + HALF_W + 4; d < H - HALF_W - 4; d += 8) {
      const nearCrossing = STREET.positions.some((q) => Math.abs(d - q) < STREET.width);
      if (nearCrossing) continue;
      dashes.push({ x: p, z: d, angle: 0 }, { x: d, z: p, angle: Math.PI / 2 });
    }
  }
  group.add(instancedStripes(dashes, 0.14, 2.5, white));
  const zebra: Array<{ x: number; z: number; angle: number }> = [];
  const crossings = [...STREET.positions.map((p) => p), H - HALF_W, -(H - HALF_W)];
  for (const sx of STREET.positions) {
    for (const sz of crossings) {
      for (const [x, z, horizontal] of [
        [sx, sz, true],
        [sz, sx, false],
      ] as Array<[number, number, boolean]>) {
        for (const side of [-1, 1]) {
          const offset = STREET.width / 2 + 2;
          if (Math.abs(sz) === H - HALF_W && side === Math.sign(sz)) continue; // no crossing onto the boulevard
          for (let k = -2; k <= 2; k++) {
            zebra.push(
              horizontal
                ? { x: x + k * 1.6, z: z + side * offset, angle: 0 }
                : { x: x + side * offset, z: z + k * 1.6, angle: Math.PI / 2 },
            );
          }
        }
      }
    }
  }
  group.add(instancedStripes(zebra, 0.8, 3.2, white));
  return group;
}

// ---------- Buildings ----------

const FACADE_TINTS = ['#e4ddd0', '#c8d2df', '#d9c3a5', '#9eaabd', '#cfc8bb', '#b8c7d6'];

function instancedFacade(buildings: Building[], name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const material = facade('#ffffff');
  scaleFacadeUVsByInstance(material);
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), material, buildings.length);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), standard('#6b6f78', { roughness: 0.8 }), buildings.length);
  const random = seededRandom(31);
  const units: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  buildings.forEach((b, i) => {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    bodies.setMatrixAt(i, m.makeScale(w, b.height, d).setPosition(cx, 0, cz));
    bodies.setColorAt(i, color.set(FACADE_TINTS[Math.floor(b.tint * FACADE_TINTS.length)]));
    caps.setMatrixAt(i, m.makeScale(w + 0.6, 1.2, d + 0.6).setPosition(cx, b.height, cz));
    const count = 1 + Math.floor(random() * 3);
    for (let k = 0; k < count; k++) {
      const uw = 2 + random() * 4;
      const ud = 2 + random() * 4;
      const ux = cx + (random() - 0.5) * (w - uw - 2);
      const uz = cz + (random() - 0.5) * (d - ud - 2);
      units.push(new THREE.Matrix4().makeScale(uw, 1.5 + random() * 2.5, ud).setPosition(ux, b.height + 1.2, uz));
    }
  });
  const rooftop = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), standard('#8c9098', { roughness: 0.7, metalness: 0.3 }), units.length);
  units.forEach((u, i) => rooftop.setMatrixAt(i, u));
  for (const mesh of [bodies, caps, rooftop]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(bodies, caps, rooftop);
  return group;
}

export function createBuildings(): THREE.Group {
  return instancedFacade(BUILDINGS, 'DowntownBuildings');
}

/** Distant towers beyond the drivable area, fading into the fog, so the city feels large. */
export function createSkyline(): THREE.Group {
  const random = seededRandom(512);
  const buildings: Building[] = [];
  for (let i = 0; i < 140; i++) {
    const angle = random() * Math.PI * 2;
    const distance = WORLD_HALF + 70 + random() * 380;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const w = 18 + random() * 26;
    const d = 18 + random() * 26;
    buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: 30 + random() * random() * 150, tint: random() });
  }
  const group = instancedFacade(buildings, 'Skyline');
  group.traverse((o) => (o.castShadow = false));
  return group;
}

// ---------- Trees and streetlights ----------

function propMatrices(props: Prop[], build: (p: Prop, m: THREE.Matrix4) => void): THREE.Matrix4[] {
  return props.map((p) => {
    const m = new THREE.Matrix4();
    build(p, m);
    return m;
  });
}

export function createTrees(trees: Prop[] = TREES): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Trees';
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 3, 6).translate(0, 1.5, 0), standard('#6b4a32', { roughness: 1 }), trees.length);
  const lower = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.1, 1).translate(0, 4.2, 0), standard('#ffffff', { roughness: 0.95, flatShading: true }), trees.length);
  const upper = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.5, 1).translate(0.3, 5.7, -0.2), standard('#ffffff', { roughness: 0.95, flatShading: true }), trees.length);
  const greens = ['#4f7f3a', '#5e8c3e', '#3f6e3a', '#6f9447', '#557a34'];
  const random = seededRandom(9);
  const color = new THREE.Color();
  propMatrices(trees, (p, m) => {
    m.compose(new THREE.Vector3(p.position[0], 0.15, p.position[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation), new THREE.Vector3(p.scale, p.scale * (0.9 + random() * 0.3), p.scale));
  }).forEach((m, i) => {
    trunks.setMatrixAt(i, m);
    lower.setMatrixAt(i, m);
    upper.setMatrixAt(i, m);
    const base = greens[Math.floor(random() * greens.length)];
    lower.setColorAt(i, color.set(base));
    upper.setColorAt(i, color.set(base).offsetHSL(0.01, 0, 0.06));
  });
  for (const mesh of [trunks, lower, upper]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(trunks, lower, upper);
  return group;
}

export function createStreetlights(lights: Prop[] = STREETLIGHTS): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Streetlights';
  const metal = standard('#3c4048', { roughness: 0.5, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 7, 8).translate(0, 3.5, 0), metal, lights.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 2.3).translate(0, 6.95, 1.1), metal, lights.length);
  const heads = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.9).translate(0, 6.85, 2.1),
    byNight(standard('#fff4dc', { emissive: PALETTE.warmLight, emissiveIntensity: 0.1 }), 'emissiveByNight', 0.1, 4),
    lights.length,
  );
  const pools = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2).translate(0, 0.06, 2.2),
    byNight(new THREE.MeshBasicMaterial({ color: '#ffcf8f', map: radialTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 'opacityByNight', 0, 0.55),
    lights.length,
  );
  const up = new THREE.Vector3(0, 1, 0);
  propMatrices(lights, (p, m) => m.compose(new THREE.Vector3(p.position[0], 0.15, p.position[1]), new THREE.Quaternion().setFromAxisAngle(up, p.rotation), new THREE.Vector3(1, 1, 1))).forEach(
    (m, i) => {
      poles.setMatrixAt(i, m);
      arms.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      pools.setMatrixAt(i, m);
    },
  );
  poles.castShadow = true;
  arms.castShadow = true;
  group.add(poles, arms, heads, pools);
  return group;
}
