import { VIEW } from '../district/layout';
import { ARRIVAL, clampZoom, framing, shouldSnap, SPEED_EXTRA, ZOOM, type Vec3 } from './framing';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const unit = (v: Vec3): Vec3 => {
  const l = length(v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

describe('fixed-view framing', () => {
  it('stands south-west of and above the car at the configured elevation, looking at the car', () => {
    const f = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    const offset = sub(f.position, f.target);
    expect(f.position[0]).toBeLessThan(0); // west
    expect(f.position[2]).toBeGreaterThan(0); // south
    expect(f.position[1]).toBeGreaterThan(0);
    expect(Math.asin(offset[1] / length(offset))).toBeCloseTo(VIEW.elevation, 5);
    expect(Math.hypot(f.target[0], f.target[2])).toBeLessThan(0.01);
  });

  it('uses the same direction wherever the car is and whichever way it faces', () => {
    const a = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    const b = framing({ follow: [40, 0, -30], zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    const da = unit(sub(a.position, a.target));
    const db = unit(sub(b.position, b.target));
    da.forEach((v, i) => expect(v).toBeCloseTo(db[i], 6));
  });

  it('clamps zoom to the closest and farthest limits (AE6)', () => {
    expect(clampZoom(ZOOM.max * 3)).toBe(ZOOM.max);
    expect(clampZoom(ZOOM.min / 3)).toBe(ZOOM.min);
    expect(framing({ follow: [0, 0, 0], zoom: ZOOM.max * 3, speed: 0, aspect: 1.6 }).distance).toBe(ZOOM.max);
  });

  it('pulls back by the speed extra at top speed and no more (R6)', () => {
    const still = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 0, aspect: 1.6 }).distance;
    const fast = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 26, aspect: 1.6 }).distance;
    const faster = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 60, aspect: 1.6 }).distance;
    expect(fast - still).toBeCloseTo(SPEED_EXTRA, 5);
    expect(faster).toBeCloseTo(fast, 5);
  });

  it('starts farther out in a portrait viewport (R12)', () => {
    const landscape = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 0, aspect: 1.6 }).distance;
    const portrait = framing({ follow: [0, 0, 0], zoom: ZOOM.default, speed: 0, aspect: 0.5 }).distance;
    expect(portrait).toBeGreaterThan(landscape);
  });

  it('snaps on a teleport, glides on ordinary motion (KTD4)', () => {
    expect(shouldSnap([0, 0, 0], [20, 0, 0])).toBe(true);
    expect(shouldSnap([0, 0, 0], [1, 0, 0.5])).toBe(false);
  });
});

describe('arrival and panel framing', () => {
  const car: Vec3 = [-40, 0.6, 57.5];

  it('starts high and wide over the district and ends on the plain follow framing (AE4)', () => {
    const start = framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6, arrival: 0 });
    expect(start.target[0]).toBeCloseTo(ARRIVAL.center[0], 5);
    expect(start.target[2]).toBeCloseTo(ARRIVAL.center[1], 5);
    expect(start.distance).toBeCloseTo(ARRIVAL.distance, 5);
    const end = framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6, arrival: 1 });
    const plain = framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    end.position.forEach((v, i) => expect(v).toBeCloseTo(plain.position[i], 6));
  });

  it('keeps the fixed direction halfway through the arrival (R1)', () => {
    const half = framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6, arrival: 0.5 });
    const plain = framing({ follow: car, zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    const dh = unit(sub(half.position, half.target));
    const dp = unit(sub(plain.position, plain.target));
    dh.forEach((v, i) => expect(v).toBeCloseTo(dp[i], 6));
  });

  it('frames an open low stop closer than the follow distance (AE5)', () => {
    const focus: [number, number] = [15, -69];
    const framed = framing({ follow: [18, 0.6, -57.5], zoom: ZOOM.default, speed: 0, aspect: 1.6, panel: { focus, height: 3, blend: 1 } });
    const plain = framing({ follow: [18, 0.6, -57.5], zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    expect(framed.target[0]).toBeCloseTo(focus[0], 5);
    expect(framed.target[2]).toBeCloseTo(focus[1], 5);
    expect(framed.distance).toBeLessThan(plain.distance);
  });

  it('frames a tall stop from above its midpoint and outside its footprint, at the same angle', () => {
    const focus: [number, number] = [35, -18];
    const framed = framing({ follow: [2.5, 0.6, -14], zoom: ZOOM.default, speed: 0, aspect: 1.6, panel: { focus, height: 53, blend: 1 } });
    expect(framed.target[1]).toBeCloseTo(53, 5);
    expect(framed.position[1]).toBeGreaterThan(96); // above the tower's roof
    expect(Math.hypot(framed.position[0] - focus[0], framed.position[2] - focus[1])).toBeGreaterThan(20);
    const plain = framing({ follow: [2.5, 0.6, -14], zoom: ZOOM.default, speed: 0, aspect: 1.6 });
    const dir = (f: typeof plain) => unit(sub(f.position, f.target));
    dir(framed).forEach((v, i) => expect(v).toBeCloseTo(dir(plain)[i], 6));
  });
});
