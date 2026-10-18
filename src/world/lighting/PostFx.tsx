import { Bloom, EffectComposer, N8AO, TiltShift2 } from '@react-three/postprocessing';

/**
 * High tier only (KTD5): soft ambient occlusion, a gentle bloom on bright emissives (window lights, bulbs), and a
 * tilt-shift blur on the top and bottom edges that makes the district read as a tabletop miniature (R14). The
 * sharp band runs across the middle of the screen, where the car and the road ahead sit.
 */
export function PostFx() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={2.5} intensity={2.2} distanceFalloff={1.2} halfRes />
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
      <TiltShift2 blur={0.12} taper={0.6} start={[0, 0.5]} end={[1, 0.5]} samples={10} />
    </EffectComposer>
  );
}
