import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import type { DistrictHooks } from '../src/world/testHooks';

// Real-browser smoke tests against the production build (see playwright.config.ts). `?e2e` turns on the
// inspection hooks, which let a test put the car somewhere and watch the game events it causes.

declare global {
  interface Window {
    __district?: DistrictHooks;
  }
}

const NORTH = 0;

async function hasWebGL(page: Page) {
  return page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
}

/** Open the district, skip the opening reveal, dismiss the welcome card, and wait for the car to land. */
async function startDriving(page: Page, path = '/?e2e#/3d') {
  await page.goto(path);
  test.skip(!(await hasWebGL(page)), 'This headless browser has no WebGL; the quick-view test covers the fallback.');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__district?.telemetry.wheelsOnGround ?? 0) > 0, null, { timeout: 30_000 });
  await page.keyboard.press('KeyQ'); // any key skips the reveal
  await page.getByRole('button', { name: 'Start driving' }).click();
}

async function place(page: Page, x: number, z: number, heading: number) {
  await page.evaluate(([x, z, h]) => window.__district!.place(x, z, h), [x, z, heading] as const);
  await page.waitForTimeout(600); // settle on the suspension
}

const events = (page: Page) => page.evaluate(() => [...window.__district!.events]);

function collectErrors(page: Page): ConsoleMessage[] {
  const errors: ConsoleMessage[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m));
  return errors;
}

test('quick view renders every section, downloads no 3D assets, and the résumé is a PDF', async ({ page, request }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/#/basic');
  await expect(page.getByRole('heading', { level: 1, name: 'Apu Islam' })).toBeVisible();
  for (const name of ['Experience', 'Research', 'Projects', 'Education', 'Contact']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  await page.waitForLoadState('networkidle');
  expect(requested.filter((url) => /\.glb|\.wasm|\/audio\//.test(url))).toEqual([]);

  const resume = await request.get('/resume.pdf');
  expect(resume.ok()).toBe(true);
  expect(resume.headers()['content-type']).toContain('pdf');
  expect((await resume.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('drive into the Career zone, press E, read MetLife and the dates, drive off', async ({ page }) => {
  const errors = collectErrors(page);
  await startDriving(page);
  await place(page, 2.5, 0, NORTH); // on the cross street, facing the tower forecourt

  const prompt = page.locator('.interact-prompt');
  await page.keyboard.down('KeyW');
  await expect(prompt).toContainText('Career Tower', { timeout: 15_000 });
  await page.keyboard.up('KeyW');
  // Pull up inside the zone, as a driver would, then open it.
  await page.keyboard.down('Space');
  await page.waitForFunction(() => Math.abs(window.__district!.telemetry.speed) < 0.5, null, { timeout: 5_000 });
  await page.keyboard.up('Space');
  await expect(prompt).toContainText('Career Tower');
  const before = await page.evaluate(() => [...window.__district!.telemetry.position]);
  await page.keyboard.press('KeyE');

  const panel = page.getByRole('dialog', { name: 'Software Engineer – AI' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('MetLife')).toBeVisible();
  await expect(panel.getByText(/Nov 2023 – Jul 2026/)).toBeVisible();
  await expect(page).toHaveURL(/#\/3d\/experience$/);
  await page.waitForTimeout(1500); // let the camera settle on the tower
  // E opens the panel where the car stands; it must not jump to the parking spot.
  const after = await page.evaluate(() => [...window.__district!.telemetry.position]);
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeLessThan(0.5);
  await page.screenshot({ path: 'test-results/career-panel.png' });

  // A fresh press of W closes the panel and drives on.
  await page.keyboard.down('KeyW');
  await expect(panel).toBeHidden();
  await page.keyboard.up('KeyW');
  await expect(page).toHaveURL(/#\/3d$/);

  expect(errors.map((e) => e.text())).toEqual([]);
});

test('driving through the pond splashes and leaves wet tracks', async ({ page }) => {
  const errors = collectErrors(page);
  await startDriving(page);
  await place(page, -35, 14, NORTH); // south shore, facing across the pond

  await page.keyboard.down('KeyW');
  await expect.poll(() => events(page), { timeout: 10_000 }).toContain('splash');
  await expect.poll(() => events(page), { timeout: 10_000 }).toContain('waterExit');
  await page.keyboard.up('KeyW');
  expect(await events(page)).toContain('waterEnter');

  // Out of the water with wet tires, the track mesh is drawn.
  const wet = await page.evaluate(() => {
    let tracks = false;
    window.__district!.r3f.scene.traverse((o) => {
      const mesh = o as { isInstancedMesh?: boolean; count?: number; visible: boolean };
      if (mesh.isInstancedMesh && mesh.count === 160 && mesh.visible) tracks = true;
    });
    return { tracks, wet: window.__district!.telemetry.wet };
  });
  expect(wet.wet).toBeGreaterThan(0);
  expect(wet.tracks).toBe(true);
  await page.screenshot({ path: 'test-results/pond.png' });
  expect(errors.map((e) => e.text())).toEqual([]);
});

test('the cone slalom reacts to the car with impact events', async ({ page }) => {
  const errors = collectErrors(page);
  await startDriving(page);
  await place(page, 0, 50, NORTH); // just south of the slalom on the cross street

  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await events(page)).filter((e) => e === 'impact').length, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'test-results/cones.png' });
  expect(errors.map((e) => e.text())).toEqual([]);
});

test('the fixed camera never turns with the car, zooms only between its limits, and ignores drags', async ({ page }) => {
  const errors = collectErrors(page);
  await startDriving(page);
  await place(page, -20, 57.5, -Math.PI / 2); // on the south road, facing east
  const orientation = () => page.evaluate(() => window.__district!.r3f.camera.quaternion.toArray().map((n) => Number(n.toFixed(4))));
  const distance = () =>
    page.evaluate(() => {
      const c = window.__district!.r3f.camera.position;
      const t = window.__district!.telemetry.position;
      return Math.hypot(c.x - t[0], c.y - t[1], c.z - t[2]);
    });

  const before = await orientation();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(800);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
  expect(await orientation()).toEqual(before); // R1

  // Zoom with the wheel over the scene, out past the farthest limit and back in past the closest (AE6).
  await page.keyboard.down('Space');
  await page.waitForFunction(() => Math.abs(window.__district!.telemetry.speed) < 0.3, null, { timeout: 5_000 });
  await page.keyboard.up('Space');
  await page.waitForTimeout(2500); // let the speed pull-back settle so only zoom changes the distance
  await page.mouse.move(900, 500);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1200);
  const far = await distance();
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(800);
  expect(await distance()).toBeCloseTo(far, 0);
  for (let i = 0; i < 24; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(1200);
  expect(await distance()).toBeLessThan(far / 2);

  // A drag across the scene leaves the camera where it is (R5).
  const at = () => page.evaluate(() => window.__district!.r3f.camera.position.toArray().map((n) => Number(n.toFixed(2))));
  const still = await at();
  await page.mouse.down();
  await page.mouse.move(600, 350, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await at()).toEqual(still);
  expect(errors.map((e) => e.text())).toEqual([]);
});

test('clicking the Career Tower travels there and opens its panel', async ({ page }) => {
  await startDriving(page);
  await place(page, 15, 0, NORTH); // the tower's podium is in view to the north-east
  const [x, y] = await page.evaluate(() => {
    const r = window.__district!.r3f;
    const v = r.camera.position.clone().set(27, 5, -9).project(r.camera); // a point on the podium
    return [((v.x + 1) / 2) * r.size.width, ((1 - v.y) / 2) * r.size.height];
  });
  await page.mouse.click(x, y);
  await expect(page.getByRole('dialog', { name: 'Software Engineer – AI' })).toBeVisible();
  await expect(page).toHaveURL(/#\/3d\/experience$/); // R9
});

test('fast travel and the conventional portfolio keep your place', async ({ page }) => {
  await startDriving(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Fast travel' }).getByRole('button', { name: 'Research kiosk' }).click();
  await expect(page.getByRole('dialog', { name: 'Research & publications' })).toBeVisible();
  await expect(page.locator('.interact-prompt')).toBeHidden(); // prompt stays hidden while the panel is open

  await page.getByRole('button', { name: 'Quick view' }).click();
  const section = page.getByRole('region', { name: 'Research', exact: true });
  await expect(section).toHaveAttribute('aria-current', 'true');
  await expect(section).toBeInViewport();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/basic\/research$/);
});

test.describe('frame rate at 1440×900, DPR 2', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  test('samples five seconds of driving and reports the average fps', async ({ page }, info) => {
    await startDriving(page);
    await page.keyboard.down('KeyW');
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - start < 5000) requestAnimationFrame(tick);
            else resolve((frames * 1000) / (performance.now() - start));
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.keyboard.up('KeyW');
    // Headless Chrome renders WebGL in software, so this is a report, not the 60 fps acceptance check (that is
    // measured on real hardware); the test only guards against the loop stalling.
    info.annotations.push({ type: 'fps', description: `${fps.toFixed(1)} fps (headless, software WebGL)` });
    console.log(`[fps] ${fps.toFixed(1)} fps at 1440×900 DPR 2 (headless)`);
    expect(fps).toBeGreaterThan(1);
  });
});
