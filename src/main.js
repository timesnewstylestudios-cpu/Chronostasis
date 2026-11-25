import './styles.css';
import { searchAddress } from './platform/nominatim.js';
import { openBatterySettings, openExactSettings, openFullScreenSettings } from './platform/notify.js';
import { actions, setPainter, start } from './runtime.js';
import { state } from './state.js';
import { escapeHtml } from './ui/html.js';
import { focusMap } from './ui/map.js';
import { afterRender, paintLive, readCommitmentForm, readReflectionForm, readSettingsForm, render } from './ui/view.js';

setPainter((full) => {
  if (full) {
    render();
    afterRender();
    return;
  }
  paintLive();
});

document.body.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'save' || action === 'reflect' || action === 'save-settings') event.preventDefault();
  if (action === 'onboard') actions.onboard(Number(target.dataset.step));
  else if (action === 'consent') actions.consent();
  else if (action === 'nav') actions.nav(target.dataset.view);
  else if (action === 'theme') actions.toggleTheme();
  else if (action === 'new') actions.newCommitment();
  else if (action === 'edit') actions.edit(target.dataset.id);
  else if (action === 'remove') actions.removeCommitment(target.dataset.id);
  else if (action === 'cancel-edit') actions.cancelEdit();
  else if (action === 'save') actions.saveCommitment(readCommitmentForm());
  else if (action === 'weekday') {
    const pressed = target.getAttribute('aria-pressed') === 'true';
    target.setAttribute('aria-pressed', pressed ? 'false' : 'true');
  } else if (action === 'search') await runSearch();
  else if (action === 'pick') pickResult(Number(target.dataset.index));
  else if (action === 'use-here') writeHere('c-lat', 'c-lon');
  else if (action === 'home-here') writeHere('s-lat', 's-lon');
  else if (action === 'snooze') actions.snooze();
  else if (action === 'open-question') actions.openQuestion();
  else if (action === 'answer') actions.answer(target.dataset.option);
  else if (action === 'dismiss-question') actions.dismissQuestion();
  else if (action === 'reflect') actions.saveReflection(readReflectionForm());
  else if (action === 'save-settings') actions.saveSettings(readSettingsForm());
  else if (action === 'export') actions.exportData();
  else if (action === 'arm-delete') actions.armDelete();
  else if (action === 'wipe') actions.wipe(document.getElementById('wipe-word')?.value.trim() || '');
  else if (action === 'notify') actions.enableNotifications();
  else if (action === 'locate') actions.locate();
  else if (action === 'exact') openExactSettings();
  else if (action === 'fullscreen') openFullScreenSettings();
  else if (action === 'battery') openBatterySettings();
});

document.body.addEventListener('submit', (event) => {
  event.preventDefault();
});

window.addEventListener('hashchange', () => {
  if (!state.consent) return;
  const view = location.hash.replace('#', '');
  if (['uhr', 'plan', 'statistik', 'mehr'].includes(view) && view !== state.view) actions.nav(view);
});

async function runSearch() {
  const box = document.getElementById('search-results');
  const query = document.getElementById('c-query')?.value || '';
  if (!box) return;
  box.textContent = 'Suche …';
  try {
    const results = await searchAddress(query);
    state.searchResults = results;
    box.innerHTML = results.length
      ? results.map((result, index) => `<button type="button" data-action="pick" data-index="${index}">${escapeHtml(result.label)}</button>`).join('')
      : '<p>Nichts gefunden.</p>';
  } catch {
    box.textContent = 'Die Adresssuche ist gerade nicht erreichbar. Trag Koordinaten ein.';
  }
}

function pickResult(index) {
  const result = state.searchResults[index];
  if (!result) return;
  const lat = document.getElementById('c-lat');
  const lon = document.getElementById('c-lon');
  const label = document.getElementById('c-label');
  if (lat) lat.value = result.lat.toFixed(6);
  if (lon) lon.value = result.lon.toFixed(6);
  if (label && !label.value) label.value = result.label.slice(0, 160);
  focusMap(result.lat, result.lon);
}

function writeHere(latId, lonId) {
  if (!state.position) {
    const box = document.getElementById('search-results');
    const message = 'Noch kein Standort. Erlaube ihn über „Standort holen“ und versuch es noch einmal.';
    if (box) box.textContent = message;
    else actions.toast(message);
    return;
  }
  const lat = document.getElementById(latId);
  const lon = document.getElementById(lonId);
  if (lat) lat.value = state.position.lat.toFixed(6);
  if (lon) lon.value = state.position.lon.toFixed(6);
  if (latId === 'c-lat') focusMap(state.position.lat, state.position.lon);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

start();
