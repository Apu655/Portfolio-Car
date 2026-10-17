import { emit, on } from './events';

describe('event bus', () => {
  it('delivers typed events to subscribers of that type only', () => {
    const impacts: number[] = [];
    const splashes: number[] = [];
    const offImpact = on('impact', (e) => impacts.push(e.intensity));
    const offSplash = on('splash', (e) => splashes.push(e.intensity));
    emit({ type: 'impact', material: 'plastic', intensity: 0.4, position: [0, 0, 0], source: 'cone-1' });
    emit({ type: 'splash', intensity: 0.9, position: [1, 0, 1] });
    expect(impacts).toEqual([0.4]);
    expect(splashes).toEqual([0.9]);
    offImpact();
    offSplash();
  });

  it('stops delivering after unsubscribe', () => {
    const seen: string[] = [];
    const off = on('zoneEnter', (e) => seen.push(e.section));
    emit({ type: 'zoneEnter', section: 'experience' });
    off();
    emit({ type: 'zoneEnter', section: 'research' });
    expect(seen).toEqual(['experience']);
  });
});
