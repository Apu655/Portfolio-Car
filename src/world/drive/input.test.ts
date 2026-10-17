import { combineInputs, readKeyboardInput, shouldDrive } from './input';

describe('readKeyboardInput', () => {
  it('maps WASD, arrows, and Space', () => {
    expect(readKeyboardInput(new Set(['KeyW']))).toEqual({ throttle: 1, steer: 0, handbrake: false });
    expect(readKeyboardInput(new Set(['ArrowDown', 'ArrowLeft']))).toEqual({ throttle: -1, steer: 1, handbrake: false });
    expect(readKeyboardInput(new Set(['KeyD', 'Space']))).toEqual({ throttle: 0, steer: -1, handbrake: true });
  });

  it('cancels opposing keys and ignores unrelated ones', () => {
    expect(readKeyboardInput(new Set(['KeyW', 'KeyS', 'KeyE']))).toEqual({ throttle: 0, steer: 0, handbrake: false });
  });
});

describe('combineInputs', () => {
  it('uses the keyboard while a key is held, otherwise the touch controls', () => {
    const touch = { throttle: 0.5, steer: -0.3, handbrake: false };
    expect(combineInputs({ throttle: 1, steer: 0, handbrake: false }, touch).throttle).toBe(1);
    expect(combineInputs({ throttle: 0, steer: 0, handbrake: false }, touch)).toEqual(touch);
  });
});

describe('shouldDrive', () => {
  const event = (code: string, target: EventTarget | null, modifiers: Partial<KeyboardEvent> = {}) => ({
    code,
    target,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...modifiers,
  });

  it('drives for driving keys pressed on the page', () => {
    expect(shouldDrive(event('KeyW', document.body))).toBe(true);
  });

  it('leaves typing, menus, panels, interaction keys, and shortcuts alone', () => {
    const input = document.createElement('input');
    const scope = document.createElement('div');
    scope.setAttribute('data-keyboard-scope', '');
    const inPanel = document.createElement('a');
    scope.append(inPanel);
    expect(shouldDrive(event('KeyW', input))).toBe(false);
    expect(shouldDrive(event('ArrowDown', inPanel))).toBe(false);
    expect(shouldDrive(event('KeyW', document.body, { metaKey: true }))).toBe(false);
    expect(shouldDrive(event('KeyE', document.body))).toBe(false);
  });

  it('lets Space activate a focused button instead of pulling the handbrake', () => {
    const button = document.createElement('button');
    expect(shouldDrive(event('Space', button))).toBe(false);
    expect(shouldDrive(event('KeyW', button))).toBe(true);
  });
});
