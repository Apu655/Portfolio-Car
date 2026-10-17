// How much of each ambience bed plays at a given in-world hour (R21): birds and wind by day, a distant
// city hum at dusk and dawn, crickets and a quieter city at night. Weights blend smoothly and sum to 1.

export interface AmbienceWeights {
  day: number;
  dusk: number;
  night: number;
}

/** Raw (unnormalized) presence of each bed at `hours`, built from smooth ramps around sunrise and sunset. */
function raw(hours: number): AmbienceWeights {
  const h = ((hours % 24) + 24) % 24;
  const ramp = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  // Day: up between 6:00 and 8:00, down between 17:30 and 19:00.
  const day = smooth(ramp(h, 6, 8)) * (1 - smooth(ramp(h, 17.5, 19)));
  // Night: up between 19:00 and 21:00, down between 4:30 and 6:30.
  const night = h >= 12 ? smooth(ramp(h, 19, 21)) : 1 - smooth(ramp(h, 4.5, 6.5));
  // Dusk (and dawn) fills the gap between them.
  const dusk = Math.max(0, 1 - day - night);
  return { day, dusk, night };
}

export function ambienceWeights(hours: number): AmbienceWeights {
  const w = raw(hours);
  const sum = w.day + w.dusk + w.night;
  return { day: w.day / sum, dusk: w.dusk / sum, night: w.night / sum };
}
