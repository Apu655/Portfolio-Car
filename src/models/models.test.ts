import * as THREE from 'three';
import { roles } from '../content/portfolio';
import { CITY, CityHeightField, createCity, layoutCity } from './city';
import { createSpaceship, SHIP_FLAME } from './ship';
import { createCareerTower } from './tower';
import { ISLAND, terrainHeight } from './terrain';
import { createBeacon, createMonolith, createObservatory, createShipyard, STATION_LIGHT } from './stations';

describe('career tower', () => {
  const tower = createCareerTower(roles.map((r) => r.id));

  it('has one selectable floor per role, oldest at the bottom', () => {
    expect(tower.floors.map((f) => f.userData.roleId)).toEqual(roles.map((r) => r.id));
    const heights = tower.floors.map((f) => f.position.y);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });

  it('has four clock faces and rises above its floors', () => {
    expect(tower.hourHands).toHaveLength(4);
    expect(tower.minuteHands).toHaveLength(4);
    expect(tower.layout.height).toBeGreaterThan(tower.layout.shaftTop + 20);
  });
});

describe('city', () => {
  const buildings = layoutCity();

  it('is deterministic, so the city looks the same on every visit', () => {
    expect(layoutCity()).toEqual(buildings);
    expect(buildings.length).toBeGreaterThan(40);
  });

  it('keeps the tower plaza clear and stays on the island', () => {
    for (const b of buildings) {
      const d = Math.hypot(b.x, b.z);
      expect(d).toBeGreaterThan(CITY.plazaRadius - 10);
      expect(d).toBeLessThan(CITY.radius);
    }
  });

  it('reports rooftop heights for flight and zero over open ground', () => {
    const field = new CityHeightField(buildings, 0);
    const b = buildings[0];
    expect(field.heightAt(b.x, b.z)).toBeCloseTo(b.height, 5);
    expect(field.heightAt(0, 0)).toBe(0);
  });

  it('renders all buildings with two instanced draw calls', () => {
    const city = createCity(buildings);
    const instanced = city.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    expect(instanced).toHaveLength(2);
    expect(instanced.every((m) => m.count === buildings.length)).toBe(true);
  });
});

describe('terrain', () => {
  it('is flat under the city and hilly at the rim', () => {
    expect(terrainHeight(0, 0)).toBe(0);
    expect(terrainHeight(ISLAND.flatRadius - 1, 0)).toBe(0);
    const rim = (ISLAND.flatRadius + ISLAND.radius) / 2;
    expect(terrainHeight(rim, 0)).toBeGreaterThan(2);
  });
});

describe('ship and stations', () => {
  it('builds a ship with two engine flames', () => {
    const flames: THREE.Object3D[] = [];
    createSpaceship().traverse((o) => o.name === SHIP_FLAME && flames.push(o));
    expect(flames).toHaveLength(2);
  });

  it('gives every station a pulsing light', () => {
    for (const build of [createObservatory, createShipyard, createBeacon, createMonolith]) {
      expect(build().getObjectByName(STATION_LIGHT)).toBeDefined();
    }
  });
});
