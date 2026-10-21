import * as THREE from 'three';
import { LAMPS, TREES } from '../district/layout';
import { breakableOf, BREAKABLE, isKnocked, knock, knockVersion, lampId, patchHideable, treeId, writeKnockFlags } from './breakables';
import { makeDissolvable } from './dissolve';

describe('knocked-over lamps and trees', () => {
  it('remembers a knock once, and counts it once', () => {
    const before = knockVersion();
    expect(knock(lampId(3))).toBe(true);
    expect(isKnocked(lampId(3))).toBe(true);
    expect(knock(lampId(3))).toBe(false);
    expect(knockVersion()).toBe(before + 1);
    expect(isKnocked(lampId(4))).toBe(false);
  });

  it('gives lamps and trees separate ids that map back to their records', () => {
    expect(lampId(0)).toBe(BREAKABLE.lampBase);
    expect(treeId(0)).toBe(BREAKABLE.treeBase);
    expect(lampId(LAMPS.length - 1)).toBeLessThan(BREAKABLE.treeBase);
    expect(treeId(TREES.length - 1)).toBeLessThan(BREAKABLE.flags);
    expect(breakableOf(lampId(2))).toEqual({ kind: 'lamp', index: 2 });
    expect(breakableOf(treeId(7))).toEqual({ kind: 'tree', index: 7 });
    expect(breakableOf(0)).toBeNull();
  });

  it('writes a flag per id for the shader', () => {
    knock(treeId(9));
    const flags = new Uint8Array(BREAKABLE.flags);
    writeKnockFlags(flags);
    expect(flags[treeId(9)]).toBe(255);
    expect(flags[treeId(10)]).toBe(0);
  });
});

function compile(material: THREE.Material, depth = false) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: depth ? THREE.ShaderLib.depth.vertexShader : THREE.ShaderLib.physical.vertexShader,
    fragmentShader: depth ? THREE.ShaderLib.depth.fragmentShader : THREE.ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return { shader, key: material.customProgramCacheKey() };
}

describe('hiding a knocked object inside a merged mesh', () => {
  it('collapses knocked vertices in both the colour pass and the shadow pass', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'bark' }));
    patchHideable(mesh);
    const { shader } = compile(mesh.material as THREE.Material);
    expect(shader.vertexShader).toContain('_obj_index');
    expect(shader.uniforms.uKnocked).toBeDefined();
    expect(mesh.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
    expect(compile(mesh.customDepthMaterial!, true).shader.vertexShader).toContain('_obj_index');
  });

  it('composes with the dissolve patch in its own program', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'leaf_a' }));
    makeDissolvable(mesh, { cloneMaterials: true });
    const plainDissolve = (mesh.material as THREE.Material).customProgramCacheKey();
    patchHideable(mesh);
    const { shader, key } = compile(mesh.material as THREE.Material);
    expect(shader.fragmentShader).toContain('discard');
    expect(shader.vertexShader).toContain('_obj_index');
    expect(key).not.toBe(plainDissolve);
  });

  it('patches a shared material once, however many meshes use it', () => {
    const material = new THREE.MeshStandardMaterial({ name: 'lamp_metal' });
    const a = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const b = new THREE.Mesh(new THREE.BoxGeometry(), material);
    patchHideable(a);
    patchHideable(b);
    expect(compile(material).shader.vertexShader.match(/attribute float _obj_index/g)?.length).toBe(1);
  });
});
