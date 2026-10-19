import * as THREE from 'three';
import { BUILDINGS, HEADING, type Building } from '../district/layout';
import { ROOFTOP_ALLOWANCE } from '../district/occluders';
import { NIGHT_GLOW } from '../lighting/Lighting';
import { patchWall } from '../lighting/surfaceShaders';
import { BAND_Y, buildingPlan, mergeParts, neonMaterial, partGeometry, ROOF_MARGIN, type BuildingPlan, type Part } from './buildingPlan';

const boundsOf = (part: Part) => new THREE.Box3().setFromBufferAttribute(partGeometry(part).getAttribute('position') as THREE.BufferAttribute);
const props = (plan: BuildingPlan) => plan.parts.filter((p) => p.role === 'prop');
const tankParts = (plan: BuildingPlan) => props(plan).filter((p) => p.prop === 'tank');

/** Run a material's compile hook the way the renderer does, on a copy of the standard shader source. */
function compiledUniforms(material: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  return shader.uniforms;
}

describe('city buildings', () => {
  it('assembles every building inside its footprint (cornice overhang allowed) and up to its height', () => {
    BUILDINGS.forEach((b, i) => {
      const plan = buildingPlan(b, i);
      const box = new THREE.Box3();
      for (const w of plan.walls) box.union(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...w.at), new THREE.Vector3(...w.size)));
      for (const p of [...plan.parts.filter((p) => p.role !== 'prop'), ...(plan.neon?.parts ?? [])]) box.union(boundsOf(p));
      expect(box.min.x, `building ${i}`).toBeGreaterThanOrEqual(-b.half[0] - 0.6);
      expect(box.max.x, `building ${i}`).toBeLessThanOrEqual(b.half[0] + 0.6);
      expect(box.min.z, `building ${i}`).toBeGreaterThanOrEqual(-b.half[1] - 0.6);
      expect(box.max.z, `building ${i}`).toBeLessThanOrEqual(b.half[1] + 0.6);
      expect(box.min.y, `building ${i}`).toBeGreaterThanOrEqual(-1e-6);
      expect(Math.abs(box.max.y - b.height), `building ${i}`).toBeLessThanOrEqual(0.1);
      // Rooftop props rise above the parapet, but no higher than the occluders allow for.
      for (const p of props(plan)) expect(boundsOf(p).max.y, `building ${i}`).toBeLessThanOrEqual(b.height + ROOFTOP_ALLOWANCE);
    });
  });

  it('keeps the storefront band and a water tank at their modeled sizes whatever the height (nothing stretches)', () => {
    const footprint = { center: [0, 0], half: [8, 7], rotationY: HEADING.south, palette: 0, variant: 0 } as const;
    const at = (height: number): Building => ({ ...footprint, center: [0, 0], half: [8, 7], height });
    const index = Array.from({ length: 200 }, (_, i) => i).find((i) => tankParts(buildingPlan(at(12), i)).length > 0)!;
    expect(index).toBeDefined();
    const [low, mid, tall] = [12, 26, 60].map((h) => buildingPlan(at(h), index));
    for (const plan of [mid, tall]) {
      for (const role of ['plinth', 'band'] as const) {
        expect(plan.parts.filter((p) => p.role === role)).toEqual(low.parts.filter((p) => p.role === role));
      }
      const tank = (p: BuildingPlan) => tankParts(p).map((t) => ({ shape: t.shape, size: t.size, above: Math.round((t.at[1] - p.roof.y) * 1e6) / 1e6 }));
      expect(tank(plan)).toEqual(tank(low));
    }
    const band = low.parts.find((p) => p.role === 'band')!;
    expect(band.at[1]).toBe(BAND_Y);
  });

  it('stands rooftop props on the roof, inside its outline minus a margin', () => {
    let withTwo = 0;
    BUILDINGS.forEach((b, i) => {
      const plan = buildingPlan(b, i);
      const placed = new Set(props(plan).map((p) => p.group));
      expect(placed.size, `building ${i}`).toBeGreaterThanOrEqual(1);
      expect(placed.size, `building ${i}`).toBeLessThanOrEqual(3);
      if (placed.size >= 2) withTwo++;
      for (const p of props(plan)) {
        const box = boundsOf(p);
        expect(box.min.y, `building ${i}`).toBeGreaterThanOrEqual(plan.roof.y - 1e-4);
        expect(Math.abs(box.min.x), `building ${i}`).toBeLessThanOrEqual(plan.roof.half[0] - ROOF_MARGIN + 1e-4);
        expect(Math.abs(box.max.x), `building ${i}`).toBeLessThanOrEqual(plan.roof.half[0] - ROOF_MARGIN + 1e-4);
        expect(Math.abs(box.min.z), `building ${i}`).toBeLessThanOrEqual(plan.roof.half[1] - ROOF_MARGIN + 1e-4);
        expect(Math.abs(box.max.z), `building ${i}`).toBeLessThanOrEqual(plan.roof.half[1] - ROOF_MARGIN + 1e-4);
      }
    });
    expect(withTwo).toBeGreaterThanOrEqual(BUILDINGS.length * 0.85);
  });

  it("gives each wall's window grid the real width of every face", () => {
    BUILDINGS.forEach((b, i) => {
      const plan = buildingPlan(b, i);
      expect(plan.walls[0].size[0]).toBeCloseTo(b.half[0] * 2, 6);
      expect(plan.walls[0].size[2]).toBeCloseTo(b.half[1] * 2, 6);
      for (const w of plan.walls) {
        const material = new THREE.MeshStandardMaterial();
        patchWall(material, w.wall);
        const u = compiledUniforms(material);
        const origin = u.uOrigin.value as THREE.Vector2;
        const half = u.uHalf.value as THREE.Vector2;
        const axes = u.uAxes.value as THREE.Vector4;
        expect([origin.x, origin.y]).toEqual(b.center);
        expect(u.uTop.value).toBeCloseTo(w.at[1] + w.size[1] / 2, 6);
        // The shader's own span along each face (WALL in surfaceShaders.ts): t = (-n.z, n.x).
        for (const [nx, nz, width] of [[0, 1, w.size[0]], [0, -1, w.size[0]], [1, 0, w.size[2]], [-1, 0, w.size[2]]]) {
          const [tx, tz] = [-nz, nx];
          const span = 2 * (Math.abs(tx * axes.x + tz * axes.y) * half.x + Math.abs(tx * axes.z + tz * axes.w) * half.y);
          expect(span, `building ${i} face ${nx},${nz}`).toBeCloseTo(width, 6);
          // The grid runs from one corner of the face (u = 0) to the other (u = span).
          const corner = (s: number) => {
            const x = b.center[0] + nx * (w.size[0] / 2) + tx * s * (width / 2);
            const z = b.center[1] + nz * (w.size[2] / 2) + tz * s * (width / 2);
            return (x - origin.x) * tx + (z - origin.y) * tz + span / 2;
          };
          expect(corner(-1)).toBeCloseTo(0, 6);
          expect(corner(1)).toBeCloseTo(width, 6);
        }
      }
    });
  });

  it('hangs awnings and signs on the front face, the one toward rotationY', () => {
    BUILDINGS.forEach((b, i) => {
      const plan = buildingPlan(b, i);
      const front = [-Math.sin(b.rotationY), -Math.cos(b.rotationY)];
      const reach = Math.abs(front[0]) > 0.5 ? b.half[0] : b.half[1];
      const awnings = plan.parts.filter((p) => p.role === 'awning');
      expect(awnings.length, `building ${i}`).toBeGreaterThan(0);
      for (const p of [...awnings, ...(plan.neon?.parts ?? [])]) {
        expect(p.at[0] * front[0] + p.at[2] * front[1], `building ${i}`).toBeGreaterThan(reach);
      }
    });
  });

  it('chooses props and signs the same way every time for a given index', () => {
    BUILDINGS.forEach((b, i) => expect(buildingPlan(b, i)).toEqual(buildingPlan(b, i)));
    const mixes = new Set(BUILDINGS.map((b, i) => props(buildingPlan(b, i)).filter((p, k, all) => all.findIndex((q) => q.group === p.group) === k).map((p) => p.prop).join('+')));
    expect(mixes.size).toBeGreaterThanOrEqual(8);
  });

  it('lights a few storefronts with neon materials named neon_ that glow at night', () => {
    const lit = BUILDINGS.map((b, i) => buildingPlan(b, i).neon).filter((n) => n !== null);
    expect(lit.length).toBeGreaterThanOrEqual(4);
    expect(lit.length).toBeLessThanOrEqual(BUILDINGS.length / 3);
    for (const n of lit) {
      const material = neonMaterial(n.accent);
      expect(material.name.startsWith('neon_')).toBe(true);
      expect(material.emissive.getHex()).toBe(material.color.getHex());
    }
    const glow = NIGHT_GLOW.find(([name]) => name === 'neon_');
    expect(glow).toBeDefined();
    expect(glow![2]).toBeGreaterThan(glow![1]);
  });

  it('merges a building’s details into one vertex-coloured geometry', () => {
    const plan = buildingPlan(BUILDINGS[0], 0);
    const merged = mergeParts(plan.parts);
    expect(merged.getAttribute('color').count).toBe(merged.getAttribute('position').count);
    expect(merged.groups.length).toBe(0);
  });
});
