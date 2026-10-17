import { anchorId, formatHash, parseHash } from './route';

describe('parseHash', () => {
  it('reads view, section, and item', () => {
    expect(parseHash('#/3d/research/llm-calibration')).toEqual({
      view: '3d',
      selection: { section: 'research', itemId: 'llm-calibration' },
    });
    expect(parseHash('#/basic/education/msc')).toEqual({ view: 'basic', selection: { section: 'education', itemId: 'msc' } });
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
    // The career tower has a single role, so experience links carry no item.
    expect(parseHash('#/3d/experience/anything')).toEqual({ view: '3d', selection: { section: 'experience' } });
  });
});

describe('formatHash', () => {
  it('round-trips through parseHash', () => {
    const hash = formatHash('3d', { section: 'research', itemId: 'clinical-notes-llm' });
    expect(hash).toBe('#/3d/research/clinical-notes-llm');
    expect(parseHash(hash)).toEqual({ view: '3d', selection: { section: 'research', itemId: 'clinical-notes-llm' } });
    expect(formatHash('basic', null)).toBe('#/basic');
  });
});

describe('anchorId', () => {
  it('gives the basic view element id for a place', () => {
    expect(anchorId({ section: 'projects', itemId: 'eval-kit' })).toBe('projects-eval-kit');
    expect(anchorId({ section: 'contact' })).toBe('contact');
  });
});
