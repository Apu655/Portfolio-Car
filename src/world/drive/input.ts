import { useEffect, useRef, type RefObject } from 'react';

/** Each axis in [-1, 1]. Positive throttle drives forward; positive steer turns left. */
export interface DriveInput {
  throttle: number;
  steer: number;
  handbrake: boolean;
}

export const KEY_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  recover: ['KeyR'],
} as const;

const DRIVE_CODES = new Set<string>(Object.values(KEY_BINDINGS).flat());

const any = (pressed: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => pressed.has(c));

export function readKeyboardInput(pressed: ReadonlySet<string>): DriveInput {
  const axis = (positive: readonly string[], negative: readonly string[]) =>
    (any(pressed, positive) ? 1 : 0) - (any(pressed, negative) ? 1 : 0);
  return {
    throttle: axis(KEY_BINDINGS.forward, KEY_BINDINGS.back),
    steer: axis(KEY_BINDINGS.left, KEY_BINDINGS.right),
    handbrake: any(pressed, KEY_BINDINGS.handbrake),
  };
}

/** Whether the recover key is held. */
export function wantsRecover(pressed: ReadonlySet<string>): boolean {
  return any(pressed, KEY_BINDINGS.recover);
}

/** Written by the on-screen buttons on touch devices; read by the car each frame. */
export const touchInput: DriveInput = { throttle: 0, steer: 0, handbrake: false };

/** The on-screen joystick in screen space (x right, y up, each -1..1); the car maps it with `stickToDrive`. */
export const touchStick = { x: 0, y: 0 };

/** One-shot touch actions (the Recover button). */
export const touchActions = { recover: false };

/** Keyboard wins when any key is held; otherwise the touch controls drive. */
export function combineInputs(keyboard: DriveInput, touch: DriveInput): DriveInput {
  const keyboardActive = keyboard.throttle !== 0 || keyboard.steer !== 0 || keyboard.handbrake;
  return keyboardActive ? keyboard : { ...touch };
}

/**
 * Whether a key event should drive the car. Keys typed into fields, keys used inside the menu or an info
 * panel, and Space/Enter on a focused button or link belong to the page, not the car.
 */
export function shouldDrive(event: Pick<KeyboardEvent, 'code' | 'target' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  if (!DRIVE_CODES.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-keyboard-scope]')) return false;
  if ((event.code === 'Space' || event.code === 'Enter') && target.closest('button, a, summary')) return false;
  return true;
}

/** Tracks which driving keys are held. Read the ref inside the render loop; it never triggers re-renders. */
export function useDriveKeys(): RefObject<Set<string>> {
  const pressed = useRef(new Set<string>());
  useEffect(() => {
    const keys = pressed.current;
    const onDown = (event: KeyboardEvent) => {
      if (!shouldDrive(event)) return;
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
