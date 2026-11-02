import { expect, test, type Page } from '@playwright/test';

const dataset = (page: Page) => page.evaluate(() => ({ ...document.documentElement.dataset }));

test('WebGL indisponible : message clair, mode 2D (commandes et courbes fonctionnent)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      ...args: unknown[]
    ) {
      if (id === 'webgl' || id === 'webgl2' || id === 'experimental-webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(this, id, ...args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByTestId('scene-unavailable')).toBeVisible();
  await expect(page.getByTestId('scene-unavailable')).toContainText('Mode 2D');
  // le simulateur reste pilotable et les graphes se dessinent
  await page.getByTestId('run-toggle').click();
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await expect(page.getByTestId('chart-temperature').locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('rupture-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('onglet masqué : pause automatique, reprise au retour (S7-L04)', async ({ page }) => {
  await page.goto('/?autostart=1&speed=10');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
  await setHidden(false);
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');

  // une pause posée par l'utilisateur n'est jamais relancée automatiquement
  await page.getByTestId('run-toggle').click();
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
  await setHidden(true);
  await setHidden(false);
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
});

test('option « pause auto » désactivée : la simulation continue en arrière-plan', async ({
  page,
}) => {
  await page.goto('/?autostart=1');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await page.getByTestId('autopause-toggle').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
});

test('rendu à la demande : aucune image au repos, 60 Hz en simulation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(2500); // chargement du .glb et rendus initiaux
  const f0 = Number((await dataset(page)).frames);
  await page.waitForTimeout(2500);
  const f1 = Number((await dataset(page)).frames);
  expect(f1 - f0).toBeLessThanOrEqual(3); // repos : (quasi) aucune image produite

  await page.getByTestId('run-toggle').click();
  await page.waitForTimeout(500);
  const f2 = Number((await dataset(page)).frames);
  await page.waitForTimeout(3000);
  const f3 = Number((await dataset(page)).frames);
  // images affichées (boucle R3F) : SwiftShader ≈ 2-3/s, GPU réel ≈ 60/s ; au repos il n'y en a quasiment aucune
  expect(f3 - f2).toBeGreaterThan(process.env.PERF_GPU ? 100 : 3);
});

test('qualité : la préférence explicite Haute/Basse pilote le niveau effectif (S7-L02)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await page.getByRole('radio', { name: 'Basse' }).click();
  await expect.poll(async () => (await dataset(page)).quality).toBe('low');
  await page.getByRole('radio', { name: 'Haute' }).click();
  await expect.poll(async () => (await dataset(page)).quality).toBe('high');
});

test('qualité adaptative : un rendu lent (SwiftShader) bascule sur « bas » automatiquement', async ({
  page,
}) => {
  test.skip(
    !!process.env.PERF_GPU,
    'avec un GPU réel la qualité haute est (correctement) maintenue',
  );
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scenario=cold-start&speed=10&autostart=1');
  await expect(page.locator('html[data-scene="ready"]')).toBeAttached({ timeout: 30_000 });
  await expect
    .poll(async () => (await dataset(page)).quality, { timeout: 60_000, intervals: [1000] })
    .toBe('low');
});
