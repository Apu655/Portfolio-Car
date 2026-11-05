// Headed frame-rate run (R18, Verification Contract): a one-minute drive around the road loop in real Chrome on the
// real GPU, at 1440×900 with a device scale factor of 2 (retina). It holds the nitro boost on the straights, and
// three times aims the car at the nearest lamp post or tree so thrown copies are in flight while frames are sampled
// (R17 of the knock-overs and boost plan). Reports the average and 5th-percentile fps and whether the quality tier
// dropped. It opens with a short walk on foot before getting in. It reports; it never fails the build, so the exit
// code is always 0.
//
// Usage: `npm run build`, then `node scripts/measure-fps.mjs`. The script serves `dist/` itself with
// `vite preview --port 4175 --strictPort` (and stops it afterwards), or reuses a preview already on that port.
// A Chrome window opens for about a minute; leave it in front and untouched while it runs.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4175;
const ORIGIN = `http://localhost:${PORT}`;
const SETTLE_MS = 3000; // after "Start exploring", before sampling: first-frame shader compiles and the camera settle
const DRIVE_MS = 60_000;
const TICK_MS = 50;
/** Seconds into the drive when the car is aimed at the nearest standing lamp post or tree. */
const KNOCK_AT = [12, 27, 42];

// The road loop (src/world/district/layout.ts ROADS): a rounded rectangle, driven anticlockwise on the map (south side
// eastbound first, as the section tour runs) along its centre line, which runs midway between each gate's pillars. The
// robot (layout ROBOT) stands on the east road's centre line, so the route eases 3.5 m inside it for 10 m either side.
// Heading 0 faces north (-z); forward is (-sin h, -cos h).
const LOOP = { halfX: 70, halfZ: 55, cornerRadius: 20 };
const ROBOT = { position: [70, 22], swerve: 3.5, reach: 10 };
const LOOKAHEAD = 9; // metres along the road to aim at
const CORNER_SPEED = 9; // m/s: brake down to this before and through a corner
const CORNER_AHEAD = 22; // metres ahead to look for a corner

/** The driven line as a closed polyline, in driving order. */
function loopPoints(step = 1) {
  const { halfX, halfZ, cornerRadius: R } = LOOP;
  const ix = halfX - R;
  const iz = halfZ - R;
  const points = [];
  const arc = (cx, cz, from, to) => {
    const n = Math.ceil((Math.abs(to - from) * R) / step);
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * i) / n;
      points.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]);
    }
  };
  const line = (x0, z0, x1, z1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step);
    for (let i = 0; i < n; i++) points.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  };
  // Angles measured in the x–z plane: 0 is +x (east), π/2 is +z (south).
  line(-ix, iz + R, ix, iz + R); // south side, eastbound
  arc(ix, iz, Math.PI / 2, 0); // south-east corner
  line(ix + R, iz, ix + R, -iz); // east side, northbound
  arc(ix, -iz, 0, -Math.PI / 2); // north-east corner
  line(ix, -iz - R, -ix, -iz - R); // north side, westbound
  arc(-ix, -iz, -Math.PI / 2, -Math.PI); // north-west corner
  line(-ix - R, -iz, -ix - R, iz); // west side, southbound
  arc(-ix, iz, Math.PI, Math.PI / 2); // south-west corner
  return points.map(([x, z]) => {
    const along = Math.abs(z - ROBOT.position[1]) / ROBOT.reach;
    if (Math.abs(x - ROBOT.position[0]) > 1 || along >= 1) return [x, z];
    return [x - ROBOT.swerve * (0.5 + 0.5 * Math.cos(Math.PI * along)), z]; // a smooth bump, full at the robot
  });
}

const ROUTE = loopPoints();

function nearestIndex(x, z) {
  let best = 0;
  let bestD = Infinity;
  ROUTE.forEach(([px, pz], i) => {
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bestD) [best, bestD] = [i, d];
  });
  return best;
}

/** Heading (radians, 0 = north) that faces from `a` toward `b`. */
const headingToward = (a, b) => Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

async function serverUp() {
  try {
    return (await fetch(ORIGIN)).ok;
  } catch {
    return false;
  }
}

async function startPreview() {
  if (await serverUp()) return null;
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await serverUp())) throw new Error(`vite preview did not come up on ${ORIGIN}; run \`npm run build\` first`);
  return child;
}

async function main() {
  const preview = await startPreview();
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`${ORIGIN}/?e2e#/3d`);
    await page.waitForFunction(() => (window.__district?.telemetry.wheelsOnGround ?? 0) > 0, null, { timeout: 60_000 });
    await page.keyboard.press('KeyQ'); // any key skips the opening reveal
    await page.getByRole('button', { name: 'Start exploring' }).click();
    // The visitor starts on foot beside the car; F gets in.
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => window.__district.mode() === 'driving', null, { timeout: 10_000 });
    await page.evaluate(([x, z, h]) => window.__district.place(x, z, h), [ROUTE[0][0], ROUTE[0][1], headingToward(ROUTE[0], ROUTE[5])]);
    await page.waitForTimeout(SETTLE_MS);

    // Frame times and the renderer's tier signals, sampled in the page.
    await page.evaluate(() => {
      const gl = window.__district.r3f.gl;
      const run = (window.__fpsRun = { frames: [], dpr: [gl.getPixelRatio()], shadows: [gl.shadowMap.enabled], last: 0, on: true });
      const loop = (t) => {
        if (!run.on) return;
        if (run.last) run.frames.push(t - run.last);
        run.last = t;
        const dpr = gl.getPixelRatio();
        if (dpr !== run.dpr[run.dpr.length - 1]) run.dpr.push(dpr);
        if (gl.shadowMap.enabled !== run.shadows[run.shadows.length - 1]) run.shadows.push(gl.shadowMap.enabled);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });

    // A short walk first: out of the car, a few running steps away and back with the close on-foot camera and the
    // character on screen, then back in.
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => window.__district.mode() === 'foot', null, { timeout: 10_000 });
    await page.keyboard.down('ShiftLeft');
    for (const key of ['KeyS', 'KeyW']) {
      await page.keyboard.down(key);
      await page.waitForTimeout(1200);
      await page.keyboard.up(key);
    }
    await page.keyboard.up('ShiftLeft');
    for (let i = 0; i < 6 && (await page.evaluate(() => window.__district.mode())) !== 'driving'; i++) {
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(600);
    }

    // Drive: hold W, steer toward a point a little ahead on the road, brake for corners, and put the car back on the
    // road if it gets stuck against something.
    await page.keyboard.down('KeyW');
    const held = { KeyA: false, KeyD: false, KeyW: true, KeyS: false, ShiftLeft: false };
    const at = (i) => ROUTE[i % ROUTE.length];
    const hold = async (key, down) => {
      if (held[key] === down) return;
      held[key] = down;
      await (down ? page.keyboard.down(key) : page.keyboard.up(key));
    };
    let stuckMs = 0;
    const recoveries = [];
    const start = Date.now();
    const end = start + DRIVE_MS;
    const knocks = [...KNOCK_AT];
    while (Date.now() < end) {
      if (knocks.length && Date.now() - start > knocks[0] * 1000) {
        knocks.shift();
        // Put the car 8 m short of the nearest standing lamp or tree, facing it; the drive below takes it through.
        await page.evaluate(() => {
          const d = window.__district;
          const [x, , z] = d.telemetry.position;
          const target = d.breakables().filter((b) => !b.knocked).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
          if (!target) return;
          const away = Math.atan2(x - target.x, z - target.z);
          const from = [target.x + Math.sin(away) * 8, target.z + Math.cos(away) * 8];
          d.place(from[0], from[1], Math.atan2(from[0] - target.x, from[1] - target.z));
        });
        for (const key of ['KeyA', 'KeyD', 'KeyS']) await hold(key, false);
        await hold('KeyW', true);
        await page.waitForTimeout(1500);
        continue;
      }
      const { position, heading, speed } = await page.evaluate(() => {
        const t = window.__district.telemetry;
        return { position: t.position, heading: t.heading, speed: t.speed };
      });
      const here = [position[0], position[2]];
      const i = nearestIndex(here[0], here[1]);
      const error = wrap(headingToward(here, at(i + LOOKAHEAD)) - heading); // positive: the target is to the left
      const turnAhead = Math.abs(wrap(headingToward(at(i), at(i + 2)) - headingToward(at(i + CORNER_AHEAD), at(i + CORNER_AHEAD + 2))));
      const limit = turnAhead > 0.4 || Math.abs(error) > 0.3 ? CORNER_SPEED : Infinity;
      await hold('KeyA', error > 0.06);
      await hold('KeyD', error < -0.06);
      await hold('KeyW', speed < limit);
      await hold('KeyS', speed > limit + 2);
      await hold('ShiftLeft', limit === Infinity && speed > 5);
      stuckMs = Math.abs(speed) < 0.5 ? stuckMs + TICK_MS : 0;
      if (stuckMs > 2500) {
        const on = at(i + 8); // a few metres on, past whatever stopped it
        await page.evaluate(([x, z, h]) => window.__district.place(x, z, h), [on[0], on[1], headingToward(on, at(i + 13))]);
        stuckMs = 0;
        recoveries.push(`(${here[0].toFixed(0)}, ${here[1].toFixed(0)})`);
      }
      await page.waitForTimeout(TICK_MS);
    }
    for (const key of Object.keys(held)) await hold(key, false);

    const run = await page.evaluate(() => {
      window.__fpsRun.on = false;
      const { frames, dpr, shadows } = window.__fpsRun;
      return { frames, dpr, shadows };
    });
    const ms = run.frames.filter((f) => f > 0);
    const totalMs = ms.reduce((a, b) => a + b, 0);
    const sorted = [...ms].sort((a, b) => b - a); // slowest first
    const p5Ms = sorted[Math.floor(sorted.length * 0.05)];
    const dropped = run.dpr.length > 1 || run.shadows.length > 1;

    console.log(`frames:            ${ms.length} over ${(totalMs / 1000).toFixed(1)} s`);
    console.log(`average fps:       ${((ms.length * 1000) / totalMs).toFixed(1)}`);
    console.log(`5th-percentile fps: ${(1000 / p5Ms).toFixed(1)}`);
    console.log(`pixel ratio:       ${run.dpr.join(' -> ')}`);
    console.log(`shadows:           ${run.shadows.join(' -> ')}`);
    console.log(`tier dropped:      ${dropped ? 'yes' : 'no'}`);
    console.log(`knocked over:      ${await page.evaluate(() => window.__district.events.filter((e) => e === 'knock').length)}`);
    if (recoveries.length) console.log(`stuck, put back:   ${recoveries.join(' ')}`);
  } finally {
    await browser.close();
    preview?.kill();
  }
}

main()
  .catch((error) => console.error(`measure-fps: ${error.message}`))
  .finally(() => process.exit(0));
