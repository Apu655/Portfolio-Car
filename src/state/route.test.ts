import { anchorId, formatHash, parseHash } from './route';

describe('parseHash', () => {
  it('reads view, section, and item', () => {
    expect(parseHash('#/3d/research/secarely')).toEqual({
      view: '3d',
      selection: { section: 'research', itemId: 'secarely' },
    });
    expect(parseHash('#/basic/education/monash-mai')).toEqual({ view: 'basic', selection: { section: 'education', itemId: 'monash-mai' } });
    expect(parseHash('#/3d/experience/sysonex')).toEqual({ view: '3d', selection: { section: 'experience', itemId: 'sysonex' } });
    expect(parseHash('#/basic/research')).toEqual({ view: 'basic', selection: { section: 'research' } });
  });

  it('treats a missing view as "not specified"', () => {
    expect(parseHash('#/projects')).toEqual({ view: null, selection: { section: 'projects' } });
    expect(parseHash('')).toEqual({ view: null, selection: null });
  });

  it('drops unknown sections and items instead of failing', () => {
    expect(parseHash('#/3d/nowhere')).toEqual({ view: '3d', selection: null });
    expect(parseHash('#/basic/projects/not-a-project')).toEqual({
      view: 'basic',
      selection: { section: 'projects' },
    });
    expect(parseHash('#/3d/experience/anything')).toEqual({ view: '3d', selection: { section: 'experience' } });
  });
});

describe('formatHash', () => {
  it('round-trips through parseHash', () => {
    const hash = formatHash('3d', { section: 'research', itemId: 'bsl-avatar-tutor' });
    expect(hash).toBe('#/3d/research/bsl-avatar-tutor');
    expect(parseHash(hash)).toEqual({ view: '3d', selection: { section: 'research', itemId: 'bsl-avatar-tutor' } });
    expect(formatHash('basic', null)).toBe('#/basic');
  });
});

describe('anchorId', () => {
  it('gives the basic view element id for a place', () => {
    expect(anchorId({ section: 'projects', itemId: 'ecommerce' })).toBe('projects-ecommerce');
    expect(anchorId({ section: 'contact' })).toBe('contact');
  });
});
