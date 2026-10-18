// Lighting as a pure function of the visitor's local time. The scene samples it; tests check it.

export type RGB = [number, number, number];

export interface Lighting {
  /** Unit vector pointing toward the key light: the sun by day, the moon at night. */
  sunDirection: [number, number, number];
  sunColor: RGB;
  sunIntensity: number;
  skyTop: RGB;
  skyHorizon: RGB;
  hemisphereSky: RGB;
  hemisphereGround: RGB;
  hemisphereIntensity: number;
  fogColor: RGB;
  /** Exponential fog density: far blocks fade into the horizon colour. */
  fogDensity: number;
  /** Reflections from the environment (glass, car paint). */
  environmentIntensity: number;
  /** 0 by day, 1 at night: drives lit windows, streetlights, headlights, floodlights. */
  night: number;
  /** Overall brightness, folded into the light intensities. */
  exposure: number;
}

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

interface Keyframe extends Omit<Lighting, 'sunDirection'> {
  hour: number;
  /** Sun azimuth (degrees, 0 = north, 90 = east) and elevation (degrees above the horizon). */
  azimuth: number;
  elevation: number;
}

const key = (
  hour: number,
  sun: [number, number, string, number],
  sky: [string, string],
  hemi: [string, string, number],
  fog: [string, number],
  environmentIntensity: number,
  night: number,
  exposure: number,
): Keyframe => ({
  hour,
  azimuth: sun[0],
  elevation: sun[1],
  sunColor: hex(sun[2]),
  sunIntensity: sun[3],
  skyTop: hex(sky[0]),
  skyHorizon: hex(sky[1]),
  hemisphereSky: hex(hemi[0]),
  hemisphereGround: hex(hemi[1]),
  hemisphereIntensity: hemi[2],
  fogColor: hex(fog[0]),
  fogDensity: fog[1],
  environmentIntensity,
  night,
  exposure,
});

/** The moonlit night, held from late evening until dawn. */
const MOONLIT = (hour: number) =>
  key(hour, [320, 42, '#a9bcff', 0.45], ['#080d22', '#1d2647'], ['#4a5c9e', '#16172a', 0.72], ['#182042', 0.0028], 0.42, 1, 1.25);

/**
 * The golden-hour miniature city's day (approved look-dev): crisp midday, a warm low sun at golden hour, a
 * violet blue hour, and a moonlit indigo night. Neighbouring keys blend linearly; 24:00 wraps to 0:00.
 */
const KEYFRAMES: Keyframe[] = [
  MOONLIT(0),
  MOONLIT(4.5),
  key(6, [95, 4, '#ff9e6b', 1.6], ['#3a4f8f', '#f2b08e'], ['#8a9ad0', '#4a3a34', 0.45], ['#d6a596', 0.0032], 0.45, 0.45, 1.05),
  key(8.5, [125, 30, '#ffe0b8', 2.8], ['#4a86d6', '#f4d8be'], ['#b6cdf5', '#6b5a48', 0.55], ['#d8dbe0', 0.0026], 0.7, 0, 1),
  key(13, [165, 58, '#fff3e2', 3.1], ['#3c84de', '#cfe3f5'], ['#c4dcff', '#7f6f54', 0.55], ['#cddfed', 0.0022], 0.8, 0, 1),
  key(16.5, [225, 30, '#ffd9a6', 3], ['#3f74c6', '#f2d4ae'], ['#b9c8ec', '#7a5f45', 0.55], ['#e3cfb6', 0.0024], 0.75, 0, 1),
  key(18.2, [252, 13, '#ffb366', 3.8], ['#4268b0', '#ffc896'], ['#e0c3a2', '#7a5536', 0.75], ['#f3cfa8', 0.0016], 0.7, 0.03, 1.32),
  key(18.7, [257, 4, '#ff8a4a', 2.55], ['#33508f', '#ffa27a'], ['#b8a6b8', '#5a3e34', 0.7], ['#c89a8c', 0.0022], 0.6, 0.3, 1.25),
  // Blue hour: the sun is down, the sky glows violet-blue, and the city lights come up.
  key(19.2, [262, -4, '#b8a2d8', 1.1], ['#22346e', '#8f73ab'], ['#6d7cc4', '#2c2234', 0.7], ['#5a4c86', 0.0028], 0.5, 0.72, 1.2),
  key(20.3, [300, 30, '#a9bcff', 0.5], ['#0e1736', '#2c3566'], ['#4a5fa8', '#1a1a2a', 0.78], ['#1d2650', 0.0028], 0.45, 0.95, 1.25),
  MOONLIT(21),
  MOONLIT(23.5),
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Blend two angles (degrees) the short way round. */
const lerpAngle = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

/** Hours since local midnight, with fractions (13:30 → 13.5). */
export function localHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/** Where the moon hangs: high in the north-west, so night shadows fall toward the camera's side. */
const MOON: [number, number, number] = [-0.55, 0.62, -0.55];

/**
 * The key light's direction: the sun from its azimuth and elevation (never quite below the horizon, so shadows
 * stay sensible), handing over smoothly to the moon as night falls (0.5 to 0.7).
 */
function keyDirection(azimuthDeg: number, elevationDeg: number, night: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (Math.max(elevationDeg, 5) * Math.PI) / 180;
  const sun = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const t = Math.min(1, Math.max(0, (night - 0.5) / 0.2));
  const w = t * t * (3 - 2 * t);
  const mixed = sun.map((v, i) => lerp(v, MOON[i], w));
  const length = Math.hypot(...mixed);
  return mixed.map((v) => v / length) as [number, number, number];
}

/** Whether the reflection environment captured at `captured` hours is out of date at `now` (more than 0.2 h). */
export function environmentStale(captured: number, now: number): boolean {
  const d = Math.abs(now - captured) % 24;
  return Math.min(d, 24 - d) > 0.2;
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
    sunDirection: keyDirection(lerpAngle(a.azimuth, b.azimuth, t), lerp(a.elevation, b.elevation, t), night),
    sunColor: lerpRGB(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    skyTop: lerpRGB(a.skyTop, b.skyTop, t),
    skyHorizon: lerpRGB(a.skyHorizon, b.skyHorizon, t),
    hemisphereSky: lerpRGB(a.hemisphereSky, b.hemisphereSky, t),
    hemisphereGround: lerpRGB(a.hemisphereGround, b.hemisphereGround, t),
    hemisphereIntensity: lerp(a.hemisphereIntensity, b.hemisphereIntensity, t),
    fogColor: lerpRGB(a.fogColor, b.fogColor, t),
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    environmentIntensity: lerp(a.environmentIntensity, b.environmentIntensity, t),
    night,
    exposure: lerp(a.exposure, b.exposure, t),
  };
}
