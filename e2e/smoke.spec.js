import { expect, test } from '@playwright/test';

test('onboarding, commitment and clock on a phone', async ({ page }) => {
  await page.context().grantPermissions(['notifications']);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chronostasis' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('checkbox', { name: /freiwillig/i }).check();
  await page.getByRole('button', { name: 'Freiwillig einrichten' }).click();

  await expect(page.getByTestId('clock-time')).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Neue Verpflichtung' }).click();
  await page.getByLabel('Name').fill('Arbeit');
  await page.getByLabel('Start').fill('09:00');
  await page.getByLabel('Puffer in Minuten').fill('10');
  await page.getByLabel('Fertigmachen in Minuten').fill('30');
  await page.getByLabel('Breite').fill('52.520000');
  await page.getByLabel('Länge').fill('13.405000');
  await page.getByLabel('Ort').fill('Büro');
  await page.getByRole('button', { name: 'Verpflichtung sichern' }).click();
  await expect(page.getByRole('heading', { name: 'Arbeit' })).toBeVisible();

  await page.getByRole('button', { name: 'Uhr', exact: true }).click();
  await expect(page.getByTestId('next-name')).toHaveText('Arbeit');
  await expect(page.getByTestId('status')).toBeVisible();

  await page.getByRole('button', { name: 'Statistik', exact: true }).click();
  await expect(page.getByText('Pünktlichkeitsquote')).toBeVisible();

  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Darstellung/ }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before || '');

  await expect.poll(async () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state || '';
  }), { timeout: 20_000 }).toBe('activated');
});
