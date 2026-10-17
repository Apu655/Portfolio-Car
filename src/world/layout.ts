import { layoutCity, CityHeightField } from '../models/city';
import { terrainHeight, ISLAND } from '../models/terrain';
import { towerLayout } from '../models/tower';
import { roles } from '../content/portfolio';
import type { Selection } from '../state/route';
import type { Vec3 } from './flight/flightModel';

/** Where every portfolio zone sits in the world, and where the ship parks to look at it. */

export const TOWER_POSITION: Vec3 = [0, 0, 0];
export const TOWER_LAYOUT = towerLayout(roles.length);
export const CITY_BUILDINGS = layoutCity();
const cityHeights = new CityHeightField(CITY_BUILDINGS);

export const STATION_POSITIONS = {
  about: [-46, 36, 150] as Vec3,
  research: [-235, 70, -95] as Vec3,
  projects: [245, 42, -30] as Vec3,
  contact: [90, 105, -265] as Vec3,
};

export const SHIP_START: { position: Vec3; yaw: number } = { position: [0, 30, 215], yaw: 0 };

/** Keeps the ship this far above the ground or rooftops. */
const CLEARANCE = 3;

/** Lowest altitude the ship may fly at (x, z). */
export function floorAt(x: number, z: number): number {
  const onIsland = Math.hypot(x, z) < ISLAND.radius + 4;
  const ground = onIsland ? Math.max(terrainHeight(x, z), cityHeights.heightAt(x, z)) : 0;
  return ground + CLEARANCE;
}

export const OBSTACLES = [
  { x: TOWER_POSITION[0], z: TOWER_POSITION[2], radius: TOWER_LAYOUT.collisionRadius, height: TOWER_LAYOUT.height },
];

export interface Viewpoint {
  position: Vec3;
  lookAt: Vec3;
}

export interface WorldTarget {
  /** Point the label and camera focus on. */
  focus: Vec3;
  viewpoint: Viewpoint;
}

/** Narrow (phone) screens need to stand further back to fit a target in a portrait frame. */
export type Framing = 'wide' | 'narrow';

/**
 * Park `distance` away from `focus`, approaching along `direction` (horizontal, toward the focus), looking
 * straight at it. Keeping it clear of the info panel is the camera's job (see ShipRig's view offset).
 */
function framedViewpoint(
  focus: Vec3,
  direction: [number, number],
  distance: number,
  lift: number,
  framing: Framing,
): Viewpoint {
  const length = Math.hypot(direction[0], direction[1]) || 1;
  const d = framing === 'narrow' ? distance * 1.35 : distance;
  return {
    position: [focus[0] - (direction[0] / length) * d, focus[1] + lift, focus[2] - (direction[1] / length) * d],
    lookAt: focus,
  };
}

/** Direction from the city center out toward a station, i.e. approaching it from the city side. */
const fromCity = (focus: Vec3): [number, number] => [focus[0], focus[2]];

export function floorFocus(roleIndex: number): Vec3 {
  return [TOWER_POSITION[0], TOWER_LAYOUT.floorCenters[roleIndex], TOWER_POSITION[2]];
}

export function targetFor(selection: Selection | null, framing: Framing = 'wide'): WorldTarget | null {
  if (!selection) return null;
  switch (selection.section) {
    case 'experience': {
      const index = roles.findIndex((r) => r.id === selection.itemId);
      if (index >= 0) {
        const focus = floorFocus(index);
        return { focus, viewpoint: framedViewpoint(focus, [0, -1], 30, 3, framing) };
      }
      const focus: Vec3 = [0, TOWER_LAYOUT.height * 0.5, 0];
      return { focus, viewpoint: framedViewpoint(focus, [0, -1], 105, 12, framing) };
    }
    case 'about': {
      const focus = STATION_POSITIONS.about;
      return { focus, viewpoint: framedViewpoint(focus, [0, -1], 34, 2, framing) };
    }
    case 'research':
    case 'projects':
    case 'contact': {
      const focus = STATION_POSITIONS[selection.section];
      return { focus, viewpoint: framedViewpoint(focus, fromCity(focus), 62, 6, framing) };
    }
  }
}
