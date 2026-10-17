// Lighting as a pure function of the visitor's local time. The scene samples it; tests check it.

export type RGB = [number, number, number];

export interface Lighting {
  /** Unit vector pointing toward the sun (or moon at night). */
  sunDirection: [number, number, number];
  sunColor: RGB;
  sunIntensity: number;
  skyTop: RGB;
  skyHorizon: RGB;
  hemisphereSky: RGB;
  hemisphereGround: RGB;
  hemisphereIntensity: number;
  fogColor: RGB;
  /** Reflections from the environment (glass, car paint). */
  environmentIntensity: number;
  /** 0 by day, 1 at night: drives lit windows, streetlights, headlights, floodlights. */
  night: number;
  exposure: number;
}

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

interface Keyframe extends Omit<Lighting, 'sunDirection'> {
  hour: number;
}

const key = (
  hour: number,
  sky: [string, string],
  sun: [string, number],
  hemi: [string, string, number],
  fog: string,
  environmentIntensity: number,
  night: number,
  exposure: number,
): Keyframe => ({
  hour,
  skyTop: hex(sky[0]),
  skyHorizon: hex(sky[1]),
  sunColor: hex(sun[0]),
  sunIntensity: sun[1],
  hemisphereSky: hex(hemi[0]),
  hemisphereGround: hex(hemi[1]),
  hemisphereIntensity: hemi[2],
  fogColor: hex(fog),
  environmentIntensity,
  night,
  exposure,
});

/** Hand-tuned looks for a day, blended linearly between neighbours (24:00 wraps to 0:00). */
const KEYFRAMES: Keyframe[] = [
  key(0, ['#050914', '#141c33'], ['#9db4ff', 0.35], ['#2a3a66', '#0b0d14', 0.35], '#10162a', 0.25, 1, 1.05),
  key(4.5, ['#060a17', '#18203a'], ['#9db4ff', 0.3], ['#2a3a66', '#0b0d14', 0.35], '#121a30', 0.25, 1, 1.05),
  key(6, ['#2b3a66', '#f2a07b'], ['#ffb27a', 1.2], ['#7a8cc4', '#3a2c2c', 0.6], '#c79a8a', 0.5, 0.55, 1),
  key(7.5, ['#5d8fd6', '#ffd9b0'], ['#ffd8a8', 2.4], ['#a9c4ff', '#5a4a3a', 0.8], '#cfd6e0', 0.8, 0.05, 1),
  key(10, ['#3f7fd8', '#bcd8f5'], ['#fff4e6', 3.2], ['#bcd6ff', '#6a5c48', 0.9], '#c4d6ea', 1, 0, 0.95),
  key(14, ['#3a7ad6', '#b8d4f2'], ['#fff6ea', 3.3], ['#bcd6ff', '#6a5c48', 0.9], '#c2d4e8', 1, 0, 0.95),
  key(17, ['#4f7cc2', '#ffd2a1'], ['#ffd29a', 2.6], ['#b0c4f0', '#6a5040', 0.8], '#e2c9ad', 0.9, 0.05, 1),
  key(18.5, ['#3b4a85', '#ff9a6b'], ['#ff9a5c', 1.5], ['#8a90c8', '#4a3030', 0.65], '#d49a84', 0.6, 0.45, 1),
  key(19.75, ['#141c3d', '#4a3a6a'], ['#9db4ff', 0.45], ['#3a4880', '#141018', 0.45], '#262a48', 0.35, 0.9, 1.05),
  key(21, ['#060b19', '#18203c'], ['#9db4ff', 0.35], ['#2a3a66', '#0b0d14', 0.35], '#11182c', 0.25, 1, 1.05),
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Hours since local midnight, with fractions (13:30 → 13.5). */
export function localHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Sun above the horizon from about 6:00 to 19:00, highest around 12:30, rising in the east (+X) and setting
 * in the west, slightly south. At night the light comes from a dim, high "moon" instead.
 */
function sunDirection(hours: number, night: number): [number, number, number] {
  const day = (hours - 6) / 13; // 0 at sunrise, 1 at sunset
  const angle = Math.PI * Math.min(Math.max(day, 0), 1);
  const elevation = Math.max(0.12, Math.sin(angle)) * 1.05;
  const sun: [number, number, number] = [Math.cos(angle), elevation, 0.45];
  const moon: [number, number, number] = [-0.4, 1, -0.3];
  const moonWeight = Math.min(1, Math.max(0, (night - 0.5) * 2));
  const mixed = sun.map((v, i) => lerp(v, moon[i], moonWeight)) as [number, number, number];
  const length = Math.hypot(...mixed);
  return mixed.map((v) => v / length) as [number, number, number];
}

export function lightingAt(hours: number): Lighting {
  const h = ((hours % 24) + 24) % 24;
  let i = KEYFRAMES.length - 1;
  while (i > 0 && KEYFRAMES[i].hour > h) i--;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[(i + 1) % KEYFRAMES.length];
  const span = (b.hour - a.hour + 24) % 24 || 24;
  const t = ((h - a.hour + 24) % 24) / span;
  const night = lerp(a.night, b.night, t);
  return {
    sunDirection: sunDirection(h, night),
    sunColor: lerpRGB(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    skyTop: lerpRGB(a.skyTop, b.skyTop, t),
    skyHorizon: lerpRGB(a.skyHorizon, b.skyHorizon, t),
    hemisphereSky: lerpRGB(a.hemisphereSky, b.hemisphereSky, t),
    hemisphereGround: lerpRGB(a.hemisphereGround, b.hemisphereGround, t),
    hemisphereIntensity: lerp(a.hemisphereIntensity, b.hemisphereIntensity, t),
    fogColor: lerpRGB(a.fogColor, b.fogColor, t),
    environmentIntensity: lerp(a.environmentIntensity, b.environmentIntensity, t),
    night,
    exposure: lerp(a.exposure, b.exposure, t),
  };
}
