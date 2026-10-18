// Inspection hooks for the console and end-to-end tests: on in dev builds, and in production only with `?e2e`.
// They let a test place the car and observe game events; nothing in the experience depends on them.
import type { RootState } from '@react-three/fiber';
import { carRefs } from './carRef';
import { on, telemetry, type GameEventType } from './events';
import { placeChassis } from './physics/vehicle';

export interface DistrictHooks {
  r3f: RootState;
  telemetry: typeof telemetry;
  /** Event types seen since the hooks were installed, in order. */
  events: GameEventType[];
  /** Put the car at (x, z) facing `heading` (radians, 0 = north), at rest. */
  place(x: number, z: number, heading: number): void;
}

const RECORDED: GameEventType[] = ['impact', 'splash', 'waterEnter', 'waterExit', 'zoneEnter', 'zoneExit', 'recover'];

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
      if (carRefs.body) placeChassis(carRefs.body, [x, z], heading);
    },
  };
}
