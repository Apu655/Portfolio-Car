// The player (KTD1 and KTD8 of the walking character plan): the visitor is either on foot or driving, and one
// shared focus says where they are, so the camera, map, audio, captions, robot and stop zones follow whichever
// body they control. The car keeps its own telemetry (events.ts) for splashes, tracks, its engine and knock-overs.
// F gets in near the driver's door, and F while driving brakes the car and steps out at the first clear spot.
import type * as THREE from 'three';
import { create } from 'zustand';

export type PlayerMode = 'foot' | 'entering' | 'driving' | 'stopping';
type Vec2 = [number, number];

export const PLAYER = {
  /** How close (m) to the driver's door F gets in. */
  enterReach: 3,
  /** Seconds the step into the car takes. */
  enterSeconds: 0.35,
  /** Car speed (m/s) under which the character steps out. */
  stopSpeed: 0.5,
  /** How far (m) beside the car's centre line the character stands at a door, and behind it. */
  doorOffset: 1.35,
  behindOffset: 3.3,
} as const;

/** Live values, written every physics step by the body the visitor controls; read without React re-renders. */
export const player = {
  position: [0, 0, 0] as [number, number, number],
  /** Heading of the controlled body (0 faces north, positive turns left). */
  heading: 0,
  /** Ground speed (m/s). */
  speed: 0,
  /** What the camera follows: the walker's figure on foot, the car's body when driving. */
  follow: null as THREE.Object3D | null,
};

/** The mode and whether the car is within reach, for the HUD prompt and touch buttons. */
export const usePlayer = create<{ mode: PlayerMode; nearCar: boolean; setMode(mode: PlayerMode): void; setNearCar(near: boolean): void }>((set, get) => ({
  mode: 'foot',
  nearCar: false,
  setMode: (mode) => {
    if (get().mode !== mode) set({ mode });
  },
  setNearCar: (nearCar) => {
    if (get().nearCar !== nearCar) set({ nearCar });
  },
}));

/** A point `along` metres ahead of and `across` metres to the right of `at`, for a body facing `heading`. */
function offset(at: Vec2, heading: number, along: number, across: number): Vec2 {
  const forward: Vec2 = [-Math.sin(heading), -Math.cos(heading)];
  const right: Vec2 = [Math.cos(heading), -Math.sin(heading)];
  return [at[0] + forward[0] * along + right[0] * across, at[1] + forward[1] * along + right[1] * across];
}

/** Where the character stands at a door: `side` 1 is the driver's (right-hand) side, -1 the passenger's. */
export function doorPoint(car: Vec2, heading: number, side: 1 | -1): Vec2 {
  return offset(car, heading, 0, side * PLAYER.doorOffset);
}

export function canEnter(walker: Vec2, car: Vec2, heading: number): boolean {
  const [x, z] = doorPoint(car, heading, 1);
  return Math.hypot(walker[0] - x, walker[1] - z) <= PLAYER.enterReach;
}

/** Where the character may step out, in order of preference: the driver's side, the passenger side, behind. */
export function exitSpots(car: Vec2, heading: number): [Vec2, Vec2, Vec2] {
  return [doorPoint(car, heading, 1), doorPoint(car, heading, -1), offset(car, heading, -PLAYER.behindOffset, 0)];
}

/** The first exit spot where `clear` says the character can stand, or null if none is. */
export function pickExit(car: Vec2, heading: number, clear: (x: number, z: number) => boolean): Vec2 | null {
  return exitSpots(car, heading).find(([x, z]) => clear(x, z)) ?? null;
}

/** The mode after F: on foot near the car gets in, and driving starts stopping to get out. */
export function pressF(mode: PlayerMode, nearCar: boolean): PlayerMode {
  if (mode === 'foot') return nearCar ? 'entering' : 'foot';
  if (mode === 'driving') return 'stopping';
  return mode;
}

/**
 * The mode after `elapsed` seconds in it: the step in finishes, and stopping steps out once the car is slow, or
 * goes back to driving when no exit spot is clear (`canExit`).
 */
export function settle(mode: PlayerMode, elapsed: number, carSpeed: number, canExit: boolean): PlayerMode {
  if (mode === 'entering' && elapsed >= PLAYER.enterSeconds) return 'driving';
  if (mode === 'stopping' && Math.abs(carSpeed) < PLAYER.stopSpeed) return canExit ? 'foot' : 'driving';
  return mode;
}

/** Fast travel moves the walker on foot, and the car otherwise. */
export function travelTarget(mode: PlayerMode): 'walker' | 'car' {
  return mode === 'foot' ? 'walker' : 'car';
}
