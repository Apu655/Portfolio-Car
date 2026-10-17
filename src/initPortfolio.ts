import { chooseInitialView, detectCapabilities } from './lib/capabilities';
import { parseHash } from './state/route';
import { usePortfolio } from './state/store';

/** Reads the URL and device capabilities, then decides where the visitor lands. */
export function initPortfolio(): void {
  const caps = detectCapabilities();
  const route = parseHash(window.location.hash);
  const { view, notice } = chooseInitialView(route, caps);
  usePortfolio.getState().init({
    view,
    selection: route.selection,
    notice,
    webglAvailable: caps.webgl,
    reducedMotion: caps.reducedMotion,
  });
}
