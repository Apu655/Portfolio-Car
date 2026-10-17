import * as THREE from 'three';
import { seededRandom } from './noise';

/** One facade texture tile covers this many meters (8 × 8 window bays of 4 m). */
export const FACADE_METERS = 32;
const BAYS = 8;
const BAY_PX = 16;
const SIZE = BAYS * BAY_PX;

function dataTexture(data: Uint8Array, size: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const isGlass = (x: number, y: number) => {
  const bx = x % BAY_PX;
  const by = y % BAY_PX;
  return bx >= 3 && bx <= 12 && by >= 3 && by <= 12;
};

export interface FacadeTextures {
  /** Base color: light frames (tinted per building) and blue-grey glass. */
  map: THREE.DataTexture;
  /** Warm lit windows at night (some on, some off). */
  emissiveMap: THREE.DataTexture;
  /** Roughness in G, metalness in B: glass is smooth and reflective, frames are matte. */
  pbrMap: THREE.DataTexture;
}

let cached: FacadeTextures | undefined;

export function facadeTextures(): FacadeTextures {
  if (cached) return cached;
  const random = seededRandom(4242);
  const color = new Uint8Array(SIZE * SIZE * 4);
  const emissive = new Uint8Array(SIZE * SIZE * 4);
  const pbr = new Uint8Array(SIZE * SIZE * 4);
  const lit: number[] = Array.from({ length: BAYS * BAYS }, () => {
    const r = random();
    return r < 0.42 ? 1 : r < 0.5 ? 2 : 0; // warm, cool, off
  });
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const glass = isGlass(x, y);
      const shade = glass ? 0.82 + ((y % BAY_PX) / BAY_PX) * 0.18 : 1;
      color.set(glass ? [78 * shade, 98 * shade, 122 * shade, 255] : [236, 234, 228, 255], i);
      const state = lit[Math.floor(y / BAY_PX) * BAYS + Math.floor(x / BAY_PX)];
      const glow = glass && state === 1 ? [255, 196, 128] : glass && state === 2 ? [200, 220, 255] : [0, 0, 0];
      emissive.set([...glow, 255], i);
      pbr.set([0, glass ? 40 : 215, glass ? 190 : 10, 255], i);
    }
  }
  cached = {
    map: dataTexture(color, SIZE, true),
    emissiveMap: dataTexture(emissive, SIZE, true),
    pbrMap: dataTexture(pbr, SIZE, false),
  };
  return cached;
}

/**
 * Lets one facade material tile at real-world scale on instanced boxes of any size: each instance's scale is read
 * from its matrix and applied to the UVs. Roofs sample a frame texel so they stay plain.
 */
export function scaleFacadeUVsByInstance(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      /* glsl */ `#include <uv_vertex>
#ifdef USE_INSTANCING
  vec3 instScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec2 facadeScale = vec2(abs(normal.x) > 0.5 ? instScale.z : instScale.x, instScale.y) / ${FACADE_METERS.toFixed(1)};
  bool facadeRoof = abs(normal.y) > 0.5;
  #ifdef USE_MAP
    vMapUv = facadeRoof ? vec2(0.004) : vMapUv * facadeScale;
  #endif
  #ifdef USE_EMISSIVEMAP
    vEmissiveMapUv = facadeRoof ? vec2(0.004) : vEmissiveMapUv * facadeScale;
  #endif
  #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv = facadeRoof ? vec2(0.004) : vRoughnessMapUv * facadeScale;
  #endif
  #ifdef USE_METALNESSMAP
    vMetalnessMapUv = facadeRoof ? vec2(0.004) : vMetalnessMapUv * facadeScale;
  #endif
#endif`,
    );
  };
  material.customProgramCacheKey = () => 'facade-instanced';
}

/** Scale a non-instanced geometry's UVs so the facade tiles at real-world size (UVs assumed 0..1 per face). */
export function scaleFacadeUVs(geometry: THREE.BufferGeometry, widthMeters: number, heightMeters: number): THREE.BufferGeometry {
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * widthMeters) / FACADE_METERS, (uv.getY(i) * heightMeters) / FACADE_METERS);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Soft round falloff (white center → transparent edge) for light pools, the car's contact shadow, and beams. */
export function radialTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = Math.round(Math.pow(1 - d, 2) * 255);
      // Falloff in every channel: works as a color map (with alpha) and as an alphaMap (which reads green).
      data.set([a, a, a, a], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Vertical fade (opaque bottom → transparent top) for the entrance light beams. */
export function verticalFadeTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(4 * size * 4);
  for (let y = 0; y < size; y++) {
    const a = Math.round(Math.pow(1 - y / (size - 1), 1.6) * 255);
    for (let x = 0; x < 4; x++) data.set([a, a, a, a], (y * 4 + x) * 4);
  }
  const texture = new THREE.DataTexture(data, 4, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Scrolling "code and charts" screen pattern for the Projects Tower facade. */
export function screenTexture(accent: string): THREE.DataTexture {
  const w = 64;
  const h = 128;
  const random = seededRandom(99);
  const data = new Uint8Array(w * h * 4);
  const base = new THREE.Color(accent);
  for (let y = 0; y < h; y++) {
    const lineOn = random() < 0.7;
    const length = 8 + Math.floor(random() * 48);
    const indent = (Math.floor(random() * 4) * 4) % 16;
    const hue = random();
    for (let x = 0; x < w; x++) {
      const on = lineOn && y % 4 !== 0 && x >= indent + 4 && x < indent + length && x < w - 3;
      const c = on ? (hue < 0.6 ? base : hue < 0.85 ? new THREE.Color('#9fe7ff') : new THREE.Color('#ffffff')) : new THREE.Color('#0b1020');
      data.set([c.r * 255, c.g * 255, c.b * 255, 255], (y * w + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}
