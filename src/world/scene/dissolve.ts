// See-through buildings (KTD6 of the isometric camera plan): a blocking object dissolves into a fine screen-space
// dot pattern instead of turning transparent, so it keeps writing depth and never mis-sorts against glass.
// Materials are patched when the scene loads, so the shader variant compiles behind the loading screen.
import * as THREE from 'three';

/** At full fade this share of pixels is dropped; the rest keep a faint ghost so the building still reads. */
const MAX_DROP = 0.82;

export interface Dissolvable {
  /** 0 = solid, 1 = fully dissolved. */
  fade: { value: number };
}

/** Registered dissolvable objects, keyed like the occluder volumes (`tower`, `building-3`, …). */
export const dissolveTargets = new Map<string, Dissolvable>();

const DITHER = /* glsl */ `
uniform float uDissolve;
float ceDissolveBayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x + q.y * 4.0);
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i] + 0.5) / 16.0;
}
`;

function patch(material: THREE.Material, fade: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = fade;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${DITHER}\nvoid main() {\n  if (uDissolve > 0.0 && ceDissolveBayer(gl_FragCoord.xy) < uDissolve * ${MAX_DROP.toFixed(2)}) discard;`);
  };
  // One shared program per material type: every patched material compiles the same source.
  material.customProgramCacheKey = () => 'ce-dissolve';
  material.needsUpdate = true;
}

/**
 * Make every mesh under `root` dissolvable through one shared fade value. With `cloneMaterials`, each mesh gets
 * its own material copies first: use it where several objects share materials (backdrop building clones, the
 * kiosks), so fading one leaves the others solid. Without it, materials are patched in place: use it for
 * single-instance objects whose materials other code already holds (the billboard's per-letter materials).
 */
export function makeDissolvable(root: THREE.Object3D, { cloneMaterials }: { cloneMaterials: boolean }): Dissolvable {
  // Idempotent: StrictMode runs the callers' memos twice, and the fade registered must be the one the materials use.
  const existing = root.userData.dissolve as Dissolvable | undefined;
  if (existing) return existing;
  const fade = { value: 0 };
  const copies = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const convert = (m: THREE.Material) => {
      if (!cloneMaterials) {
        patch(m, fade);
        return m;
      }
      let copy = copies.get(m);
      if (!copy) {
        copy = m.clone();
        patch(copy, fade);
        copies.set(m, copy);
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
  });
  const dissolvable: Dissolvable = { fade };
  root.userData.dissolve = dissolvable;
  return dissolvable;
}
