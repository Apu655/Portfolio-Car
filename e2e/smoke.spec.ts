import { expect, test, type ConsoleMessage } from '@playwright/test';

// Real-browser smoke test against the production build (see playwright.config.ts).

function collectErrors(messages: ConsoleMessage[]) {
  return messages.filter((m) => m.type() === 'error').map((m) => m.text());
}

test('quick view renders and the résumé downloads as a PDF', async ({ page, request }) => {
  await page.goto('/#/basic');
  await expect(page.getByRole('heading', { level: 1, name: 'Your Name' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lead Research Engineer' })).toBeVisible();
  const resume = await request.get('/resume.pdf');
  expect(resume.ok()).toBe(true);
  expect(resume.headers()['content-type']).toContain('pdf');
  expect((await resume.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('3D world renders, the menu flies to a role, and switching views keeps the place', async ({ page }) => {
  const messages: ConsoleMessage[] = [];
  page.on('console', (m) => messages.push(m));
  await page.goto('/#/3d');

  const hasWebGL = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  test.skip(!hasWebGL, 'This headless browser has no WebGL; the quick-view test above covers the fallback.');

  await expect(page.locator('canvas')).toBeVisible();
  // Landmark labels are positioned by the render loop, so a visible label proves frames are being drawn.
  await expect(page.locator('.world-label', { hasText: 'Career Tower · Experience' })).toBeVisible();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Portfolio sections' }).getByRole('button', { name: 'Software Engineer' }).click();
  const panel = page.getByRole('dialog', { name: 'Software Engineer' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Jul 2020 – Mar 2022')).toBeVisible();
  await expect(page).toHaveURL(/#\/3d\/experience\/software-engineer$/);

  await page.waitForTimeout(2500); // let the ship fly in
  await page.screenshot({ path: 'test-results/3d-role-panel.png' });

  await page.getByRole('button', { name: 'Quick view' }).click();
  const card = page.getByRole('article', { name: 'Software Engineer' });
  await expect(card).toHaveAttribute('aria-current', 'true');
  await expect(card).toBeInViewport();
  await expect(page).toHaveURL(/#\/basic\/experience\/software-engineer$/);
  await expect(page.locator('canvas')).toHaveCount(0);

  expect(collectErrors(messages)).toEqual([]);
});

test('keyboard flight moves the ship', async ({ page }) => {
  await page.goto('/#/3d');
  const hasWebGL = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  test.skip(!hasWebGL, 'No WebGL in this headless browser.');

  const label = page.locator('.world-label', { hasText: 'Career Tower · Experience' });
  await expect(label).toBeVisible();
  await page.waitForTimeout(500);
  const before = await label.evaluate((el) => el.style.transform);
  await page.keyboard.down('KeyA');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
  const after = await label.evaluate((el) => el.style.transform);
  expect(after).not.toBe(before); // the camera followed the ship, so the landmark moved on screen
});
