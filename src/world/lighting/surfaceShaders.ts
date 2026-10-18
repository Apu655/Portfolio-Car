// Surface detail for the golden-hour city (KTD1, KTD5, KTD6 of its plan), ported from the approved look-dev. The
// models export plain named materials; at load each one is patched by name with a shader that adds per-pixel
// detail in world space: mottled grass, asphalt grain and lane wear, paving joints and kerbs, and building walls
// with framed windows that light up at night. Ground surfaces also take warm streetlight pools and the soft
// contact shading of the ground mask. Nothing is downloaded, and the look stays tunable here.
import * as THREE from 'three';
import { LAMPS, ROADS } from '../district/layout';
import { addShaderPatch } from '../scene/shaderPatch';
import { MASK } from './groundMask';

export type SurfaceKind = 'grass' | 'asphalt' | 'paving' | 'paint';

const KINDS: Record<string, SurfaceKind> = {
  grass: 'grass',
  asphalt: 'asphalt',
  sidewalk: 'paving',
  plaza: 'paving',
  road_paint: 'paint',
  road_paint_yellow: 'paint',
};

/** Which surface shader a material gets, by its exported name; null leaves it alone. */
export function surfaceKind(name: string): SurfaceKind | null {
  return KINDS[name] ?? null;
}

/** Most streetlights a ground shader takes. */
export const LAMP_CAP = 48;

/** Every streetlight's head, as (x, z) on the ground under it. */
export function lampList(): THREE.Vector2[] {
  return LAMPS.slice(0, LAMP_CAP).map((l) => {
    // The head hangs over the road, 1.55 m out along the lamp's heading.
    const r = l.rotationY;
    return new THREE.Vector2(l.position[0] - Math.sin(r) * 1.55, l.position[2] - Math.cos(r) * 1.55);
  });
}

/** Uniforms every ground surface shares: updated once per frame or once at load, never per material. */
export const surfaceUniforms = {
  uNight: { value: 0 },
  uLamps: { value: Array.from({ length: LAMP_CAP }, () => new THREE.Vector2()) },
  uLampCount: { value: 0 },
  uGroundMask: { value: null as THREE.Texture | null },
  uMaskHalf: { value: MASK.half },
  uLoop: { value: new THREE.Vector3(ROADS.loop.halfX, ROADS.loop.halfZ, ROADS.loop.cornerRadius) },
  uCrossX: { value: ROADS.crossStreetX },
};

const COMMON = /* glsl */ `
varying vec3 vCeWorld;
varying vec3 vCeNormal;
uniform float uNight;
float ceHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ceNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ceHash(i), ceHash(i + vec2(1, 0)), u.x), mix(ceHash(i + vec2(0, 1)), ceHash(i + vec2(1, 1)), u.x), u.y);
}
float ceFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * ceNoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

const GROUND = /* glsl */ `
uniform vec2 uLamps[${LAMP_CAP}];
uniform int uLampCount;
uniform sampler2D uGroundMask;
uniform float uMaskHalf;
/** Warm pools under the streetlights, strongest right under the head. */
float ceLampPool(vec2 p) {
  float pool = 0.0;
  for (int i = 0; i < ${LAMP_CAP}; i++) {
    if (i >= uLampCount) break;
    vec2 d = p - uLamps[i];
    float d2 = dot(d, d);
    if (d2 < 140.0) pool += exp(-d2 / 26.0);
  }
  return min(pool, 1.4);
}
/** How much nearby walls shade the ground here (0 open, 1 under a building). */
float ceContact(vec2 p) {
  return texture2D(uGroundMask, (p + uMaskHalf) / (2.0 * uMaskHalf)).r;
}
`;

const ASPHALT = /* glsl */ `
uniform vec3 uLoop;
uniform float uCrossX;
/** Distance from the nearest road centre line: the rounded-rectangle loop or the cross street. */
float ceLaneCoordinate(vec2 p) {
  vec2 q = abs(p) - vec2(uLoop.x - uLoop.z, uLoop.y - uLoop.z);
  float loop = abs(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uLoop.z);
  float cross = abs(p.x - uCrossX) + step(uLoop.y, abs(p.y)) * 1000.0;
  return min(loop, cross);
}
`;

/** The per-kind colour and roughness code, run after the material's own colour. */
const BODY: Record<SurfaceKind, string> = {
  grass: /* glsl */ `
    vec2 p = vCeWorld.xz;
    vec3 g1 = vec3(0.36, 0.52, 0.27), g2 = vec3(0.45, 0.6, 0.32), g3 = vec3(0.3, 0.45, 0.29);
    vec3 g = mix(g1, g2, smoothstep(0.32, 0.72, ceFbm(p * 0.035)));
    g = mix(g, g3, smoothstep(0.55, 0.92, ceNoise(p * 0.32)) * 0.35);
    g *= 0.9 + ceNoise(p * 3.1) * 0.16;
    diffuseColor.rgb = g * g * 1.15;
    ceRough = 0.95;`,
  asphalt: /* glsl */ `
    vec2 p = vCeWorld.xz;
    float lane = abs(ceLaneCoordinate(p) - 2.5);
    float track = 1.0 - smoothstep(0.0, 0.45, abs(lane - 0.95));
    vec3 c = diffuseColor.rgb;
    c *= 0.95 + ceNoise(p * 7.0) * 0.1;
    c *= 0.94 + ceFbm(p * 0.05) * 0.12;
    c = mix(c, c * 1.1, track * 0.55);
    c = mix(c, c * 0.82, smoothstep(0.45, 0.0, lane) * 0.4);
    c = mix(c, c * 0.86, smoothstep(0.62, 0.66, ceFbm(p * 0.09 + 7.0)));
    diffuseColor.rgb = c;
    ceRough = mix(0.88, 0.74, track);`,
  paving: /* glsl */ `
    vec3 c = diffuseColor.rgb;
    if (normalize(vCeNormal).y > 0.5) {
      vec2 q = vCeWorld.xz / 1.2;
      vec2 f = fract(q);
      float joint = 1.0 - smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      c *= 0.95 + ceHash(floor(q)) * 0.1;
      c *= 0.96 + ceNoise(vCeWorld.xz * 4.0) * 0.08;
      c = mix(c, c * 0.8, joint);
    } else {
      c *= 0.78; // kerb faces
    }
    diffuseColor.rgb = c;
    ceRough = 0.86;`,
  paint: /* glsl */ `
    diffuseColor.rgb *= 0.9 + ceNoise(vCeWorld.xz * 2.3) * 0.12;
    ceRough = 0.7;`,
};

const WALL = /* glsl */ `
uniform vec2 uOrigin;
uniform vec2 uHalf;
uniform vec4 uAxes;
uniform float uTop;
uniform float uSeed;
uniform vec3 uRoof;
/** Framed windows on a wall, storefronts at street level: sets glass, lit glow, and the frame colour. */
void ceWindowGrid(vec3 n, inout vec3 c, out float glass, out float lit, out vec3 litColor) {
  glass = 0.0; lit = 0.0; litColor = vec3(0.0);
  vec2 t = vec2(-n.z, n.x);
  float span = 2.0 * (abs(dot(t, uAxes.xy)) * uHalf.x + abs(dot(t, uAxes.zw)) * uHalf.y);
  float u = dot(vCeWorld.xz - uOrigin, t) + span * 0.5;
  float y = vCeWorld.y;
  c *= 0.94 + ceNoise(vec2(u, y) * 0.9) * 0.1;
  c *= mix(0.6, 1.0, smoothstep(0.0, 3.2, y));
  float bay = span / max(1.0, floor(span / 3.1 + 0.5));
  vec2 cell;
  if (y < 4.4) {
    float fx = fract(u / bay);
    glass = step(0.06, fx) * step(fx, 0.94) * step(0.45, y) * step(y, 3.65);
    cell = vec2(floor(u / bay), -1.0);
    lit = step(0.2, ceHash(cell + uSeed)) * 1.15;
    litColor = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.78, 0.5), ceHash(cell + 3.0)) * 1.25;
  } else {
    float fu = fract(u / bay);
    float fv = fract((y - 4.4) / 3.4);
    float rows = step(y, uTop - 1.6);
    glass = step(0.24, fu) * step(fu, 0.76) * step(0.22, fv) * step(fv, 0.8) * rows;
    cell = vec2(floor(u / bay), floor((y - 4.4) / 3.4));
    float h = ceHash(cell + uSeed);
    lit = step(0.45, h);
    vec3 warm = mix(vec3(1.0, 0.6, 0.28), vec3(1.0, 0.8, 0.52), ceHash(cell + 9.1));
    litColor = mix(warm, vec3(0.55, 0.72, 1.0), step(0.93, h)) * mix(0.55, 0.95, ceHash(cell + 2.3));
    float frame = (1.0 - glass) * step(0.2, fu) * step(fu, 0.8) * step(0.18, fv) * step(fv, 0.84) * rows;
    c = mix(c, vec3(0.94, 0.9, 0.83), frame * 0.8);
  }
  c = mix(c, vec3(0.17, 0.26, 0.32) * (0.85 + ceNoise(cell * 3.7) * 0.3), glass);
  lit *= glass;
}
`;

const VERTEX_VARYINGS = (shader: THREE.WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCeWorld;\nvarying vec3 vCeNormal;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvCeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCeNormal = normalize(mat3(modelMatrix) * objectNormal);');
};

/** Patch a district ground material with its surface shader, by name. Returns whether it was patched. */
export function patchSurface(material: THREE.Material): boolean {
  const kind = surfaceKind(material.name);
  if (!kind || !(material instanceof THREE.MeshStandardMaterial)) return false;
  // The look-dev's asphalt: a lighter blue-grey than the model's, so grain and lane wear read from above.
  if (kind === 'asphalt') material.color.set('#4a4d55');
  addShaderPatch(material, `surface-${kind}`, (shader) => {
    Object.assign(shader.uniforms, surfaceUniforms);
    VERTEX_VARYINGS(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}\n${GROUND}\n${kind === 'asphalt' ? ASPHALT : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat ceRough = -1.0;\n{${BODY[kind]}}\nfloat cePool = ceLampPool(vCeWorld.xz);\ndiffuseColor.rgb *= 1.0 - ceContact(vCeWorld.xz) * 0.38;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (ceRough >= 0.0) roughnessFactor = ceRough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += (diffuseColor.rgb * 0.5 + 0.06) * vec3(1.0, 0.68, 0.36) * cePool * uNight * 2.2;');
  });
  return true;
}

export interface WallParams {
  /** The building's footprint centre (x, z) and half sizes along its own x and z. */
  origin: [number, number];
  half: [number, number];
  rotationY: number;
  /** World height of the top of the wall (under the cornice). */
  top: number;
  seed: number;
  roof: string;
}

/**
 * Patch one building's wall material with framed windows, storefronts, base shading, and night windows. Call it on
 * the building's own material copy, after `makeDissolvable`, so each building keeps its own uniforms.
 */
export function patchWall(material: THREE.Material, wall: WallParams): void {
  const cos = Math.cos(wall.rotationY);
  const sin = Math.sin(wall.rotationY);
  const own = {
    uOrigin: { value: new THREE.Vector2(...wall.origin) },
    uHalf: { value: new THREE.Vector2(...wall.half) },
    // World directions of the building's own x and z axes.
    uAxes: { value: new THREE.Vector4(cos, -sin, sin, cos) },
    uTop: { value: wall.top },
    uSeed: { value: wall.seed },
    uRoof: { value: new THREE.Color(wall.roof) },
  };
  addShaderPatch(material, 'surface-wall', (shader) => {
    shader.uniforms.uNight = surfaceUniforms.uNight;
    Object.assign(shader.uniforms, own);
    VERTEX_VARYINGS(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}\n${WALL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float ceGlass = 0.0; float ceLit = 0.0; vec3 ceLitColor = vec3(0.0);
vec3 ceN = normalize(vCeNormal);
if (ceN.y > 0.5) diffuseColor.rgb = uRoof * (0.88 + ceFbm(vCeWorld.xz * 0.7) * 0.24);
else if (ceN.y > -0.5) { vec3 ceC = diffuseColor.rgb; ceWindowGrid(ceN, ceC, ceGlass, ceLit, ceLitColor); diffuseColor.rgb = ceC; }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, ceGlass);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.55, ceGlass);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += ceLitColor * ceLit * uNight;');
  });
}

/** Load the lamp list into the shared uniforms once. */
export function installLamps(): void {
  const lamps = lampList();
  lamps.forEach((l, i) => surfaceUniforms.uLamps.value[i].copy(l));
  surfaceUniforms.uLampCount.value = lamps.length;
}
