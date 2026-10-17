import { readFlightInput, shouldSteer } from './input';

describe('readFlightInput', () => {
  it('maps WASD, arrows, and up/down keys to axes', () => {
    expect(readFlightInput(new Set(['KeyW']))).toEqual({ thrust: 1, turn: 0, lift: 0 });
    expect(readFlightInput(new Set(['ArrowDown', 'ArrowLeft']))).toEqual({ thrust: -1, turn: 1, lift: 0 });
    expect(readFlightInput(new Set(['KeyD', 'Space']))).toEqual({ thrust: 0, turn: -1, lift: 1 });
    expect(readFlightInput(new Set(['ShiftLeft']))).toEqual({ thrust: 0, turn: 0, lift: -1 });
  });

  it('cancels opposing keys and ignores unrelated ones', () => {
    expect(readFlightInput(new Set(['KeyW', 'KeyS', 'KeyX']))).toEqual({ thrust: 0, turn: 0, lift: 0 });
  });
});

describe('shouldSteer', () => {
  const event = (code: string, target: EventTarget | null, modifiers: Partial<KeyboardEvent> = {}) => ({
    code,
    target,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...modifiers,
  });

  it('steers for flight keys pressed on the page', () => {
    expect(shouldSteer(event('KeyW', document.body))).toBe(true);
  });

  it('leaves typing, menus, panels, and shortcuts alone', () => {
    const input = document.createElement('input');
    const scope = document.createElement('div');
    scope.setAttribute('data-keyboard-scope', '');
    const inPanel = document.createElement('a');
    scope.append(inPanel);
    expect(shouldSteer(event('KeyW', input))).toBe(false);
    expect(shouldSteer(event('ArrowDown', inPanel))).toBe(false);
    expect(shouldSteer(event('KeyW', document.body, { metaKey: true }))).toBe(false);
    expect(shouldSteer(event('KeyM', document.body))).toBe(false);
  });

  it('lets Space activate a focused button instead of lifting the ship', () => {
    const button = document.createElement('button');
    expect(shouldSteer(event('Space', button))).toBe(false);
    expect(shouldSteer(event('KeyW', button))).toBe(true);
  });
});
