// Covers AE4: no audio context exists until the visitor's first gesture.
import { AudioEngine, voiceGain } from './AudioEngine';
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

describe('how loud a one-shot plays', () => {
  it('a splash or a brick hit beside the car plays near full level when the car is the listener', () => {
    const car: [number, number, number] = [10, 0.5, 20];
    expect(voiceGain(1, [10.5, 0.4, 21], car)).toBeGreaterThan(0.9);
  });

  it('fades with distance from the car, so far-off hits stay quiet', () => {
    const car: [number, number, number] = [0, 0.5, 0];
    expect(voiceGain(1, [14, 0.5, 0], car)).toBeCloseTo(0.5, 2);
    expect(voiceGain(1, [60, 0.5, 0], car)).toBeLessThan(0.15);
  });
});

