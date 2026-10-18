// Composable shader patches (KTD11 of the golden-hour city plan). A material can carry several patches, such as
// the dissolve and a surface shader, without one replacing the other: each patch is registered under a key, every
// patch runs at compile time in the order added, and the program cache key names them all, so a material with
// both patches never shares a compiled program with one that has only one.
import type * as THREE from 'three';

type Shader = THREE.WebGLProgramParametersWithUniforms;

interface Patch {
  key: string;
  apply: (shader: Shader) => void;
}

// Kept beside the material rather than in `userData`, which `Material.clone()` copies through JSON.
const patches = new WeakMap<THREE.Material, Patch[]>();

/** Add a compile-time patch to `material` under `key`; adding the same key again does nothing. */
export function addShaderPatch(material: THREE.Material, key: string, apply: (shader: Shader) => void): void {
  let list = patches.get(material);
  if (!list) {
    list = [];
    patches.set(material, list);
    const own = list;
    material.onBeforeCompile = (shader) => own.forEach((p) => p.apply(shader));
    material.customProgramCacheKey = () => own.map((p) => p.key).join('+');
  }
  if (list.some((p) => p.key === key)) return;
  list.push({ key, apply });
  material.needsUpdate = true;
}
