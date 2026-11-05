// The chunky toon look for the character and companions (KTD4 of the walking character plan): each material
// becomes a three-step toon material of the same color, and each mesh gets an inverted-hull outline, a copy drawn
// back-faces-only and pushed out along its normals. The city keeps its own materials.
import * as THREE from 'three';

/** Outline width (m) and color: a warm near-black that reads at noon and against the night city. */
export const OUTLINE = { width: 0.018, color: '#1d1512' } as const;
/** How much of its own color a toon part shows unlit, so the figures still read in the night city. */
export const SELF_LIGHT = 0.22;

let ramp: THREE.DataTexture | null = null;

/** Three flat bands of light: shadow, mid and lit. */
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

function toonOf(source: THREE.Material): THREE.MeshToonMaterial {
  const s = source as THREE.MeshStandardMaterial;
  const toon = new THREE.MeshToonMaterial({ name: source.name, gradientMap: toonRamp() });
  if (s.color) toon.color.copy(s.color);
  if (s.map) toon.map = s.map;
  const glows = s.emissive && s.emissive.getHex() !== 0;
  if (glows) {
    toon.emissive.copy(s.emissive);
    toon.emissiveIntensity = s.emissiveIntensity ?? 1;
  } else {
    toon.emissive.copy(toon.color).multiplyScalar(SELF_LIGHT);
  }
  return toon;
}

function outlineMaterial(width: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ name: 'toon_outline', color: OUTLINE.color, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${width.toFixed(4)};`);
  };
  return material;
}

/**
 * Turn every mesh under `root` toon and give it an outline. Returns the materials it made, for disposal; the
 * geometry stays shared with the source model.
 */
export function toonify(root: THREE.Object3D, width: number = OUTLINE.width): THREE.Material[] {
  const made: THREE.Material[] = [];
  const outline = outlineMaterial(width);
  made.push(outline);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    const materials = Array.isArray(mesh.material) ? mesh.material.map(toonOf) : toonOf(mesh.material);
    mesh.material = materials;
    made.push(...(Array.isArray(materials) ? materials : [materials]));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const hull = new THREE.Mesh(mesh.geometry, outline);
    hull.name = `${mesh.name}_outline`;
    hull.userData.outline = true;
    mesh.add(hull);
  }
  return made;
}
