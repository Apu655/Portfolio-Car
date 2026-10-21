// Lamp posts and trees that can be knocked over (KTD1 and KTD6 of the knock-overs and boost plan). They stay
// merged in the district model, where every vertex carries its object's id (`_OBJ_INDEX`, written by
// assets/blender/models/district.py), and a vertex patch collapses the ids that have been knocked over. The set of
// knocked ids belongs to the page, not a component: leaving for the quick view unmounts the scene, and the city
// must still be missing what was knocked over when the visitor comes back. Only a reload brings it back.
import * as THREE from 'three';
import { addShaderPatch } from './shaderPatch';

/** Id ranges, matching district.py: lamp i is `lampBase + i`, tree i is `treeBase + i`; 0 means untagged. */
export const BREAKABLE = { lampBase: 1, treeBase: 513, flags: 1024 } as const;

export const lampId = (index: number) => BREAKABLE.lampBase + index;
export const treeId = (index: number) => BREAKABLE.treeBase + index;

/** Which lamp or tree an id names, or null for an untagged vertex. */
export function breakableOf(id: number): { kind: 'lamp' | 'tree'; index: number } | null {
  if (id >= BREAKABLE.treeBase) return { kind: 'tree', index: id - BREAKABLE.treeBase };
  if (id >= BREAKABLE.lampBase) return { kind: 'lamp', index: id - BREAKABLE.lampBase };
  return null;
}

const knocked = new Set<number>();
let version = 0;

/** Knock an object over. Returns false if it was already down. */
export function knock(id: number): boolean {
  if (knocked.has(id)) return false;
  knocked.add(id);
  version++;
  return true;
}

export const isKnocked = (id: number) => knocked.has(id);

/** Moves on every new knock, so the scene knows when to refresh what depends on the set. */
export const knockVersion = () => version;

/** A 0/255 flag per id, as the hide patch reads them. */
export function writeKnockFlags(out: Uint8Array): void {
  out.fill(0);
  for (const id of knocked) if (id < out.length) out[id] = 255;
}

/** The flags as a one-row texture every hide patch shares; `refreshKnockFlags` uploads the current set. */
const flags = new Uint8Array(BREAKABLE.flags);
const flagTexture = new THREE.DataTexture(flags, BREAKABLE.flags, 1, THREE.RedFormat, THREE.UnsignedByteType);
const hideUniforms = { uKnocked: { value: flagTexture } };

export function refreshKnockFlags(): void {
  writeKnockFlags(flags);
  flagTexture.needsUpdate = true;
}
refreshKnockFlags();

/** Collapse a knocked object's vertices to a point, so its triangles vanish from the merged mesh. */
function hide(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uKnocked = hideUniforms.uKnocked;
  shader.vertexShader = shader.vertexShader
    .replace(
      'void main() {',
      `attribute float _obj_index;\nuniform sampler2D uKnocked;\nvoid main() {`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      if (_obj_index > 0.5 && texture2D(uKnocked, vec2((_obj_index + 0.5) / ${BREAKABLE.flags.toFixed(1)}, 0.5)).r > 0.5) transformed = vec3(0.0);`,
    );
}

/** One depth material for every hideable mesh's shadow, carrying the same patch. */
let depthMaterial: THREE.MeshDepthMaterial | null = null;

/**
 * Let `mesh`'s knocked objects disappear: patch its materials (shared materials are patched once) and give it a
 * depth material with the same patch, since shadows are drawn with a depth material that never sees the colour
 * material's patches.
 */
export function patchHideable(mesh: THREE.Mesh): void {
  (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => addShaderPatch(m, 'ce-hide', hide));
  if (!depthMaterial) {
    depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    addShaderPatch(depthMaterial, 'ce-hide', hide);
  }
  mesh.customDepthMaterial = depthMaterial;
}
