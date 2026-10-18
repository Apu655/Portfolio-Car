import * as THREE from 'three';
import { LAMPS, ROADS } from '../district/layout';
import { makeDissolvable } from '../scene/dissolve';
import { lampList, LAMP_CAP, patchSurface, patchWall, surfaceKind, surfaceUniforms } from './surfaceShaders';

function compile(material: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return { shader, key: material.customProgramCacheKey() };
}

const wall = {
  origin: [10, -20] as [number, number],
  half: [8, 6] as [number, number],
  rotationY: 0,
  top: 18,
  seed: 3,
  roof: '#8a8379',
};

describe('surface shaders by material name', () => {
  it('maps each district surface to its shader and leaves other materials alone', () => {
    expect(surfaceKind('grass')).toBe('grass');
    expect(surfaceKind('asphalt')).toBe('asphalt');
    expect(surfaceKind('sidewalk')).toBe('paving');
    expect(surfaceKind('plaza')).toBe('paving');
    expect(surfaceKind('road_paint')).toBe('paint');
    expect(surfaceKind('road_paint_yellow')).toBe('paint');
    expect(surfaceKind('car_paint')).toBeNull();
    expect(surfaceKind('limestone')).toBeNull();
  });

  it('patches a material once, however often set-up runs', () => {
    const m = new THREE.MeshStandardMaterial({ name: 'asphalt' });
    patchSurface(m);
    patchSurface(m);
    expect(m.customProgramCacheKey()).toBe('surface-asphalt');
    expect(compile(m).shader.fragmentShader.match(/ceLaneCoordinate\(/g)?.length).toBe(2); // declared once, used once
  });

  it('finds asphalt lanes from the road centre line, so corners and the cross street wear too', () => {
    const m = new THREE.MeshStandardMaterial({ name: 'asphalt' });
    patchSurface(m);
    compile(m);
    expect(surfaceUniforms.uLoop.value.toArray()).toEqual([ROADS.loop.halfX, ROADS.loop.halfZ, ROADS.loop.cornerRadius]);
    expect(surfaceUniforms.uCrossX.value).toBe(ROADS.crossStreetX);
  });

  it('gives a dissolvable building wall both its windows and the dissolve, in its own program', () => {
    const root = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'bld_wall' }));
    makeDissolvable(root, { cloneMaterials: true });
    const material = root.material as THREE.MeshStandardMaterial;
    patchWall(material, wall);
    const { shader, key } = compile(material);
    expect(shader.fragmentShader).toContain('discard');
    expect(shader.fragmentShader).toContain('ceWindowGrid');
    const dissolveOnly = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    makeDissolvable(dissolveOnly, { cloneMaterials: true });
    expect(key).not.toBe((dissolveOnly.material as THREE.Material).customProgramCacheKey());
  });

  it('gives each building its own window uniforms', () => {
    const a = new THREE.MeshStandardMaterial({ name: 'bld_wall' });
    const b = new THREE.MeshStandardMaterial({ name: 'bld_wall' });
    patchWall(a, wall);
    patchWall(b, { ...wall, origin: [40, 0], top: 60 });
    expect(compile(a).shader.uniforms.uTop.value).toBe(18);
    expect(compile(b).shader.uniforms.uTop.value).toBe(60);
  });

  it('lists every streetlight for the lamp pools, within the shader cap', () => {
    const lamps = lampList();
    expect(lamps.length).toBe(LAMPS.length);
    expect(lamps.length).toBeLessThanOrEqual(LAMP_CAP);
  });
});
