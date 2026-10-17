import { Canvas } from '@react-three/fiber';
import { WorldLabels } from '../ui/WorldLabels';
import { LabelProjector } from './scene/LabelProjector';

/** The 3D district and its name tags. Loaded lazily, so the quick view never downloads three.js. */
export default function World3D() {
  return (
    <>
      <div className="world" role="region" aria-label="3D district. Use the Menu button to visit each stop with a keyboard or screen reader.">
        <Canvas camera={{ fov: 55, near: 0.3, far: 2000, position: [-60, 30, 90] }}>
          <LabelProjector />
        </Canvas>
      </div>
      <WorldLabels />
    </>
  );
}
