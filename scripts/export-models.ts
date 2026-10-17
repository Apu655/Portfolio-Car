// Exports the procedural car and landmark towers to binary glTF (.glb) in models-export/, so they can be opened,
// inspected, or hand-refined in Blender (File → Import → glTF 2.0). The site itself builds models in code.
//
//   npm run models:export
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createRetroCoupe } from '../src/models/car';
import { LANDMARK_BUILDERS } from '../src/models/landmarks';
import { TOWERS } from '../src/world/city/cityLayout';

// GLTFExporter packs binary output through the browser FileReader API; Node has Blob but not FileReader.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onload: (() => void) | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => this.finish(buffer));
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.finish(`data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`);
    });
  }
  private finish(result: ArrayBuffer | string) {
    this.result = result;
    this.onload?.();
    this.onloadend?.();
  }
}
(globalThis as Record<string, unknown>).FileReader ??= NodeFileReader;

/** Procedural textures need a canvas to encode as PNG, which Node lacks; export colors and shapes only. */
function stripTextures(root: THREE.Object3D): THREE.Object3D {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = materials.map((m) => {
      const copy = m.clone() as THREE.MeshStandardMaterial;
      for (const key of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap'] as const) copy[key] = null;
      return copy;
    }) as THREE.Material[];
    if (materials.length === 1) mesh.material = (mesh.material as THREE.Material[])[0];
  });
  return root;
}

const MODELS: Record<string, () => THREE.Object3D> = {
  'retro-coupe': () => createRetroCoupe().group,
  ...Object.fromEntries(TOWERS.map((site) => [`tower-${site.section}`, () => LANDMARK_BUILDERS[site.section](site).group])),
};

const outDir = fileURLToPath(new URL('../models-export/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const exporter = new GLTFExporter();

for (const [name, build] of Object.entries(MODELS)) {
  const scene = new THREE.Scene();
  scene.add(stripTextures(build()));
  const glb = (await exporter.parseAsync(scene, { binary: true })) as ArrayBuffer;
  writeFileSync(`${outDir}${name}.glb`, Buffer.from(glb));
  console.log(`${name.padEnd(20)} ${(glb.byteLength / 1024).toFixed(1).padStart(7)} KB  →  models-export/${name}.glb`);
}
