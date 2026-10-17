import { useMemo } from 'react';
import { createBuildings, createGroundAndRoads, createSkyline, createStreetlights, createTrees } from '../../models/cityMeshes';

/** Static city: ground, roads and markings, sidewalks, buildings, skyline, trees, streetlights. Built once. */
export function City() {
  const parts = useMemo(
    () => [createGroundAndRoads(), createBuildings(), createSkyline(), createTrees(), createStreetlights()],
    [],
  );
  return (
    <>
      {parts.map((part) => (
        <primitive key={part.name} object={part} />
      ))}
    </>
  );
}
