// Gameplay events and telemetry. Physics publishes; audio, VFX, and UI subscribe — none of them reach into
// each other. Continuous values live in `telemetry` (read every frame, no React re-renders); discrete moments
// go through the typed event bus.
import type { Section } from '../state/route';

export type Vec3 = [number, number, number];
export type TowerSection = Exclude<Section, 'about'>;
export type PropMaterial = 'plastic' | 'wood' | 'metal' | 'brick' | 'stone';

export type GameEvent =
  | { type: 'impact'; material: PropMaterial; intensity: number; position: Vec3; source: string }
  | { type: 'splash'; intensity: number; position: Vec3 }
  | { type: 'waterEnter'; speed: number }
  | { type: 'waterExit' }
  | { type: 'zoneEnter'; section: TowerSection }
  | { type: 'zoneExit'; section: TowerSection }
  | { type: 'recover' }
  | { type: 'robotHit'; position: Vec3 };

export type GameEventType = GameEvent['type'];
type Handler<T extends GameEventType> = (event: Extract<GameEvent, { type: T }>) => void;
type AnyHandler = (event: GameEvent) => void;

const handlers = new Map<GameEventType, Set<AnyHandler>>();

/** Subscribe to one event type; returns an unsubscribe function. */
export function on<T extends GameEventType>(type: T, handler: Handler<T>): () => void {
  const set = handlers.get(type) ?? new Set<AnyHandler>();
  const wrapped = handler as unknown as AnyHandler;
  set.add(wrapped);
  handlers.set(type, set);
  return () => set.delete(wrapped);
}

export function emit(event: GameEvent): void {
  handlers.get(event.type)?.forEach((handler) => handler(event));
}

/** Continuous car and world state, written by physics each step and read by audio, VFX, and HUD each frame. */
export interface Telemetry {
  /** Signed forward speed in m/s. */
  speed: number;
  /** Engine load 0..1, rises with speed and throttle. */
  rpm: number;
  throttle: number;
  braking: boolean;
  reversing: boolean;
  /** 0..1 lateral tire slip, for skid sounds and marks. */
  slip: number;
  /** Seconds of "wet tires" left after leaving water. */
  wet: number;
  inWater: boolean;
  /** Number of wheels touching the ground or water floor. */
  wheelsOnGround: number;
  position: Vec3;
  /** Car heading (radians; 0 faces north, positive turns left). */
  heading: number;
  /** Where the left and right rear tires touch the surface, or null while that wheel is in the air. */
  rearContacts: [Vec3 | null, Vec3 | null];
  /** Nitro tank 0..1, whether it is firing, and whether it ran dry and is still refilling to the re-arm level. */
  boost: number;
  boosting: boolean;
  boostLocked: boolean;
}

export const telemetry: Telemetry = {
  speed: 0,
  rpm: 0,
  throttle: 0,
  braking: false,
  reversing: false,
  slip: 0,
  wet: 0,
  inWater: false,
  wheelsOnGround: 0,
  position: [0, 0, 0],
  heading: 0,
  rearContacts: [null, null],
  boost: 1,
  boosting: false,
  boostLocked: false,
};
