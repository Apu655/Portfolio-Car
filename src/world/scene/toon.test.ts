import * as THREE from 'three';
import { OUTLINE, SELF_LIGHT, toonify } from './toon';

const toonOf = (mesh: THREE.Mesh) => mesh.material as THREE.MeshToonMaterial;

function part(name: string, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name, color }));
  mesh.name = name;
  return mesh;
}

describe('toon look', () => {
  it('keeps each material’s color, as a toon material with a stepped ramp', () => {
    const root = new THREE.Group();
    root.add(part('char_skin', '#a8714b'), part('char_jacket', '#2f6e73'));
    toonify(root);
    const [skin, jacket] = root.children as THREE.Mesh[];
    expect(skin.material).toBeInstanceOf(THREE.MeshToonMaterial);
    expect(toonOf(skin).color.getHexString()).toBe(new THREE.Color('#a8714b').getHexString());
    expect(toonOf(jacket).name).toBe('char_jacket');
    expect((toonOf(skin).gradientMap?.image as { width: number }).width).toBe(3);
  });

  it('shows a little of its own color unlit, so it reads at night, and keeps a real glow as it is', () => {
    const root = new THREE.Group();
    const plain = part('char_skin', '#a8714b');
    const glow: THREE.Mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#9ff3ff', emissiveIntensity: 2 }));
    root.add(plain, glow);
    toonify(root);
    const self = toonOf(plain).emissive;
    expect(self.r).toBeCloseTo(toonOf(plain).color.r * SELF_LIGHT, 6);
    expect(toonOf(glow).emissive.getHexString()).toBe(new THREE.Color('#9ff3ff').getHexString());
    expect(toonOf(glow).emissiveIntensity).toBe(2);
  });

  it('adds one back-face outline per part, sharing its geometry', () => {
    const root = new THREE.Group();
    const arm = part('char_jacket', '#2f6e73');
    const hand = part('char_skin', '#a8714b');
    arm.add(hand);
    root.add(arm);
    const made = toonify(root);
    const outlines: THREE.Mesh[] = [];
    root.traverse((o) => o.userData.outline && outlines.push(o as THREE.Mesh));
    expect(outlines).toHaveLength(2);
    const armOutline = outlines.find((o) => o.parent === arm)!;
    expect(armOutline.geometry).toBe(arm.geometry);
    expect(outlines.find((o) => o.parent === hand)!.geometry).toBe(hand.geometry);
    const outline = armOutline.material as THREE.MeshBasicMaterial;
    expect(outline.side).toBe(THREE.BackSide);
    expect(outline.color.getHexString()).toBe(new THREE.Color(OUTLINE.color).getHexString());
    // Two toon materials and the one shared outline.
    expect(made).toHaveLength(3);
  });
});
