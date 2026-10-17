import { useEffect, useRef, type RefObject } from 'react';
import type { FlightInput } from './flightModel';

export const KEY_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['Space', 'KeyE'],
  down: ['ShiftLeft', 'ShiftRight', 'KeyQ'],
} as const;

const FLIGHT_CODES = new Set<string>(Object.values(KEY_BINDINGS).flat());

const any = (pressed: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => pressed.has(c));

export function readFlightInput(pressed: ReadonlySet<string>): FlightInput {
  const axis = (positive: readonly string[], negative: readonly string[]) =>
    (any(pressed, positive) ? 1 : 0) - (any(pressed, negative) ? 1 : 0);
  return {
    thrust: axis(KEY_BINDINGS.forward, KEY_BINDINGS.back),
    turn: axis(KEY_BINDINGS.left, KEY_BINDINGS.right),
    lift: axis(KEY_BINDINGS.up, KEY_BINDINGS.down),
  };
}

/**
 * Whether a key event should steer the ship. Keys typed into fields, keys used inside the menu or an
 * info panel, and Space/Enter on a focused button or link belong to the page, not the ship.
 */
export function shouldSteer(event: Pick<KeyboardEvent, 'code' | 'target' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  if (!FLIGHT_CODES.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-keyboard-scope]')) return false;
  if ((event.code === 'Space' || event.code === 'Enter') && target.closest('button, a, summary')) return false;
  return true;
}

/** Tracks which flight keys are held. Read the ref inside the render loop; it never triggers re-renders. */
export function useFlightKeys(): RefObject<Set<string>> {
  const pressed = useRef(new Set<string>());
  useEffect(() => {
    const keys = pressed.current;
    const onDown = (event: KeyboardEvent) => {
      if (!shouldSteer(event)) return;
      event.preventDefault(); // stop Space and arrows from scrolling the page
      keys.add(event.code);
    };
    const onUp = (event: KeyboardEvent) => keys.delete(event.code);
    const clear = () => keys.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  return pressed;
}
