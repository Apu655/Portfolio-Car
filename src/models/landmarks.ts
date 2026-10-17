import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { byNight, facade, floodlit, glow, PALETTE, standard } from './materials';
import { FACADE_METERS, scaleFacadeUVs, screenTexture } from './textures';

/**
 * The five portfolio landmarks. Each builder returns a group centered on its plot at ground level with its
 * front (entrance side) facing +Z, plus the parts the scene animates.
 */
export interface Landmark {
  group: THREE.Group;
  /** Called every frame with elapsed seconds; animates clocks, screens, beacons. */
  animate?: (elapsed: number, dt: number) => void;
}

export interface LandmarkSpec {
  halfSize: number;
  height: number;
  accent: string;
}

const FACES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function box(w: number, h: number, d: number, material: THREE.Material, y: number, x = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

function squarePyramid(baseWidth: number, height: number, material: THREE.Material, y: number): THREE.Mesh {
  const geometry = new THREE.ConeGeometry((baseWidth / 2) * Math.SQRT2, height, 4, 1);
  geometry.rotateY(Math.PI / 4);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y + height / 2;
  return mesh;
}

/** A windowed panel on each of the four sides of a square shaft. */
function facadePanels(width: number, height: number, halfDepth: number, y: number, material: THREE.Material): THREE.Mesh {
  const panels: THREE.BufferGeometry[] = FACES.map((rotation) => {
    const g = scaleFacadeUVs(new THREE.PlaneGeometry(width, height), width, height);
    g.rotateY(rotation);
    g.translate(Math.sin(rotation) * halfDepth, y + height / 2, Math.cos(rotation) * halfDepth);
    return g;
  });
  return new THREE.Mesh(mergeGeometries(panels), material);
}

function finishShadows(group: THREE.Group): void {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// ---------- 1. MetLife Career Tower ----------

function clockFace(radius: number): { face: THREE.Group; hour: THREE.Object3D; minute: THREE.Object3D } {
  const face = new THREE.Group();
  const gold = standard(PALETTE.gold, { metalness: 0.85, roughness: 0.3 });
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    byNight(standard('#fff4d6', { emissive: '#fff1cc', emissiveIntensity: 0.25 }), 'emissiveByNight', 0.25, 1.3),
  );
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.15, 0.32, 10, 48), gold);
  const marks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.BoxGeometry(0.3, i % 3 === 0 ? 1.1 : 0.6, 0.08);
    m.rotateZ(-a);
    m.translate(Math.sin(a) * radius * 0.8, Math.cos(a) * radius * 0.8, 0.05);
    marks.push(m);
  }
  const ink = standard('#1c1d24', { roughness: 0.5 });
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.45, radius * 0.55, 0.08).translate(0, radius * 0.24, 0), ink);
  hour.position.z = 0.12;
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.3, radius * 0.8, 0.08).translate(0, radius * 0.36, 0), ink);
  minute.position.z = 0.2;
  face.add(dial, ring, new THREE.Mesh(mergeGeometries(marks), gold), hour, minute);
  return { face, hour, minute };
}

export function createCareerTower(spec: LandmarkSpec): Landmark {
  const group = new THREE.Group();
  group.name = 'MetLifeCareerTower';
  const stone = floodlit(PALETTE.stone, { roughness: 0.85 });
  const stoneDark = floodlit(PALETTE.stoneDark, { roughness: 0.9 });
  const gold = floodlit(PALETTE.gold, { metalness: 0.85, roughness: 0.28 }, 0.5);
  const windows = facade('#efe6d4');

  const podium = spec.halfSize * 2;
  const shaft = 18;
  group.add(box(podium, 6, podium, stoneDark, 0));
  group.add(box(shaft, 60, shaft, stone, 6));
  group.add(facadePanels(shaft - 4, 56, shaft / 2 + 0.03, 8, windows));

  const ribs: THREE.BufferGeometry[] = [];
  for (const rotation of FACES) {
    for (let i = 0; i <= 6; i++) {
      const g = new THREE.BoxGeometry(0.6, 60, 0.8);
      g.translate(-shaft / 2 + (i / 6) * shaft, 36, shaft / 2 + 0.2);
      g.rotateY(rotation);
      ribs.push(g);
    }
  }
  for (let level = 0; level <= 6; level++) {
    const g = new THREE.BoxGeometry(shaft + 1.2, 0.45, shaft + 1.2);
    g.translate(0, 6 + level * 10, 0);
    ribs.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(ribs), stone));

  group.add(box(shaft + 2.4, 1.4, shaft + 2.4, stoneDark, 66));
  const clockY = 74.5;
  group.add(box(shaft + 1, 14, shaft + 1, stone, 67.4));
  const hours: THREE.Object3D[] = [];
  const minutes: THREE.Object3D[] = [];
  for (const rotation of FACES) {
    const { face, hour, minute } = clockFace(5.2);
    face.rotation.y = rotation;
    face.position.set(Math.sin(rotation) * ((shaft + 1) / 2 + 0.05), clockY, Math.cos(rotation) * ((shaft + 1) / 2 + 0.05));
    hours.push(hour);
    minutes.push(minute);
    group.add(face);
  }
  group.add(box(shaft - 2, 4, shaft - 2, stoneDark, 81.4));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    group.add(box(1.4, 4, 1.4, stone, 81.4, x * (shaft / 2 - 1.2), z * (shaft / 2 - 1.2)));
  }
  group.add(squarePyramid(shaft - 1, 18, gold, 85.4));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 3, 8), gold).translateY(104.6));
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), byNight(glow('#ffcf7a', 0.6), 'emissiveByNight', 0.6, 4));
  lantern.position.y = 107.2;
  group.add(lantern);
  group.add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 5, 8), gold).translateY(spec.height - 2.5));

  finishShadows(group);
  const handAngle = (value: number, steps: number) => -(value / steps) * Math.PI * 2;
  return {
    group,
    // The clock shows the visitor's local time.
    animate: () => {
      const now = new Date();
      const h = handAngle((now.getHours() % 12) + now.getMinutes() / 60, 12);
      const m = handAngle(now.getMinutes() + now.getSeconds() / 60, 60);
      hours.forEach((hand) => (hand.rotation.z = h));
      minutes.forEach((hand) => (hand.rotation.z = m));
    },
  };
}

// ---------- 2. AI Research Tower ----------

function roundedSquare(half: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-half + radius, -half);
  s.lineTo(half - radius, -half);
  s.absarc(half - radius, -half + radius, radius, -Math.PI / 2, 0, false);
  s.lineTo(half, half - radius);
  s.absarc(half - radius, half - radius, radius, 0, Math.PI / 2, false);
  s.lineTo(-half + radius, half);
  s.absarc(-half + radius, half - radius, radius, Math.PI / 2, Math.PI, false);
  s.lineTo(-half, -half + radius);
  s.absarc(-half + radius, -half + radius, radius, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** A vertical prism of a rounded square with real-world-scaled facade UVs. */
function glassPrism(half: number, radius: number, height: number, y: number, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(roundedSquare(half, radius), { depth: height, bevelEnabled: false, curveSegments: 10 });
  geometry.rotateX(-Math.PI / 2);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / FACADE_METERS, uv.getY(i) / FACADE_METERS);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  return mesh;
}

export function createResearchTower(spec: LandmarkSpec): Landmark {
  const group = new THREE.Group();
  group.name = 'AIResearchTower';
  const glass = facade(PALETTE.glassBlue, 1.0);
  const slate = floodlit('#3b4352', { roughness: 0.6, metalness: 0.4 }, 0.25);
  const accent = byNight(glow(spec.accent, 1.2), 'emissiveByNight', 1.2, 3.2);

  group.add(box(spec.halfSize * 2 + 4, 3, spec.halfSize * 2 + 4, slate, 0));
  group.add(glassPrism(spec.halfSize - 1, 5, 92, 3, glass));
  group.add(new THREE.Mesh(new THREE.TorusGeometry(spec.halfSize - 3.5, 0.35, 8, 64).rotateX(Math.PI / 2), accent).translateY(95.2));
  group.add(glassPrism(9, 3.5, 16, 95, glass));
  group.add(box(20, 1, 20, slate, 111));

  // Neural lattice crown: a slowly turning icosahedral network of glowing nodes and links.
  const lattice = new THREE.Group();
  lattice.position.y = 121;
  const shapeGeometry = new THREE.IcosahedronGeometry(8.5, 1);
  const links = new THREE.LineSegments(
    new THREE.EdgesGeometry(shapeGeometry),
    new THREE.LineBasicMaterial({ color: spec.accent, transparent: true, opacity: 0.9, toneMapped: false }),
  );
  const unique = new Map<string, THREE.Vector3>();
  const p = shapeGeometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    unique.set(v.toArray().map((n) => n.toFixed(2)).join(','), v);
  }
  const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 12, 8), accent, unique.size);
  [...unique.values()].forEach((v, i) => nodes.setMatrixAt(i, new THREE.Matrix4().makeTranslation(v.x, v.y, v.z)));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 2), byNight(glow('#bff3ff', 1.4), 'emissiveByNight', 1.4, 3.5));
  lattice.add(links, nodes, core);
  group.add(lattice);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 8, 6), slate).translateY(spec.height + 2));

  finishShadows(group);
  links.castShadow = false;
  return {
    group,
    animate: (elapsed) => {
      lattice.rotation.y = elapsed * 0.15;
      lattice.rotation.x = Math.sin(elapsed * 0.2) * 0.15;
      core.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.06);
    },
  };
}

// ---------- 3. Projects Tower ----------

export function createProjectsTower(spec: LandmarkSpec): Landmark {
  const group = new THREE.Group();
  group.name = 'ProjectsTower';
  const walls = facade('#6f7c94', 1.1);
  const trim = floodlit('#2f3441', { metalness: 0.6, roughness: 0.4 }, 0.2);
  const ledge = byNight(glow(spec.accent, 0.8), 'emissiveByNight', 0.8, 2.6);

  const tiers = [
    { w: spec.halfSize * 2, h: 44, y: 0 },
    { w: 24, h: 30, y: 44 },
    { w: 17, h: 18, y: 74 },
  ];
  for (const tier of tiers) {
    const g = new THREE.BoxGeometry(tier.w, tier.h, tier.w);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    // BoxGeometry UVs are 0..1 per face; side faces span w × h.
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * tier.w) / FACADE_METERS, (uv.getY(i) * tier.h) / FACADE_METERS);
    const mesh = new THREE.Mesh(g, walls);
    mesh.position.y = tier.y + tier.h / 2;
    group.add(mesh);
    group.add(box(tier.w + 1, 0.8, tier.w + 1, trim, tier.y + tier.h));
    group.add(box(tier.w + 1.05, 0.25, tier.w + 1.05, ledge, tier.y + tier.h + 0.8));
  }

  // Facade screens scroll "code": the front shows the biggest, the sides smaller ones.
  const texture = screenTexture(spec.accent);
  texture.repeat.set(2, 1.5);
  // Unlit, like a real LED wall: sky reflections would wash the pattern out.
  const screen = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const screens: Array<[number, number, number, number, number]> = [
    // width, height, centerY, rotation, distance from center
    [22, 26, 18, 0, spec.halfSize + 0.06],
    [14, 16, 58, 0, 12.06],
    [12, 22, 20, Math.PI / 2, spec.halfSize + 0.06],
    [12, 22, 20, -Math.PI / 2, spec.halfSize + 0.06],
  ];
  for (const [w, h, y, rotation, d] of screens) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screen);
    panel.rotation.y = rotation;
    panel.position.set(Math.sin(rotation) * d, y, Math.cos(rotation) * d);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, h + 0.8, 0.3), trim);
    frame.rotation.y = rotation;
    frame.position.set(Math.sin(rotation) * (d - 0.2), y, Math.cos(rotation) * (d - 0.2)); // front face sits behind the screen
    group.add(frame, panel);
  }
  const crown = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(17, 4, 17)),
    new THREE.LineBasicMaterial({ color: spec.accent, toneMapped: false }),
  );
  crown.position.y = 94;
  group.add(crown);

  finishShadows(group);
  return {
    group,
    animate: (_elapsed, dt) => {
      texture.offset.y += dt * 0.04;
    },
  };
}

// ---------- 4. Education Tower ----------

export function createEducationTower(spec: LandmarkSpec): Landmark {
  const group = new THREE.Group();
  group.name = 'EducationTower';
  const stone = floodlit('#e2d6bf', { roughness: 0.85 });
  const stoneDark = floodlit('#b9ab92', { roughness: 0.9 });
  const copper = floodlit(PALETTE.copper, { metalness: 0.5, roughness: 0.45 }, 0.25);
  const gold = floodlit(PALETTE.gold, { metalness: 0.85, roughness: 0.3 }, 0.5);
  const windows = facade('#efe1c6', 1.0);
  const shadow = standard('#2a2622', { roughness: 1 });

  const w = spec.halfSize * 2;
  for (let i = 0; i < 3; i++) group.add(box(w - 2 + i * -1.5, 0.5, 6 - i * 1.4, stoneDark, i * 0.5, 0, spec.halfSize - 2 + i * 0.7));
  // Temple-front hall with a columned portico.
  group.add(box(w - 2, 14, 22, stone, 1.5, 0, -4));
  for (let i = 0; i < 8; i++) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 12, 16), stone);
    column.position.set(-12.25 + i * 3.5, 7.5, 9.5);
    group.add(column);
  }
  group.add(box(w - 1, 2, 6, stoneDark, 13.5, 0, 9.5));
  const pediment = new THREE.Shape([new THREE.Vector2(-(w - 1) / 2, 0), new THREE.Vector2((w - 1) / 2, 0), new THREE.Vector2(0, 5)]);
  const pedimentMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pediment, { depth: 6, bevelEnabled: false }), stone);
  pedimentMesh.position.set(0, 15.5, 6.5);
  group.add(pedimentMesh);
  group.add(box(10, 9, 0.2, shadow, 1.5, 0, 7.1)); // doorway shade behind the columns

  // Collegiate tower, belfry, copper spire.
  group.add(box(18, 46, 18, stone, 15.5, 0, -4));
  group.add(facadePanels(13, 40, 9.03, 18.5, windows).translateZ(-4));
  group.add(box(19.5, 1.2, 19.5, stoneDark, 61.5, 0, -4));
  group.add(box(14, 10, 14, stone, 62.7, 0, -4));
  for (const rotation of FACES) {
    const opening = new THREE.Mesh(new THREE.BoxGeometry(4, 6.5, 0.4), shadow);
    opening.rotation.y = rotation;
    opening.position.set(Math.sin(rotation) * 7.05, 66.5, -4 + Math.cos(rotation) * 7.05);
    group.add(opening);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    group.add(new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.5, 6), gold).translateX(x * 6.6).translateY(75).translateZ(-4 + z * 6.6));
  }
  const spire = squarePyramid(14, 15.5, copper, 72.7);
  spire.position.z = -4;
  group.add(spire);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), gold);
  finial.position.set(0, spec.height - 1.2, -4);
  group.add(finial);

  finishShadows(group);
  return { group };
}

// ---------- 5. Contact Tower ----------

export function createContactTower(spec: LandmarkSpec): Landmark {
  const group = new THREE.Group();
  group.name = 'ContactTower';
  const walls = facade('#c9d2e6', 1.1);
  const slate = floodlit('#434b5c', { roughness: 0.5, metalness: 0.5 }, 0.2);
  const strip = byNight(glow(spec.accent, 0.8), 'emissiveByNight', 0.8, 3);
  const r = spec.halfSize - 1;

  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 2.2, r + 2.6, 1.2, 40), slate).translateY(0.6));
  const shaftGeometry = scaleFacadeUVs(new THREE.CylinderGeometry(r - 0.6, r, 76, 40, 1, true), Math.PI * 2 * r, 76);
  group.add(new THREE.Mesh(shaftGeometry, walls).translateY(39.2));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 74, 0.4), strip);
    s.position.set(Math.sin(a) * (r - 0.15), 39.2, Math.cos(a) * (r - 0.15));
    group.add(s);
  }
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 2.5, r + 1, 3, 40), slate).translateY(78.7));
  const deckGlass = standard('#9fc4e8', { metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.75 });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 2.2, r + 2.2, 3.2, 40, 1, true), deckGlass).translateY(81.8));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 2.5, r + 2.5, 0.6, 40), slate).translateY(83.7));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 6, 24), slate).translateY(87));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), byNight(glow(spec.accent, 1.5), 'emissiveByNight', 1.5, 4.5));
  beacon.position.y = 92;
  group.add(beacon);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 6, 6), slate).translateY(spec.height - 3));

  finishShadows(group);
  return {
    group,
    animate: (elapsed) => {
      beacon.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.12);
    },
  };
}

export const LANDMARK_BUILDERS = {
  experience: createCareerTower,
  research: createResearchTower,
  projects: createProjectsTower,
  education: createEducationTower,
  contact: createContactTower,
} as const;
