// Which impact sound to play (R19, R23): a loudness tier from the collision intensity, then the next
// variation in that tier so repeated hits never sound identical.
import type { PropMaterial } from '../events';

export type ImpactTier = 'tap' | 'knock' | 'crash';

/** Variations per material and tier. Synthesized variants differ in pitch, decay, and noise color. */
export const VARIANTS = 3;

export function tierFor(intensity: number): ImpactTier {
  if (intensity < 0.3) return 'tap';
  if (intensity < 0.7) return 'knock';
  return 'crash';
}

export interface ImpactPick {
  material: PropMaterial;
  tier: ImpactTier;
  variant: number;
}

export class SampleBank {
  private next = new Map<string, number>();

  pick(material: PropMaterial, intensity: number): ImpactPick {
    const tier = tierFor(intensity);
    const key = `${material}:${tier}`;
    const variant = this.next.get(key) ?? 0;
    this.next.set(key, (variant + 1) % VARIANTS);
    return { material, tier, variant };
  }
}
