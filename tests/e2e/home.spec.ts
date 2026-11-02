import { expect, test } from '@playwright/test';

test('la page d’accueil s’ouvre avec le bon titre', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CSTR Digital Twin/);
  await expect(page.getByRole('heading', { name: 'CSTR Digital Twin' })).toBeVisible();
});
