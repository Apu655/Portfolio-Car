import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { WorldLabels } from '../ui/WorldLabels';
import { CarRig } from './scene/CarRig';
import { City } from './scene/City';
import { LabelProjector } from './scene/LabelProjector';
import { Landmarks } from './scene/Landmarks';
import { CityLighting } from './scene/Lighting';

/** Phones and tablets skip real-time shadows to keep the frame rate up. */
function prefersLightweight(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** The 3D city and its name tags. Loaded lazily, so the quick view never downloads three.js. */
export default function World3D() {
  const lightweight = useMemo(prefersLightweight, []);
  return (
    <>
      <div className="world" role="region" aria-label="3D city. Use the Menu button to visit each tower with a keyboard or screen reader.">
        <Canvas
          shadows={!lightweight}
          dpr={lightweight ? [1, 1.5] : [1, 2]}
          camera={{ fov: 58, near: 0.3, far: 4000, position: [-90, 8, 180] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <CityLighting shadows={!lightweight} />
          <City />
          <Landmarks />
          <CarRig />
          <LabelProjector />
        </Canvas>
      </div>
      <WorldLabels />
    </>
  );
}
