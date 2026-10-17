import * as THREE from 'three';

/** Shared palette for the neon-futurist look. Colors only — no textures, so models export cleanly to glTF. */
export const PALETTE = {
  hull: '#c9d3e6',
  hullDark: '#3a4566',
  glass: '#62e6ff',
  neonCyan: '#3ff0ff',
  neonMagenta: '#ff4fd8',
  neonAmber: '#ffb347',
  gold: '#e8b04a',
  stone: '#b9b2a3',
  stoneDark: '#7d776c',
  clockFace: '#fff4d6',
  ground: '#151a33',
  rock: '#3b2f4f',
  rockDark: '#1d1729',
} as const;

export function standard(color: string, options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...options });
}

export function glow(color: string, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}
