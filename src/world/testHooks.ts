// Inspection hooks for the console and end-to-end tests: on in dev builds, and in production only with `?e2e`.
// They let a test place the car and observe game events; nothing in the experience depends on them.
import type { RootState } from '@react-three/fiber';
import { carRefs, walkerRefs } from './carRef';
import { travelTarget, usePlayer, type PlayerMode } from './player';
import { BREAKABLE_COLLIDERS } from './district/colliders';
import { on, telemetry, type GameEventType } from './events';
import { placeChassis } from './physics/vehicle';
import { isKnocked, lampId, treeId } from './scene/breakables';

export interface DistrictHooks {
  r3f: RootState;
  telemetry: typeof telemetry;
  /** Event types seen since the hooks were installed, in order. */
  events: GameEventType[];
  /** Put the controlled body (the car when driving, the walker on foot) at (x, z) facing `heading`, at rest. */
  place(x: number, z: number, heading: number): void;
  /** Whether the visitor is on foot, getting in, driving, or stopping to get out. */
  mode(): PlayerMode;
  /** Every lamp post and tree the car can knock over, where it stands, and whether it is already down. */
  breakables(): Array<{ kind: 'lamp' | 'tree'; x: number; z: number; knocked: boolean }>;
}

const RECORDED: GameEventType[] = ['impact', 'splash', 'waterEnter', 'waterExit', 'zoneEnter', 'zoneExit', 'recover', 'robotHit', 'knock'];

/** One recording for the page's lifetime, shared by every Canvas the visitor opens. */
const events: GameEventType[] = [];
let recording = false;

export function installTestHooks(state: RootState): void {
  if (!import.meta.env.DEV && !/[?&]e2e\b/.test(window.location.search)) return;
  if (!recording) {
    RECORDED.forEach((type) => on(type, () => events.push(type)));
    recording = true;
  }
  (window as Window & { __district?: DistrictHooks }).__district = {
    r3f: state,
    telemetry,
    events,
    place: (x, z, heading) => {
      if (travelTarget(usePlayer.getState().mode) === 'car') {
        if (carRefs.body) placeChassis(carRefs.body, [x, z], heading);
      } else {
        walkerRefs.body?.setTranslation({ x, y: 1.0, z }, true);
      }
    },
    mode: () => usePlayer.getState().mode,
    breakables: () =>
      BREAKABLE_COLLIDERS.map((c) => ({
        kind: c.object,
        x: c.position[0],
        z: c.position[2],
        knocked: isKnocked(c.object === 'lamp' ? lampId(c.index) : treeId(c.index)),
      })),
  };
}
