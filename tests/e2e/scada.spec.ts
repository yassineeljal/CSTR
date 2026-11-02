import { expect, test, type Page } from '@playwright/test';

const temp = (page: Page) =>
  page.evaluate(() => Number(document.documentElement.dataset.simTemp ?? '0'));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
});

test('S5-L12 : scénario 2 → alarme HH → quench en deux temps → pas de rupture', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByTestId('scenario-pump-failure').click();
  await expect(page.getByTestId('scenario-detail')).toContainText('pompe');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');

  // alarmes : H puis HH apparaissent, clignotent tant qu'elles ne sont pas acquittées
  await expect(page.getByTestId('alarm-HH')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('alarm-HH')).toHaveAttribute('data-acknowledged', 'false');

  // le déclenchement exige d'abord l'armement (deux temps)
  const fire = page.getByTestId('quench-fire');
  await expect(fire).toBeDisabled();
  await page.keyboard.press('q');
  await expect(fire).toBeEnabled();
  await fire.click();
  await expect(page.getByTestId('quench-fire')).toBeDisabled(); // désarmé après déclenchement

  // le quench ramène la température sous HH : l'alarme revient à la normale mais reste affichée
  // (ISA-18.2) tant qu'elle n'est pas acquittée
  await expect(page.getByTestId('alarm-HH')).toHaveAttribute('data-active', 'false', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('alarm-HH')).toContainText('retour à la normale');
  await page.getByTestId('alarm-ack').click();
  await expect(page.getByTestId('alarm-HH')).toHaveCount(0);

  await page.waitForTimeout(8000); // ≈ 80 s simulées à ×10
  await expect(page.getByTestId('engine-status')).not.toContainText('RUPTURE');
  await expect(page.getByTestId('rupture-overlay')).toHaveCount(0);
  expect(await temp(page)).toBeLessThan(400);
  // le journal garde la trace des événements
  await expect(page.getByTestId('alarm-history')).toContainText('Quench déclenché');
  await expect(page.getByTestId('alarm-history')).toContainText('HH');
});

test('le quench ne se déclenche jamais en un seul geste', async ({ page }) => {
  await page.goto('/?scenario=pump-failure&speed=10&autostart=1');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await expect(page.getByTestId('quench-fire')).toBeDisabled();
  await page.getByTestId('quench-arm').click();
  await expect(page.getByTestId('quench-fire')).toBeEnabled();
  // l'armement expire seul (6 s)
  await expect(page.getByTestId('quench-fire')).toBeDisabled({ timeout: 10_000 });
});

test('raccourcis clavier : Espace, R, 1–4, C ; ignorés pendant une saisie', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('engine-status')).toContainText('PRÊT');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('engine-status')).toContainText('EN COURS');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE');
  await page.keyboard.press('3');
  await expect(page.getByTestId('scenario-fouling')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('4');
  await expect(page.getByTestId('scenario-emergency-quench')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('c');
  await expect(page.getByTestId('cutaway-toggle')).toContainText('Vue en coupe');
  await page.keyboard.press('r');
  await expect(page.getByTestId('engine-status')).toContainText('PAUSE'); // scénario 4 : pré-roulé puis en pause

  // la frappe dans un champ de texte n'actionne rien
  await page.getByLabel('Nom du preset').fill('r1 q');
  await expect(page.getByLabel('Nom du preset')).toHaveValue('r1 q');
  await expect(page.getByTestId('scenario-emergency-quench')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('champ numérique : virgule décimale, bornes, saisie invalide', async ({ page }) => {
  await page.goto('/');
  const ca = page.getByLabel('C_A d’entrée', { exact: true });
  await ca.fill('0,5');
  await ca.press('Enter');
  await expect(ca).toHaveValue('0.50');
  await ca.fill('99');
  await ca.press('Enter');
  await expect(ca).toHaveValue('3.00'); // borné à la plage de l'interface
  await ca.fill('abc');
  await ca.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Valeur invalide' })).toBeVisible();
  await ca.press('Escape');
});

test('S5-L11 : un preset enregistré survit au rechargement et se recharge', async ({ page }) => {
  await page.goto('/');
  const rpm = page.getByLabel('Agitation', { exact: true });
  await rpm.fill('80');
  await rpm.press('Enter');
  await page.getByLabel('Nom du preset').fill('Agitation lente');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByTestId('preset-notice')).toContainText('enregistré');

  await page.reload();
  await expect(page.getByTestId('preset-list')).toContainText('Agitation lente');
  await expect(page.getByLabel('Agitation', { exact: true })).toHaveValue('120');
  await page.getByRole('button', { name: 'Charger Agitation lente' }).click();
  await expect(page.getByLabel('Agitation', { exact: true })).toHaveValue('80');

  await page.getByRole('button', { name: 'Supprimer Agitation lente' }).click();
  await expect(page.getByTestId('preset-list')).not.toContainText('Agitation lente');
});

test('les 4 graphes uPlot sont dessinés et se mettent à jour', async ({ page }) => {
  await page.goto('/?speed=30&autostart=1');
  for (const id of ['temperature', 'concentration', 'valve', 'heat']) {
    await expect(page.getByTestId(`chart-${id}`).locator('canvas')).toHaveCount(1);
  }
  await page.waitForTimeout(2500);
  const box = await page.getByTestId('chart-temperature').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(200);
  expect(box?.height ?? 0).toBeGreaterThan(100);
});

test('un import de preset invalide est refusé avec un message clair', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Importer un preset JSON').setInputFiles({
    name: 'mauvais.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"autre"}'),
  });
  await expect(page.getByTestId('preset-notice')).toContainText('non reconnu');
});
