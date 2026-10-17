import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { usePortfolio } from '../state/store';
import { LoadingScreen } from '../ui/LoadingScreen';
import { WorldLabels } from '../ui/WorldLabels';
import { AudioDriver } from './audio/AudioDriver';
import { ChaseCamera } from './camera/ChaseCamera';
import { Lighting } from './lighting/Lighting';
import { PostFx } from './lighting/PostFx';
import { chooseTier, floorFpsFor, FrameRateMonitor, lowerTier, TIER_SETTINGS, type Tier } from './lighting/quality';
import { Billboard } from './scene/Billboard';
import { Car } from './scene/Car';
import { District } from './scene/District';
import { LabelProjector } from './scene/LabelProjector';
import { Props } from './scene/Props';
import { Water } from './scene/Water';
import { installTestHooks } from './testHooks';

function coarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** Steps the quality down one tier when the frame rate stays below the floor. */
function TierWatch({ coarse, onDrop }: { coarse: boolean; onDrop: () => void }) {
  const monitor = useMemo(() => new FrameRateMonitor(floorFpsFor(coarse)), [coarse]);
  const warmup = useRef(0);
  useFrame((_, dt) => {
    warmup.current += dt;
    if (warmup.current < 4) return; // ignore the first seconds of shader compilation and loading
    if (monitor.frame(dt)) onDrop();
  });
  return null;
}

/** The 3D district. Loaded lazily, so the quick view never downloads three.js, physics, models, or sounds. */
export default function World3D() {
  const coarse = useMemo(coarsePointer, []);
  const [tier, setTier] = useState<Tier>(() =>
    chooseTier({
      coarsePointer: coarse,
      memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      cores: navigator.hardwareConcurrency,
    }),
  );
  const settings = TIER_SETTINGS[tier];
  const revealing = usePortfolio((s) => s.revealing);
  const setRevealing = usePortfolio((s) => s.setRevealing);

  // The opening reveal plays on a plain arrival (not a deep link, not with reduced motion); any input skips it.
  useEffect(() => {
    const { selection, reducedMotion } = usePortfolio.getState();
    if (selection || reducedMotion) return;
    setRevealing(true);
    const skip = () => setRevealing(false);
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
      setRevealing(false);
    };
  }, [setRevealing]);

  return (
    <>
      <div className="world" role="region" aria-label="3D district. Use the Menu button to visit each stop with a keyboard or screen reader.">
        <Canvas onCreated={installTestHooks} shadows={settings.shadows} dpr={settings.dpr} camera={{ fov: 55, near: 0.3, far: 2000, position: [-90, 70, -90] }} gl={{ antialias: !settings.postProcessing, powerPreference: 'high-performance' }}>
          <Lighting shadows={settings.shadows} shadowMapSize={settings.shadowMapSize} />
          <Suspense fallback={null}>
            <Physics timeStep={1 / 60} interpolate gravity={[0, -9.81, 0]}>
              <District />
              <Props />
              <Car />
            </Physics>
            <Water />
            <Billboard />
            <ChaseCamera revealing={revealing} onRevealDone={() => setRevealing(false)} />
            {settings.postProcessing && <PostFx />}
            <LabelProjector />
          </Suspense>
          <AudioDriver />
          <TierWatch coarse={coarse} onDrop={() => setTier((t) => lowerTier(t))} />
        </Canvas>
      </div>
      <WorldLabels />
      <LoadingScreen />
    </>
  );
}
