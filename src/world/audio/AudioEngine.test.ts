// Covers AE4: no audio context exists until the visitor's first gesture.
import { AudioEngine } from './AudioEngine';
import { useAudioSettings } from './settings';

describe('audio unlock (AE4)', () => {
  it('creates no audio context on load, and creates one on the first key press', () => {
    const create = vi.fn((): AudioContext | null => null);
    const detach = new AudioEngine(create).attach();
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(create).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(create).toHaveBeenCalledTimes(1);
    detach();
  });

  it('a click or tap unlocks too, and nothing listens after teardown', () => {
    const create = vi.fn((): AudioContext | null => null);
    const detach = new AudioEngine(create).attach();
    window.dispatchEvent(new Event('pointerdown'));
    expect(create).toHaveBeenCalledTimes(1);
    detach();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(useAudioSettings.getState().status).toBe('pending');
  });
});
