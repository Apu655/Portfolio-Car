import type { ShowcaseItem } from '../content/showcase';
import { useGateCaptions } from './gateCaptions';

const item = (title: string): ShowcaseItem => ({ title, subtitle: '', line: `${title} line` });

describe('gate captions', () => {
  beforeEach(() => useGateCaptions.setState({ section: null, items: [null, null], shown: {} }));

  it('captions the nearest gate with what its screens already show', () => {
    useGateCaptions.getState().publish('research', [item('A'), item('B')]);
    expect(useGateCaptions.getState().items).toEqual([null, null]); // no gate nearby yet
    useGateCaptions.getState().setNearest('research');
    expect(useGateCaptions.getState().items.map((i) => i?.title)).toEqual(['A', 'B']);
  });

  it('follows page turns on the nearest gate only', () => {
    useGateCaptions.getState().setNearest('projects');
    useGateCaptions.getState().publish('research', [item('R1'), null]);
    expect(useGateCaptions.getState().items).toEqual([null, null]);
    useGateCaptions.getState().publish('projects', [item('P3'), item('P4')]);
    expect(useGateCaptions.getState().items.map((i) => i?.title)).toEqual(['P3', 'P4']);
  });

  it('clears when no gate is in range', () => {
    useGateCaptions.getState().publish('contact', [item('Email'), null]);
    useGateCaptions.getState().setNearest('contact');
    useGateCaptions.getState().setNearest(null);
    expect(useGateCaptions.getState().section).toBeNull();
    expect(useGateCaptions.getState().items).toEqual([null, null]);
  });
});
