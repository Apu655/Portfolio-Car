// Exports the procedural models to binary glTF (.glb) in models-export/, so they can be opened, inspected,
// or hand-refined in Blender (File → Import → glTF 2.0). The site itself builds models in code at runtime.
//
//   npm run models:export
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { roles } from '../src/content/portfolio';
import { createCity, layoutCity } from '../src/models/city';
import { createSpaceship } from '../src/models/ship';
import { createBeacon, createMonolith, createObservatory, createShipyard } from '../src/models/stations';
import { createIsland } from '../src/models/terrain';
import { createCareerTower } from '../src/models/tower';

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

function tower(): THREE.Group {
  const { shell, floors } = createCareerTower(roles.map((r) => r.id));
  const group = new THREE.Group();
  group.name = 'CareerTower';
  group.add(shell, ...floors);
  return group;
}

const MODELS: Record<string, () => THREE.Object3D> = {
  spaceship: createSpaceship,
  'career-tower': tower,
  city: () => createCity(layoutCity()),
  island: createIsland,
  'research-observatory': createObservatory,
  'projects-shipyard': createShipyard,
  'contact-beacon': createBeacon,
  'about-monolith': createMonolith,
};

const outDir = fileURLToPath(new URL('../models-export/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const exporter = new GLTFExporter();

for (const [name, build] of Object.entries(MODELS)) {
  const scene = new THREE.Scene();
  scene.add(build());
  const glb = (await exporter.parseAsync(scene, { binary: true })) as ArrayBuffer;
  const file = `${outDir}${name}.glb`;
  writeFileSync(file, Buffer.from(glb));
  console.log(`${name.padEnd(22)} ${(glb.byteLength / 1024).toFixed(1).padStart(7)} KB  →  models-export/${name}.glb`);
}
