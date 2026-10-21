import { BREAKABLE_COLLIDERS, STATIC_COLLIDERS } from './colliders';
import { LAMPS, TREES } from './layout';

describe('lamp posts and trees as knock-overs', () => {
  it('leaves no lamp or tree among the solid colliders', () => {
    expect(STATIC_COLLIDERS.filter((c) => /^(lamp|tree)-/.test(c.name))).toEqual([]);
  });

  it('gives every lamp and tree a breakable collider where its pole or trunk stands', () => {
    expect(BREAKABLE_COLLIDERS.filter((c) => c.object === 'lamp').map((c) => c.index)).toEqual(LAMPS.map((_, i) => i));
    expect(BREAKABLE_COLLIDERS.filter((c) => c.object === 'tree').map((c) => c.index)).toEqual(TREES.map((_, i) => i));
    for (const c of BREAKABLE_COLLIDERS) {
      const record = c.object === 'lamp' ? LAMPS[c.index] : TREES[c.index];
      expect([c.position[0], c.position[2]]).toEqual([record.position[0], record.position[2]]);
      expect(c.radius).toBe(c.object === 'lamp' ? 0.2 : 0.28 * record.scale);
    }
  });
});
