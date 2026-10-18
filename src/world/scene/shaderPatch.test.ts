import * as THREE from 'three';
import { addShaderPatch } from './shaderPatch';

/** Run a material's compile hook the way the renderer does, on a copy of the standard shader source. */
function compile(material: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return { shader, key: material.customProgramCacheKey() };
}

describe('composable shader patches', () => {
  it('applies every patch a material has, in order, and keys the program by all of them', () => {
    const m = new THREE.MeshStandardMaterial();
    addShaderPatch(m, 'a', (s) => (s.fragmentShader = s.fragmentShader.replace('void main() {', 'void main() {\n// patch-a')));
    addShaderPatch(m, 'b', (s) => (s.fragmentShader = s.fragmentShader.replace('void main() {', 'void main() {\n// patch-b')));
    const { shader, key } = compile(m);
    expect(shader.fragmentShader).toContain('// patch-a');
    expect(shader.fragmentShader).toContain('// patch-b');
    expect(key).toBe('a+b');
  });

  it('adds the same patch only once (StrictMode runs set-up twice)', () => {
    const m = new THREE.MeshStandardMaterial();
    const apply = vi.fn();
    addShaderPatch(m, 'a', apply);
    addShaderPatch(m, 'a', apply);
    compile(m);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(m.customProgramCacheKey()).toBe('a');
  });

  it('gives a material with two patches a different program than one with either alone', () => {
    const both = new THREE.MeshStandardMaterial();
    const one = new THREE.MeshStandardMaterial();
    addShaderPatch(both, 'surface-wall', () => undefined);
    addShaderPatch(both, 'ce-dissolve', () => undefined);
    addShaderPatch(one, 'ce-dissolve', () => undefined);
    expect(both.customProgramCacheKey()).not.toBe(one.customProgramCacheKey());
  });
});
