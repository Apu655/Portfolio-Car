import { anchorId, formatHash, parseHash } from './route';

describe('parseHash', () => {
  it('reads view, section, and item', () => {
    expect(parseHash('#/3d/experience/senior-engineer')).toEqual({
      view: '3d',
      selection: { section: 'experience', itemId: 'senior-engineer' },
    });
    expect(parseHash('#/basic/research')).toEqual({ view: 'basic', selection: { section: 'research' } });
  });

  it('treats a missing view as "not specified"', () => {
    expect(parseHash('#/projects')).toEqual({ view: null, selection: { section: 'projects' } });
    expect(parseHash('')).toEqual({ view: null, selection: null });
  });

  it('drops unknown sections and items instead of failing', () => {
    expect(parseHash('#/3d/nowhere')).toEqual({ view: '3d', selection: null });
    expect(parseHash('#/basic/experience/not-a-role')).toEqual({
      view: 'basic',
      selection: { section: 'experience' },
    });
  });
});

describe('formatHash', () => {
  it('round-trips through parseHash', () => {
    const hash = formatHash('3d', { section: 'research', itemId: 'adaptive-quests' });
    expect(hash).toBe('#/3d/research/adaptive-quests');
    expect(parseHash(hash)).toEqual({ view: '3d', selection: { section: 'research', itemId: 'adaptive-quests' } });
    expect(formatHash('basic', null)).toBe('#/basic');
  });
});

describe('anchorId', () => {
  it('gives the basic view element id for a place', () => {
    expect(anchorId({ section: 'experience', itemId: 'software-engineer' })).toBe('experience-software-engineer');
    expect(anchorId({ section: 'contact' })).toBe('contact');
  });
});
