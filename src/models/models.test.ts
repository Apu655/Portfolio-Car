import * as THREE from 'three';
import { distanceToLoop, LOOP, TOWERS } from '../world/city/cityLayout';
import { createRetroCoupe } from './car';
import { createBuildings, createStreetlights, createTrees, loopPath } from './cityMeshes';
import { LANDMARK_BUILDERS } from './landmarks';

function bounds(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

describe('retro coupe', () => {
  const car = createRetroCoupe();

  it('has four wheels, two of which steer', () => {
    expect(car.wheels).toHaveLength(4);
    expect(car.wheels.filter((w) => w.steer)).toHaveLength(2);
  });

  it('is car-sized and points down -Z with headlights at the front', () => {
    const size = bounds(car.group).getSize(new THREE.Vector3());
    expect(size.z).toBeGreaterThan(4);
    expect(size.z).toBeLessThan(5.2);
    expect(size.x).toBeLessThan(2.4);
    expect(car.headlights).toHaveLength(2);
    expect(car.headlights.every((h) => h.z < -2)).toBe(true);
  });

  it('turns its headlights up at night', () => {
    const [day, night] = car.lens.userData.emissiveByNight as [number, number];
    expect(night).toBeGreaterThan(day);
  });
});

describe('landmarks', () => {
  it.each(TOWERS.map((t) => [t.name, t] as const))('%s matches its site footprint and height', (_name, site) => {
    const landmark = LANDMARK_BUILDERS[site.section](site);
    const box = bounds(landmark.group);
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(site.height * 0.9);
    expect(size.y).toBeLessThan(site.height * 1.12);
    // Small overhangs (cornices, steps) may poke out slightly; the body stays within the collider.
    expect(Math.max(size.x, size.z) / 2).toBeLessThan(site.halfSize * 1.25);
  });

  it('gives each tower a distinct silhouette name', () => {
    const names = TOWERS.map((site) => LANDMARK_BUILDERS[site.section](site).group.name);
    expect(new Set(names).size).toBe(5);
  });
});

describe('city meshes', () => {
  it('draws the downtown buildings as a handful of instanced meshes', () => {
    const buildings = createBuildings();
    const instanced = buildings.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh);
    expect(instanced.length).toBe(buildings.children.length);
    expect(instanced.length).toBeLessThanOrEqual(3);
  });

  it('instances trees and streetlights', () => {
    for (const group of [createTrees(), createStreetlights()]) {
      expect(group.children.every((c) => (c as THREE.InstancedMesh).isInstancedMesh)).toBe(true);
    }
  });

  it('samples the loop path along the boulevard centerline, all the way round', () => {
    const points = loopPath(0, 10);
    const perimeter = 8 * (LOOP.half - LOOP.cornerRadius) + 2 * Math.PI * LOOP.cornerRadius;
    expect(points.length).toBeGreaterThan(perimeter / 10 - 4);
    for (const p of points) expect(Math.abs(distanceToLoop(p.x, p.z))).toBeLessThan(0.01);
  });
});
