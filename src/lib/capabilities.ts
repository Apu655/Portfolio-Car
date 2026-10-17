import type { Route, View } from '../state/route';

export interface Capabilities {
  webgl: boolean;
  /** WebGL runs on a CPU rasterizer (SwiftShader, llvmpipe…) — usable but slow. */
  softwareRenderer: boolean;
  reducedMotion: boolean;
}

const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function detectCapabilities(): Capabilities {
  const reducedMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let webgl = false;
  let softwareRenderer = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      webgl = true;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      softwareRenderer = SOFTWARE_RENDERERS.test(renderer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl = false;
  }
  return { webgl, softwareRenderer, reducedMotion };
}

export interface InitialView {
  view: View;
  /** Shown to the visitor when we did not open the 3D world, explaining why. */
  notice: string | null;
}

/**
 * The 3D world is the default. The basic view opens instead when the URL asks for it,
 * when the device cannot run WebGL, or when motion or rendering would make 3D a poor first screen.
 * An explicit "#/3d/..." link still opens 3D on a capable-but-slow device or with reduced motion.
 */
export function chooseInitialView(route: Route, caps: Capabilities): InitialView {
  if (!caps.webgl) {
    return {
      view: 'basic',
      notice: 'Your browser can’t run the 3D world (WebGL is unavailable), so you’re seeing the quick view.',
    };
  }
  if (route.view) return { view: route.view, notice: null };
  if (caps.reducedMotion) {
    return {
      view: 'basic',
      notice: 'Reduced motion is on, so the quick view opened first. You can still explore in 3D.',
    };
  }
  if (caps.softwareRenderer) {
    return {
      view: 'basic',
      notice: 'Your device is rendering graphics without a GPU, so the quick view opened first. You can still explore in 3D.',
    };
  }
  return { view: '3d', notice: null };
}
