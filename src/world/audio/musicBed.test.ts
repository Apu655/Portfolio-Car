import { MusicBed } from './musicBed';
import { BAR_SECONDS, barEvents, LOOP_BARS } from './routeTheme';

// A minimal stand-in for an AudioContext that records when each oscillator starts.
function fakeContext() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = () => ({ connect: vi.fn((n: unknown) => n) });
  const starts: { type: string; at: number }[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
    createDelay: () => ({ ...node(), delayTime: param() }),
    createConvolver: () => ({ ...node(), buffer: null }),
    createBuffer: (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createPeriodicWave: () => ({}),
    createOscillator: () => {
      const osc = {
        ...node(),
        type: 'sine',
        frequency: param(),
        detune: param(),
        setPeriodicWave: vi.fn(() => {
          osc.type = 'custom';
        }),
        start: vi.fn((at: number) => starts.push({ type: osc.type, at })),
        stop: vi.fn(),
      };
      return osc;
    },
  };
  return { ctx, starts };
}

describe('the music bed plays the route theme', () => {
  it('plays the first bar with a square lead, a triangle bass and a pulse arpeggio', () => {
    const { ctx, starts } = fakeContext();
    const bed = new MusicBed(ctx as unknown as AudioContext, {} as AudioNode);
    bed.update(0);
    const types = new Set(starts.map((s) => s.type));
    expect(types).toEqual(new Set(['square', 'triangle', 'custom']));
    expect(starts.length).toBe(barEvents(0, 0).length);
  });

  it('loops seamlessly: after the last bar the first bar starts exactly one bar later', () => {
    const { ctx, starts } = fakeContext();
    const bed = new MusicBed(ctx as unknown as AudioContext, {} as AudioNode);
    const barStarts: number[] = [];
    let seen = 0;
    for (let t = 0; t < BAR_SECONDS * (LOOP_BARS + 1.5); t += 0.05) {
      ctx.currentTime = t;
      bed.update(0);
      if (starts.length > seen) {
        barStarts.push(Math.min(...starts.slice(seen).map((s) => s.at)));
        seen = starts.length;
      }
    }
    expect(barStarts.length).toBeGreaterThanOrEqual(LOOP_BARS + 1);
    for (let i = 1; i < barStarts.length; i++) expect(barStarts[i] - barStarts[i - 1]).toBeCloseTo(BAR_SECONDS, 6);
  });

  it('plays fewer arpeggio notes at night', () => {
    const day = fakeContext();
    new MusicBed(day.ctx as unknown as AudioContext, {} as AudioNode).update(0);
    const night = fakeContext();
    new MusicBed(night.ctx as unknown as AudioContext, {} as AudioNode).update(1);
    const arps = (s: { type: string }[]) => s.filter((x) => x.type === 'custom').length;
    expect(arps(night.starts)).toBeLessThan(arps(day.starts));
  });
});
