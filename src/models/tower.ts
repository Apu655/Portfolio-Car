import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, glow, standard } from './materials';

/**
 * The career tower: a campanile inspired by the MetLife Tower — stone shaft, four clock faces,
 * pyramidal roof, lantern and spire. Each role is one floor of the shaft, oldest at the bottom.
 */
export const TOWER = {
  podiumSize: 22,
  podiumHeight: 5,
  shaftWidth: 13,
  floorHeight: 9,
  clockStageHeight: 12,
  clockRadius: 4.2,
  roofHeight: 14,
} as const;

export interface TowerLayout {
  floorCenters: number[];
  shaftTop: number;
  clockCenter: number;
  height: number;
  /** Radius of the cylinder the ship must stay outside of. */
  collisionRadius: number;
}

export function towerLayout(floorCount: number): TowerLayout {
  const floorCenters = Array.from(
    { length: floorCount },
    (_, i) => TOWER.podiumHeight + TOWER.floorHeight * (i + 0.5),
  );
  const shaftTop = TOWER.podiumHeight + TOWER.floorHeight * floorCount;
  const clockCenter = shaftTop + 1 + TOWER.clockStageHeight / 2;
  const roofBase = shaftTop + 1 + TOWER.clockStageHeight + 3;
  return {
    floorCenters,
    shaftTop,
    clockCenter,
    height: roofBase + TOWER.roofHeight + 9,
    collisionRadius: TOWER.podiumSize * 0.62,
  };
}

export interface CareerTower {
  /** Everything that is not a selectable floor. */
  shell: THREE.Group;
  /** One mesh per role, bottom to top. `userData.roleId` identifies the role. */
  floors: THREE.Mesh[];
  hourHands: THREE.Object3D[];
  minuteHands: THREE.Object3D[];
  layout: TowerLayout;
}

const FACE_ROTATIONS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function createClockFace(): { face: THREE.Group; hour: THREE.Object3D; minute: THREE.Object3D } {
  const face = new THREE.Group();
  const gold = standard(PALETTE.gold, { metalness: 0.8, roughness: 0.3 });
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(TOWER.clockRadius, 48),
    standard(PALETTE.clockFace, { emissive: PALETTE.clockFace, emissiveIntensity: 0.55 }),
  );
  const ring = new THREE.Mesh(new THREE.TorusGeometry(TOWER.clockRadius + 0.1, 0.28, 8, 48), gold);
  face.add(dial, ring);

  const markers: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const marker = new THREE.BoxGeometry(0.25, i % 3 === 0 ? 0.9 : 0.5, 0.08);
    marker.rotateZ(-angle);
    marker.translate(Math.sin(angle) * 3.5, Math.cos(angle) * 3.5, 0.05);
    markers.push(marker);
  }
  face.add(new THREE.Mesh(mergeGeometries(markers), gold));

  const handMaterial = standard('#1a1a24', { roughness: 0.5 });
  const hourGeometry = new THREE.BoxGeometry(0.38, 2.3, 0.08);
  hourGeometry.translate(0, 1.0, 0); // pivot at the dial center
  const minuteGeometry = new THREE.BoxGeometry(0.24, 3.3, 0.08);
  minuteGeometry.translate(0, 1.5, 0);
  const hour = new THREE.Mesh(hourGeometry, handMaterial);
  hour.name = 'hourHand';
  hour.position.z = 0.12;
  const minute = new THREE.Mesh(minuteGeometry, handMaterial);
  minute.name = 'minuteHand';
  minute.position.z = 0.2;
  face.add(hour, minute);
  return { face, hour, minute };
}

function createFloor(roleId: string, index: number, centerY: number): THREE.Mesh {
  const width = TOWER.shaftWidth;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, TOWER.floorHeight - 0.5, width),
    standard(index % 2 === 0 ? PALETTE.stone : '#c4bdad', { roughness: 0.85, emissive: '#3ff0ff', emissiveIntensity: 0 }),
  );
  floor.name = `floor-${roleId}`;
  floor.position.y = centerY;
  floor.userData.roleId = roleId;
  floor.userData.floorIndex = index;

  // Lit window bands on all four sides; children of the floor so hover highlighting covers them.
  const windowMaterial = glow('#ffd27a', 0.55);
  const windowGeometry = new THREE.PlaneGeometry(width - 2, TOWER.floorHeight - 3.2);
  FACE_ROTATIONS.forEach((rotation) => {
    const pane = new THREE.Mesh(windowGeometry, windowMaterial);
    pane.rotation.y = rotation;
    pane.position.set(Math.sin(rotation) * (width / 2 + 0.02), 0, Math.cos(rotation) * (width / 2 + 0.02));
    floor.add(pane);
  });
  return floor;
}

export function createCareerTower(roleIds: string[]): CareerTower {
  const layout = towerLayout(roleIds.length);
  const shell = new THREE.Group();
  shell.name = 'CareerTower';
  const stoneDark = standard(PALETTE.stoneDark, { roughness: 0.9 });
  const stone = standard(PALETTE.stone, { roughness: 0.85 });
  const gold = standard(PALETTE.gold, { metalness: 0.8, roughness: 0.3, emissive: PALETTE.gold, emissiveIntensity: 0.15 });

  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(TOWER.podiumSize, TOWER.podiumHeight, TOWER.podiumSize),
    stoneDark,
  );
  podium.position.y = TOWER.podiumHeight / 2;
  shell.add(podium);

  // Vertical ribs and neon floor separators, merged into two draw calls.
  const ribs: THREE.BufferGeometry[] = [];
  const bands: THREE.BufferGeometry[] = [];
  const shaftHeight = layout.shaftTop - TOWER.podiumHeight;
  const half = TOWER.shaftWidth / 2;
  for (const rotation of FACE_ROTATIONS) {
    for (let i = 0; i <= 5; i++) {
      const offset = -half + (i / 5) * TOWER.shaftWidth;
      const rib = new THREE.BoxGeometry(0.45, shaftHeight, 0.6);
      rib.translate(offset, TOWER.podiumHeight + shaftHeight / 2, half + 0.15);
      rib.rotateY(rotation);
      ribs.push(rib);
    }
  }
  for (let i = 0; i <= roleIds.length; i++) {
    const band = new THREE.BoxGeometry(TOWER.shaftWidth + 0.9, 0.35, TOWER.shaftWidth + 0.9);
    band.translate(0, TOWER.podiumHeight + i * TOWER.floorHeight, 0);
    bands.push(band);
  }
  shell.add(new THREE.Mesh(mergeGeometries(ribs), stone));
  shell.add(new THREE.Mesh(mergeGeometries(bands), glow(PALETTE.neonCyan, 1.6)));

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(TOWER.shaftWidth + 2, 1, TOWER.shaftWidth + 2), stoneDark);
  cornice.position.y = layout.shaftTop + 0.5;
  shell.add(cornice);

  const clockStage = new THREE.Mesh(
    new THREE.BoxGeometry(TOWER.shaftWidth + 1, TOWER.clockStageHeight, TOWER.shaftWidth + 1),
    stone,
  );
  clockStage.position.y = layout.clockCenter;
  shell.add(clockStage);

  const hourHands: THREE.Object3D[] = [];
  const minuteHands: THREE.Object3D[] = [];
  for (const rotation of FACE_ROTATIONS) {
    const { face, hour, minute } = createClockFace();
    const distance = (TOWER.shaftWidth + 1) / 2 + 0.05;
    face.rotation.y = rotation;
    face.position.set(Math.sin(rotation) * distance, layout.clockCenter, Math.cos(rotation) * distance);
    hourHands.push(hour);
    minuteHands.push(minute);
    shell.add(face);
  }

  const loggiaY = layout.shaftTop + 1 + TOWER.clockStageHeight;
  const loggia = new THREE.Mesh(new THREE.BoxGeometry(TOWER.shaftWidth - 1, 3, TOWER.shaftWidth - 1), stoneDark);
  loggia.position.y = loggiaY + 1.5;
  shell.add(loggia);

  const roofGeometry = new THREE.ConeGeometry((TOWER.shaftWidth - 1) * 0.72, TOWER.roofHeight, 4);
  roofGeometry.rotateY(Math.PI / 4); // square pyramid aligned with the shaft
  const roof = new THREE.Mesh(roofGeometry, gold);
  roof.position.y = loggiaY + 3 + TOWER.roofHeight / 2;
  shell.add(roof);

  const roofTop = loggiaY + 3 + TOWER.roofHeight;
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 2.6, 8), gold);
  cupola.position.y = roofTop - 0.6;
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), glow(PALETTE.neonAmber, 3));
  lantern.name = 'lantern';
  lantern.position.y = roofTop + 1.4;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 6, 8), gold);
  spire.position.y = roofTop + 5;
  shell.add(cupola, lantern, spire);

  const floors = roleIds.map((id, i) => createFloor(id, i, layout.floorCenters[i]));
  return { shell, floors, hourHands, minuteHands, layout };
}
