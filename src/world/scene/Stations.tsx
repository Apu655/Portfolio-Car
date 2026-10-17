import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createBeacon,
  createMonolith,
  createObservatory,
  createShipyard,
  STATION_LIGHT,
} from '../../models/stations';
import type { Section } from '../../state/route';
import { STATION_POSITIONS } from '../layout';
import { Selectable } from './Selectable';

interface StationSpec {
  section: Exclude<Section, 'experience'>;
  build: () => THREE.Group;
  spin: number;
}

const STATIONS: StationSpec[] = [
  { section: 'about', build: createMonolith, spin: 0 },
  { section: 'research', build: createObservatory, spin: 0.08 },
  { section: 'projects', build: createShipyard, spin: 0 },
  { section: 'contact', build: createBeacon, spin: 0.05 },
];

function Station({ spec }: { spec: StationSpec }) {
  const model = useMemo(spec.build, [spec]);
  const light = useMemo(() => model.getObjectByName(STATION_LIGHT), [model]);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }, dt) => {
    model.rotation.y += spec.spin * Math.min(dt, 0.1);
    if (light) light.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4 + phase) * 0.18);
  });

  return (
    <group position={STATION_POSITIONS[spec.section]}>
      <Selectable selection={{ section: spec.section }}>
        <primitive object={model} />
      </Selectable>
    </group>
  );
}

export function Stations() {
  return (
    <>
      {STATIONS.map((spec) => (
        <Station key={spec.section} spec={spec} />
      ))}
    </>
  );
}
