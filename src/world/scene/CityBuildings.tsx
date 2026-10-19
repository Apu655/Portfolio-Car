import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BUILDINGS } from '../district/layout';
import { patchWall } from '../lighting/surfaceShaders';
import { buildingPlan, mergeParts, neonMaterial, WALL_COLORS } from './buildingPlan';
import { dissolveTargets, makeDissolvable, type Dissolvable } from './dissolve';

/** Shared by every building's details (plinth, brass line, awnings, cornice, parapet, rooftop props), then copied per building by the dissolve. */
const detailMaterial = new THREE.MeshStandardMaterial({ name: 'city_details', vertexColors: true, roughness: 0.8 });

/**
 * The city blocks (U5 of the golden-hour city plan): each building assembled at its block's exact size, in two or
 * three draw calls: its wall boxes, its merged details, and on a few storefronts a neon sign. Each building
 * dissolves on its own when it hides the car (`building-${i}`, as the occluders key it).
 */
export function CityBuildings() {
  const buildings = useMemo(
    () =>
      BUILDINGS.map((b, i) => {
        const plan = buildingPlan(b, i);
        const group = new THREE.Group();
        group.position.set(b.center[0], 0, b.center[1]);
        const color = WALL_COLORS[b.palette % WALL_COLORS.length];
        const walls = plan.walls.map((w) => {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), new THREE.MeshStandardMaterial({ name: 'city_wall', color, roughness: 0.85 }));
          mesh.position.set(...w.at);
          return mesh;
        });
        const details = new THREE.Mesh(mergeParts(plan.parts), detailMaterial);
        group.add(...walls, details);
        if (plan.neon) group.add(new THREE.Mesh(mergeParts(plan.neon.parts), neonMaterial(plan.neon.accent)));
        group.traverse((o) => {
          o.castShadow = true;
          o.receiveShadow = true;
        });
        // Copy the materials first, then give each wall copy its own window grid (KTD11).
        const dissolve = makeDissolvable(group, { cloneMaterials: true });
        walls.forEach((mesh, k) => patchWall(mesh.material as THREE.Material, plan.walls[k].wall));
        return { group, dissolve };
      }),
    [],
  );

  useEffect(() => {
    const entries: Array<[string, Dissolvable]> = buildings.map((b, i) => [`building-${i}`, b.dissolve]);
    entries.forEach(([key, d]) => dissolveTargets.set(key, d));
    return () => entries.forEach(([key]) => dissolveTargets.delete(key));
  }, [buildings]);

  return (
    <>
      {buildings.map((b, i) => (
        <primitive key={i} object={b.group} />
      ))}
    </>
  );
}
