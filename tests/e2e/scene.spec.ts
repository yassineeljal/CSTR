import { expect, test } from '@playwright/test';

test('scène 3D : le canvas WebGL s’affiche et se capture', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(2500); // chargement du .glb + premiers rendus
  await page.screenshot({ path: 'test-results/scene-cutaway.png' });
  await page
    .getByRole('button', { name: 'Vue complète' })
    .or(page.getByRole('button', { name: /Vue/ }))
    .first()
    .click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/scene-full.png' });
  // budget de rendu (PLAN §9) : draw calls < 100, triangles < 300 k
  const stats = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  expect(Number(stats.drawCalls)).toBeGreaterThan(0);
  expect(Number(stats.drawCalls)).toBeLessThan(100);
  expect(Number(stats.triangles)).toBeLessThan(300_000);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});
