import * as THREE from 'three';
import { LAMPS, TREES } from '../district/layout';
import { breakableOf, BREAKABLE, cutObject, isKnocked, knock, knockVersion, lampId, patchHideable, treeId, writeKnockFlags } from './breakables';
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

describe('cutting a knocked object out for its flying copy', () => {
  /** Two one-triangle objects (ids 2 and 7) merged in one mesh, placed by a node transform like the model's. */
  function merged() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0, 0, 6, 0, 0, 5, 1, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(18).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    g.setAttribute('_obj_index', new THREE.Float32BufferAttribute([2, 2, 2, 7, 7, 7], 1));
    g.setIndex([0, 1, 2, 3, 4, 5]);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'bark' }));
    mesh.name = 'tree_trunks';
    mesh.position.set(10, 0, 0);
    const root = new THREE.Group();
    root.add(mesh);
    root.updateMatrixWorld(true);
    return { root, material: mesh.material };
  }

  it('keeps only that object’s triangles, in world space around its base', () => {
    const { root } = merged();
    const copy = cutObject(root, ['tree_trunks'], 7, [15, 0, 0]);
    const mesh = copy.children[0] as THREE.Mesh;
    const position = mesh.geometry.getAttribute('position');
    expect(position.count).toBe(3);
    expect([position.getX(0), position.getX(1), position.getX(2)]).toEqual([0, 1, 0]);
    expect(mesh.geometry.getAttribute('_obj_index')).toBeUndefined();
  });

  it('draws with its own fading copy of the material, so the original and the hide patch are untouched', () => {
    const { root, material } = merged();
    const mesh = cutObject(root, ['tree_trunks'], 2, [10, 0, 0]).children[0] as THREE.Mesh;
    expect(mesh.material).not.toBe(material);
    expect((mesh.material as THREE.Material).transparent).toBe(true);
    expect((mesh.material as THREE.Material).customProgramCacheKey()).not.toContain('ce-hide');
  });

  it('finds nothing for an id the meshes do not hold', () => {
    const { root } = merged();
    expect(cutObject(root, ['tree_trunks'], 99, [0, 0, 0]).children).toHaveLength(0);
  });
});
