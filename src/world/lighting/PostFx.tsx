import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';

/** High tier only (KTD5): soft ambient occlusion plus a gentle bloom on bright emissives (window lights, bulbs). */
export function PostFx() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={2.5} intensity={2.2} distanceFalloff={1.2} halfRes />
      <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
    </EffectComposer>
  );
}
