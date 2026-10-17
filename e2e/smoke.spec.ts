import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

// Real-browser smoke tests against the production build (see playwright.config.ts).

async function hasWebGL(page: Page) {
  return page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
}

async function startDriving(page: Page, path = '/#/3d') {
  await page.goto(path);
  test.skip(!(await hasWebGL(page)), 'This headless browser has no WebGL; the quick-view test covers the fallback.');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Start driving' }).click();
}

test('quick view renders every section and the résumé downloads as a PDF', async ({ page, request }) => {
  await page.goto('/#/basic');
  await expect(page.getByRole('heading', { level: 1, name: 'Your Name' })).toBeVisible();
  for (const name of ['Experience', 'Research', 'Projects', 'Education', 'Contact']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  const resume = await request.get('/resume.pdf');
  expect(resume.ok()).toBe(true);
  expect(resume.headers()['content-type']).toContain('pdf');
  expect((await resume.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('drive from the spawn point into the Career zone, press E, read the experience, drive off', async ({ page }) => {
  const errors: ConsoleMessage[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m));
  await startDriving(page);

  const prompt = page.getByText('Press E to open the MetLife Career Tower');
  await page.keyboard.down('KeyW');
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');

  const panel = page.getByRole('dialog', { name: 'Software Engineer – AI' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Nov 2023 – Jul 2026')).toBeVisible();
  await expect(page).toHaveURL(/#\/3d\/experience$/);
  await page.waitForTimeout(1500); // let the camera settle on the tower
  await page.screenshot({ path: 'test-results/career-panel.png' });

  // A fresh press of W closes the panel and drives on.
  await page.keyboard.down('KeyW');
  await expect(panel).toBeHidden();
  await page.keyboard.up('KeyW');
  await expect(page).toHaveURL(/#\/3d$/);

  expect(errors.map((e) => e.text())).toEqual([]);
});

test('fast travel and the conventional portfolio keep your place', async ({ page }) => {
  await startDriving(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Fast travel' }).getByRole('button', { name: 'AI Research Tower' }).click();
  await expect(page.getByRole('dialog', { name: 'Research & publications' })).toBeVisible();
  await expect(page.getByText('Press E to open')).toBeHidden(); // prompt stays hidden while the panel is open

  await page.getByRole('button', { name: 'Quick view' }).click();
  const section = page.getByRole('region', { name: 'Research', exact: true });
  await expect(section).toHaveAttribute('aria-current', 'true');
  await expect(section).toBeInViewport();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/basic\/research$/);
});
