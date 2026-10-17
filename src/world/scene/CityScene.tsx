import { useMemo } from 'react';
import { createCity } from '../../models/city';
import { createIsland } from '../../models/terrain';
import { CITY_BUILDINGS } from '../layout';

/** The floating island and the city on it. Static geometry, built once. */
export function CityScene() {
  const island = useMemo(createIsland, []);
  const city = useMemo(() => createCity(CITY_BUILDINGS), []);
  return (
    <>
      <primitive object={island} />
      <primitive object={city} />
    </>
  );
}
