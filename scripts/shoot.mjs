import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.env.CHRONOSTASIS_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'de-DE',
  hasTouch: true,
});
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
}

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await shot('onboarding_intro');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('button', { name: 'Weiter' }).click();
await shot('onboarding_verpflichtung');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('checkbox', { name: /freiwillig/i }).check();
await page.context().grantPermissions(['notifications', 'geolocation']);
await page.context().setGeolocation({ latitude: 52.52, longitude: 13.405 });
await page.getByRole('button', { name: 'Freiwillig einrichten' }).click();
await page.getByTestId('clock-time').waitFor();
await page.waitForTimeout(400);
await shot('clock_empty');

await page.getByRole('button', { name: 'Plan', exact: true }).click();
await page.getByRole('button', { name: 'Neue Verpflichtung' }).click();
await page.getByLabel('Name').fill('Arbeit');
await page.getByLabel('Start').fill(futureTime(3));
await page.getByLabel('Puffer in Minuten').fill('10');
await page.getByLabel('Fertigmachen in Minuten').fill('25');
await page.getByLabel('Breite').fill('52.480000');
await page.getByLabel('Länge').fill('13.390000');
await page.getByLabel('Ort').fill('Büro');
await page.getByLabel('Weg').selectOption('bike');
await shot('plan_form');
await page.getByRole('button', { name: 'Verpflichtung sichern' }).click();
await page.getByRole('heading', { name: 'Arbeit' }).waitFor();
await shot('plan_list');

await page.getByRole('button', { name: 'Uhr', exact: true }).click();
await page.getByTestId('next-name').waitFor();
await page.getByText('Verpflichtung gespeichert').waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
await shot('clock_face');

await page.getByRole('button', { name: 'Statistik', exact: true }).click();
await shot('week_stats');

await page.getByRole('button', { name: 'Mehr', exact: true }).click();
await page.getByRole('button', { name: /Darstellung/ }).click();
await page.getByText('Gespeichert').waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
await shot('settings_night');

await page.evaluate(() => indexedDB.deleteDatabase('chronostasis'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('checkbox', { name: /freiwillig/i }).check();
await page.getByRole('button', { name: 'Freiwillig einrichten' }).click();
await page.getByRole('button', { name: 'Plan', exact: true }).click();
await page.getByRole('button', { name: 'Neue Verpflichtung' }).click();
await page.getByLabel('Name').fill('Uni');
await page.getByLabel('Start').fill(futureTime(0.2));
await page.getByLabel('Breite').fill('48.137000');
await page.getByLabel('Länge').fill('11.575000');
await page.getByLabel('Ort').fill('Hörsaal');
await page.getByLabel('Weg').selectOption('transit');
await page.getByRole('button', { name: 'Verpflichtung sichern' }).click();
await page.getByRole('dialog').waitFor({ timeout: 8000 });
await shot('question_sheet');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
await browser.close();

function futureTime(hoursAhead) {
  const when = new Date(Date.now() + hoursAhead * 3600 * 1000);
  const h = String(when.getHours()).padStart(2, '0');
  const m = String(when.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
