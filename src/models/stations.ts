import * as THREE from 'three';
import { PALETTE, glow, standard } from './materials';

/** Name of the pulsing light on stations that animate one. */
export const STATION_LIGHT = 'station-light';

/** Research observatory: a ringed station with a telescope dish. About 30 units across. */
export function createObservatory(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ResearchObservatory';
  const hull = standard(PALETTE.hull, { metalness: 0.6, roughness: 0.35 });
  const dark = standard(PALETTE.hullDark, { metalness: 0.5, roughness: 0.45 });

  const core = new THREE.Mesh(new THREE.SphereGeometry(5, 28, 18), hull);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 1.1, 12, 64), dark);
  ring.rotation.x = Math.PI / 2;
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(13, 0.35, 8, 64), glow(PALETTE.neonCyan, 2.4));
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = 1.2;
  group.add(core, ring, glowRing);

  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 8), dark);
    spoke.rotation.z = Math.PI / 2;
    spoke.position.x = 9;
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 4) * Math.PI * 2;
    pivot.add(spoke);
    group.add(pivot);
  }

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 3.2),
    standard('#e6ecf5', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }),
  );
  dish.rotation.x = Math.PI * 0.85;
  dish.position.set(0, 8.5, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5, 10), dark);
  mast.position.y = 6;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), glow(PALETTE.neonAmber, 4));
  light.name = STATION_LIGHT;
  light.position.set(0, 11.5, 2.2);
  group.add(mast, dish, light);
  return group;
}

/** Projects shipyard: an open gantry frame with a docked hull being built. */
export function createShipyard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ProjectsShipyard';
  const beam = standard(PALETTE.hullDark, { metalness: 0.6, roughness: 0.4 });
  const size = { x: 26, y: 14, z: 16 };
  const thickness = 0.8;

  const edges: Array<[number, number, number, number, number, number]> = [];
  for (const y of [-size.y / 2, size.y / 2]) {
    for (const z of [-size.z / 2, size.z / 2]) edges.push([0, y, z, size.x, thickness, thickness]);
    for (const x of [-size.x / 2, size.x / 2]) edges.push([x, y, 0, thickness, thickness, size.z]);
  }
  for (const x of [-size.x / 2, 0, size.x / 2]) {
    for (const z of [-size.z / 2, size.z / 2]) edges.push([x, 0, z, thickness, size.y, thickness]);
  }
  for (const [x, y, z, w, h, d] of edges) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), beam);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(3, 12, 6, 16).rotateZ(Math.PI / 2),
    standard(PALETTE.hull, { metalness: 0.5, roughness: 0.4 }),
  );
  group.add(hull);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.25, 8, 32), glow(PALETTE.neonMagenta, 2.5));
  stripe.rotation.y = Math.PI / 2;
  group.add(stripe);

  const light = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), glow(PALETTE.neonCyan, 4));
  light.name = STATION_LIGHT;
  light.position.set(0, size.y / 2 + 1.2, 0);
  group.add(light);
  return group;
}

/** Contact beacon: an antenna on a small asteroid with a pulsing signal light. */
export function createBeacon(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ContactBeacon';
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6, 1),
    standard(PALETTE.rock, { flatShading: true, roughness: 1 }),
  );
  rock.scale.set(1.2, 0.7, 1);
  group.add(rock);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 16, 10), standard(PALETTE.hull, { metalness: 0.6 }));
  mast.position.y = 11;
  group.add(mast);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6 - i * 0.35, 0.15, 6, 24), glow(PALETTE.neonMagenta, 2));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8 + i * 4;
    group.add(ring);
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), glow(PALETTE.neonMagenta, 5));
  light.name = STATION_LIGHT;
  light.position.y = 20;
  group.add(light);
  return group;
}

/** About monolith: a floating holo-slab near the arrival point. */
export function createMonolith(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AboutMonolith';
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(8, 14, 1.2),
    standard('#0e1530', { metalness: 0.7, roughness: 0.2, emissive: PALETTE.neonCyan, emissiveIntensity: 0.12 }),
  );
  group.add(slab);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(8.6, 14.6, 0.6), glow(PALETTE.neonCyan, 1.8));
  frame.position.z = -0.4;
  group.add(frame);
  const light = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), glow(PALETTE.neonAmber, 3.5));
  light.name = STATION_LIGHT;
  light.position.y = 10;
  group.add(light);
  return group;
}
