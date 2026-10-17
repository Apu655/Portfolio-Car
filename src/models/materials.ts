import * as THREE from 'three';
import { facadeTextures } from './textures';

/** Cohesive palette: warm stone, slate glass, brass accents, and a sea-foam retro car. */
export const PALETTE = {
  stone: '#d9d0bf',
  stoneDark: '#a99f8e',
  slate: '#5d6b80',
  gold: '#d9a441',
  copper: '#5fa08a',
  glassBlue: '#7fb0d8',
  asphalt: '#2c2f35',
  concrete: '#8d9097',
  sidewalk: '#b4b6b9',
  grass: '#4d6e3f',
  carBody: '#3aa6a0',
  carCream: '#f3e9d2',
  chrome: '#e9eaec',
  warmLight: '#ffd59a',
} as const;

/**
 * Materials whose glow follows the time of day carry `userData.emissiveByNight = [day, night]`
 * (emissive intensity) or `userData.opacityByNight = [day, night]`; the scene's lighting system applies them.
 */
export function byNight<T extends THREE.Material>(material: T, key: 'emissiveByNight' | 'opacityByNight', day: number, night: number): T {
  material.userData[key] = [day, night];
  return material;
}

export function standard(color: string, options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...options });
}

export function glow(color: string, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

/** Windowed facade, tinted by `color`; windows light up at night. */
export function facade(color: string, nightGlow = 1.15): THREE.MeshStandardMaterial {
  const { map, emissiveMap, pbrMap } = facadeTextures();
  const material = new THREE.MeshStandardMaterial({
    color,
    map,
    emissive: '#ffffff',
    emissiveMap,
    emissiveIntensity: 0,
    roughnessMap: pbrMap,
    metalnessMap: pbrMap,
    roughness: 1,
    metalness: 1,
  });
  return byNight(material, 'emissiveByNight', 0, nightGlow);
}

/** Stone or metal that is floodlit at night. */
export function floodlit(color: string, options: THREE.MeshStandardMaterialParameters = {}, night = 0.35): THREE.MeshStandardMaterial {
  const material = standard(color, { emissive: '#ffcf8a', emissiveIntensity: 0, ...options });
  return byNight(material, 'emissiveByNight', 0, night);
}
