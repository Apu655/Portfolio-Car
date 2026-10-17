import * as THREE from 'three';
import { PALETTE, glow, standard } from './materials';

/** Names of the engine-flame meshes, scaled by the flight controller to show thrust. */
export const SHIP_FLAME = 'flame';

function wingGeometry(points: Array<[number, number]>): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2); // lay the shape flat in the XZ plane
  geometry.translate(0, -0.05, 0);
  return geometry;
}

/** A small procedural starship. Nose points down -Z, roughly 6.5 units long. */
export function createSpaceship(): THREE.Group {
  const ship = new THREE.Group();
  ship.name = 'Spaceship';

  const hullMaterial = standard(PALETTE.hull, { metalness: 0.55, roughness: 0.35 });
  const darkMaterial = standard(PALETTE.hullDark, { metalness: 0.4, roughness: 0.5 });

  const profile = [
    [0, -3],
    [0.55, -2.9],
    [0.8, -2.2],
    [0.9, -1],
    [0.85, 0.2],
    [0.65, 1.4],
    [0.38, 2.4],
    [0, 3.2],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const hullGeometry = new THREE.LatheGeometry(profile, 18);
  hullGeometry.rotateX(-Math.PI / 2); // lathe axis +Y becomes the nose direction -Z
  hullGeometry.scale(1, 0.72, 1);
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.name = 'hull';
  ship.add(hull);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 18, 12),
    standard(PALETTE.glass, { emissive: PALETTE.glass, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.1 }),
  );
  cockpit.name = 'cockpit';
  cockpit.scale.set(0.9, 0.7, 1.8);
  cockpit.position.set(0, 0.42, -0.9);
  ship.add(cockpit);

  const rightWing = new THREE.Mesh(
    wingGeometry([
      [0.6, -0.6],
      [3.6, 1.2],
      [3.6, 1.9],
      [0.6, 1.8],
    ]),
    darkMaterial,
  );
  rightWing.name = 'wing-right';
  const leftWing = new THREE.Mesh(
    wingGeometry([
      [-0.6, 1.8],
      [-3.6, 1.9],
      [-3.6, 1.2],
      [-0.6, -0.6],
    ]),
    darkMaterial,
  );
  leftWing.name = 'wing-left';
  ship.add(rightWing, leftWing);

  const finShape = new THREE.Shape([
    new THREE.Vector2(1.4, 0.3),
    new THREE.Vector2(2.9, 0.3),
    new THREE.Vector2(3.0, 1.7),
    new THREE.Vector2(2.5, 1.7),
  ]);
  const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false });
  finGeometry.rotateY(-Math.PI / 2); // shape X runs along the hull (+Z)
  finGeometry.translate(0.05, 0, 0);
  const fin = new THREE.Mesh(finGeometry, darkMaterial);
  fin.name = 'tail-fin';
  ship.add(fin);

  const tipLightGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.7);
  const leftTip = new THREE.Mesh(tipLightGeometry, glow(PALETTE.neonMagenta, 3));
  leftTip.position.set(-3.6, -0.1, 1.55);
  const rightTip = new THREE.Mesh(tipLightGeometry, glow(PALETTE.neonCyan, 3));
  rightTip.position.set(3.6, -0.1, 1.55);
  ship.add(leftTip, rightTip);

  const engineGeometry = new THREE.CylinderGeometry(0.32, 0.4, 1.6, 14);
  engineGeometry.rotateX(Math.PI / 2);
  const flameGeometry = new THREE.ConeGeometry(0.26, 1.6, 14, 1, true);
  flameGeometry.rotateX(Math.PI / 2); // apex points backwards (+Z)
  flameGeometry.translate(0, 0, 0.8); // pivot at the nozzle so scaling stretches it outward
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.neonCyan,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(engineGeometry, darkMaterial);
    engine.name = side < 0 ? 'engine-left' : 'engine-right';
    engine.position.set(side * 0.95, -0.15, 2.0);
    const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), glow(PALETTE.neonCyan, 0.5));
    nozzle.position.set(side * 0.95, -0.15, 2.81);
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.name = SHIP_FLAME;
    flame.position.set(side * 0.95, -0.15, 2.82);
    ship.add(engine, nozzle, flame);
  }

  return ship;
}
