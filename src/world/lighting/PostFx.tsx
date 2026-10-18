import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Every tier (KTD8, KTD10): a bloom on bright emissives (night windows, neon, bulbs) that leaves the day alone, a
 * slight contrast and saturation grade, a vignette, and ACES tone mapping last. The composer switches the
 * renderer's own tone mapping off while mounted; the ACES pass still reads `gl.toneMappingExposure`, so Lighting's
 * per-frame exposure carries through. Mipmap blur ignores a resolution scale, so a scale under 1 switches to the
 * cheaper Kawase blur at that size.
 */
export function PostFx({ bloomScale, bloomIntensity }: { bloomScale: number; bloomIntensity: number }) {
  const mipmap = bloomScale >= 1;
  return (
    <EffectComposer multisampling={4}>
      <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.25} intensity={bloomIntensity} radius={0.7} mipmapBlur={mipmap} resolutionScale={bloomScale} />
      <BrightnessContrast contrast={0.06} />
      <HueSaturation saturation={0.06} />
      <Vignette offset={0.32} darkness={0.42} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
