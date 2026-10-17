import { Canvas } from '@react-three/fiber';
import { WorldLabels } from '../ui/WorldLabels';
import { CareerTower } from './scene/CareerTower';
import { CityScene } from './scene/CityScene';
import { LabelProjector } from './scene/LabelProjector';
import { ShipRig } from './scene/ShipRig';
import { SpaceBackdrop } from './scene/SpaceBackdrop';
import { Stations } from './scene/Stations';

/** The 3D world and its name tags. Loaded lazily, so the basic view never downloads three.js. */
export default function World3D() {
  return (
    <>
      <div className="world" role="region" aria-label="3D portfolio world. Use the Menu button to navigate with a keyboard or screen reader.">
        <Canvas
          dpr={[1, 1.75]}
          camera={{ fov: 60, near: 0.5, far: 6000, position: [0, 60, 260] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <SpaceBackdrop />
          <CityScene />
          <CareerTower />
          <Stations />
          <ShipRig />
          <LabelProjector />
        </Canvas>
      </div>
      <WorldLabels />
    </>
  );
}
