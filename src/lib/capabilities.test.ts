import { chooseInitialView, type Capabilities } from './capabilities';
import type { Route } from '../state/route';

const capable: Capabilities = { webgl: true, softwareRenderer: false, reducedMotion: false };
const noRoute: Route = { view: null, selection: null };

describe('chooseInitialView', () => {
  it('opens the 3D world first on a capable device', () => {
    expect(chooseInitialView(noRoute, capable)).toEqual({ view: '3d', notice: null });
  });

  it('falls back to the quick view with an explanation when WebGL is missing, even for a 3D link', () => {
    const result = chooseInitialView({ view: '3d', selection: null }, { ...capable, webgl: false });
    expect(result.view).toBe('basic');
    expect(result.notice).toMatch(/WebGL/);
  });

  it('opens the quick view first when reduced motion is on or rendering is software-only', () => {
    expect(chooseInitialView(noRoute, { ...capable, reducedMotion: true }).view).toBe('basic');
    expect(chooseInitialView(noRoute, { ...capable, softwareRenderer: true }).view).toBe('basic');
  });

  it('honors an explicit view in the URL on a capable device', () => {
    expect(chooseInitialView({ view: 'basic', selection: null }, capable)).toEqual({ view: 'basic', notice: null });
    expect(chooseInitialView({ view: '3d', selection: null }, { ...capable, reducedMotion: true }).view).toBe('3d');
  });
});
