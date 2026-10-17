import * as THREE from 'three';
import { byNight, PALETTE, standard } from './materials';

/**
 * A procedural retro coupe: two-tone body with rounded fenders, chrome bumpers, round headlights, whitewall
 * wheels. Nose points down -Z; about 4.5 m long.
 */
export interface RetroCoupe {
  group: THREE.Group;
  /** Rotates with the suspension lean (roll and pitch). */
  body: THREE.Group;
  /** Front wheels steer around Y; all four spin around X. */
  wheels: { steer: THREE.Object3D | null; spin: THREE.Object3D }[];
  /** Headlight lens positions in car space, for attaching lights. */
  headlights: THREE.Vector3[];
  /** Headlight lens material; its night glow (see `byNight`) also drives the real headlight beams. */
  lens: THREE.MeshStandardMaterial;
}

const WHEEL_X = 0.9;
const WHEEL_Z = 1.32;
const WHEEL_RADIUS = 0.36;

/** Side profile (x = forward, y = up) extruded across the car's width, then turned so +x points down -Z. */
function sideExtrusion(shape: THREE.Shape, width: number, bevel: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 4,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(Math.PI / 2); // shape +x → world -z
  geometry.computeVertexNormals();
  return geometry;
}

function bodyShape(): THREE.Shape {
  const s = new THREE.Shape();
  const arch = 0.47;
  s.moveTo(-2.12, 0.34);
  s.lineTo(-WHEEL_Z - arch, 0.34);
  s.absarc(-WHEEL_Z, WHEEL_RADIUS, arch, Math.PI, 0, true);
  s.lineTo(WHEEL_Z - arch, 0.34);
  s.absarc(WHEEL_Z, WHEEL_RADIUS, arch, Math.PI, 0, true);
  s.lineTo(2.1, 0.34);
  s.quadraticCurveTo(2.3, 0.4, 2.28, 0.6); // rounded nose
  s.quadraticCurveTo(2.26, 0.8, 2.02, 0.86);
  s.quadraticCurveTo(1.4, 0.95, 0.72, 0.93); // long hood
  s.lineTo(-1.15, 0.93);
  s.quadraticCurveTo(-1.95, 0.95, -2.12, 0.78); // rounded trunk
  s.quadraticCurveTo(-2.24, 0.62, -2.2, 0.48);
  s.quadraticCurveTo(-2.18, 0.36, -2.12, 0.34);
  return s;
}

function cabinShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.78, 0.9);
  s.quadraticCurveTo(0.42, 1.2, 0.08, 1.36); // windshield rake
  s.quadraticCurveTo(-0.3, 1.43, -0.75, 1.4); // rounded roof
  s.quadraticCurveTo(-1.25, 1.3, -1.6, 0.92); // fastback
  s.lineTo(0.78, 0.9);
  return s;
}

function sideWindowShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.6, 0.98);
  s.quadraticCurveTo(0.34, 1.2, 0.06, 1.3);
  s.quadraticCurveTo(-0.3, 1.36, -0.7, 1.33);
  s.quadraticCurveTo(-1.1, 1.24, -1.36, 0.99);
  s.lineTo(0.6, 0.98);
  return s;
}

function createWheel(materials: { tire: THREE.Material; chrome: THREE.Material; whitewall: THREE.Material }): THREE.Group {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.1, 12, 28).rotateY(Math.PI / 2), materials.tire);
  const whitewall = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 8, 28).rotateY(Math.PI / 2), materials.whitewall);
  whitewall.scale.set(1.9, 1, 1);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 20).rotateZ(Math.PI / 2), materials.chrome);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), materials.chrome);
  cap.scale.set(0.6, 1, 1);
  cap.position.x = 0.1;
  // Spokes make the spin visible.
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), materials.chrome);
    spoke.rotation.x = (i / 4) * Math.PI;
    spoke.position.x = 0.09;
    wheel.add(spoke);
  }
  wheel.add(tire, whitewall, hub, cap);
  return wheel;
}

export function createRetroCoupe(bodyColor: string = PALETTE.carBody): RetroCoupe {
  const group = new THREE.Group();
  group.name = 'RetroCoupe';
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: 0.35,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const cream = new THREE.MeshPhysicalMaterial({ color: PALETTE.carCream, roughness: 0.35, clearcoat: 0.8 });
  const chrome = standard(PALETTE.chrome, { metalness: 1, roughness: 0.12 });
  const glass = standard('#1d2b3a', { metalness: 0.9, roughness: 0.06, side: THREE.DoubleSide });
  const dark = standard('#1a1c20', { roughness: 0.7 });

  const shell = new THREE.Mesh(sideExtrusion(bodyShape(), 1.74, 0.12), paint);
  shell.name = 'body';
  shell.castShadow = true;
  const cabin = new THREE.Mesh(sideExtrusion(cabinShape(), 1.42, 0.08), cream);
  cabin.name = 'cabin';
  body.add(shell, cabin);

  const halfWidth = 1.74 / 2 + 0.12;
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.ShapeGeometry(sideWindowShape()).rotateY(Math.PI / 2), glass);
    window.position.x = side * (1.42 / 2 + 0.085);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 3.3), cream);
    stripe.position.set(side * (halfWidth + 0.004), 0.7, -0.05);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), chrome);
    mirror.position.set(side * (halfWidth + 0.06), 1.0, -0.62);
    body.add(window, stripe, mirror);
  }

  // Windshield and rear window sit on the cabin's sloped faces.
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.66), glass);
  windshield.rotation.x = 0.98;
  windshield.position.set(0, 1.155, -0.447);
  const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.7), glass);
  rearWindow.rotation.x = -1.06;
  rearWindow.position.set(0, 1.186, 1.19);
  body.add(windshield, rearWindow);

  // Chrome bumpers and grille.
  for (const z of [-2.3, 2.24]) {
    const bumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.7, 6, 12).rotateZ(Math.PI / 2), chrome);
    bumper.position.set(0, 0.42, z);
    body.add(bumper);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.06), dark);
  grille.position.set(0, 0.6, -2.28);
  body.add(grille);
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.04), chrome);
    bar.position.set(i * 0.15, 0.6, -2.31);
    body.add(bar);
  }

  // Round headlights with chrome rims; taillights.
  const lens = byNight(standard('#fff6dd', { emissive: '#ffe8b0', emissiveIntensity: 0.4, roughness: 0.2 }), 'emissiveByNight', 0.4, 3.2);
  const tail = byNight(standard('#d0212d', { emissive: '#ff2a2a', emissiveIntensity: 0.5 }), 'emissiveByNight', 0.5, 2.6);
  const headlights: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 20).rotateX(Math.PI / 2), lens);
    light.position.set(side * 0.62, 0.68, -2.2);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.025, 8, 24), chrome);
    rim.position.set(side * 0.62, 0.68, -2.245);
    const taillight = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8).rotateZ(Math.PI / 2), tail);
    taillight.position.set(side * 0.66, 0.66, 2.22);
    headlights.push(new THREE.Vector3(side * 0.62, 0.68, -2.25));
    body.add(light, rim, taillight);
  }

  const wheelMaterials = { tire: standard('#151618', { roughness: 0.9 }), chrome, whitewall: standard('#f5f2ea', { roughness: 0.6 }) };
  const wheels: RetroCoupe['wheels'] = [];
  for (const z of [-WHEEL_Z, WHEEL_Z]) {
    for (const side of [-1, 1]) {
      const spin = createWheel(wheelMaterials);
      if (side < 0) spin.rotation.y = Math.PI; // hubcap faces outward on both sides
      const mount = new THREE.Group();
      mount.position.set(side * WHEEL_X, WHEEL_RADIUS, z);
      mount.add(spin);
      group.add(mount);
      wheels.push({ steer: z < 0 ? mount : null, spin });
    }
  }

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group, body, wheels, headlights, lens };
}
