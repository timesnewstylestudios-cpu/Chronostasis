import { MODE_LABELS, STATUS_LABELS, TYPE_LABELS, WEEKDAY_LABELS } from '../lib/commitment.js';
import { snoozeDecision } from '../lib/escalation.js';
import { REASON_LABELS } from '../lib/questions.js';
import { recordsFromOccurrences, recordsInWeek, summarize } from '../lib/stats.js';
import { addDays, formatClock, formatDateLong, formatDuration, formatHM, formatISODate, weekRange } from '../lib/time.js';
import { state } from '../state.js';
import { escapeHtml } from './html.js';
import { mountMap } from './map.js';

const SOURCE = {
  basis: 'aus Tempo',
  mischung: 'Tempo plus Erfahrung',
  gelernt: 'aus Erfahrung',
  unbekannt: 'unbekannt',
};

function handAngles(date) {
  const seconds = date.getSeconds();
  const minutes = date.getMinutes();
  const hours = date.getHours() % 12;
  return {
    second: seconds * 6,
    minute: minutes * 6 + seconds * 0.1,
    hour: hours * 30 + minutes * 0.5,
  };
}

function ticks() {
  let markup = '';
  for (let i = 0; i < 60; i += 1) {
    const major = i % 5 === 0;
    const len = major ? 7 : 2.6;
    markup += `<line x1="50" y1="7" x2="50" y2="${7 + len}" transform="rotate(${i * 6} 50 50)" class="${major ? 'tick major' : 'tick'}"></line>`;
  }
  return markup;
}

function clockSvg(date) {
  const angles = handAngles(date);
  return `<svg class="face" viewBox="0 0 100 100" role="img" aria-label="Zifferblatt">
    <circle class="rim" cx="50" cy="50" r="48"></circle>
    <circle class="dial" cx="50" cy="50" r="43"></circle>
    ${ticks()}
    <line id="hand-hour" class="hand hour" x1="50" y1="52" x2="50" y2="28" transform="rotate(${angles.hour} 50 50)"></line>
    <line id="hand-minute" class="hand minute" x1="50" y1="54" x2="50" y2="18" transform="rotate(${angles.minute} 50 50)"></line>
    <line id="hand-second" class="hand second" x1="50" y1="58" x2="50" y2="14" transform="rotate(${angles.second} 50 50)"></line>
    <circle class="pin" cx="50" cy="50" r="1.7"></circle>
  </svg>`;
}

export function paintLive() {
  const now = formatClock(state.now);
  const nowEl = document.querySelector('[data-now]');
  if (nowEl) nowEl.textContent = now;
  const time = document.querySelector('[data-testid="clock-time"]');
  if (time) time.textContent = now;
  const angles = handAngles(state.now);
  document.getElementById('hand-hour')?.setAttribute('transform', `rotate(${angles.hour} 50 50)`);
  document.getElementById('hand-minute')?.setAttribute('transform', `rotate(${angles.minute} 50 50)`);
  document.getElementById('hand-second')?.setAttribute('transform', `rotate(${angles.second} 50 50)`);
  const countdown = document.querySelector('[data-testid="countdown"]');
  if (countdown) countdown.textContent = countdownText();
  const code = shownStatus();
  const status = document.querySelector('[data-testid="status"]');
  if (status) {
    status.dataset.status = code;
    status.textContent = STATUS_LABELS[code] || 'Bereit';
  }
  document.querySelector('.clock-card')?.setAttribute('data-status', code);
  const leave = state.effective?.leaveBy;
  document.title = leave ? `Chronostasis · los ${formatHM(leave)}` : 'Chronostasis';
}

function shownStatus() {
  if (!state.focus) return 'leer';
  const occ = state.occurrences[state.focus.key];
  if (occ?.pausedReason) return 'pause';
  if (occ?.arrivedAt) return 'angekommen';
  if (state.decision?.cause === 'unterwegs') return 'unterwegs';
  if (state.decision?.cause === 'schlummern') return 'schlummern';
  return state.statusCode || state.plan?.status || 'kein_ziel';
}

function countdownText() {
  const leave = state.effective?.leaveBy;
  if (!leave) return 'Abfahrt offen, bis eine Wegzeit da ist.';
  const delta = leave.getTime() - state.now.getTime();
  if (delta >= 0) return `noch ${formatDuration(delta)}`;
  return `überfällig seit ${formatDuration(-delta)}`;
}

function weekdayText(days) {
  return WEEKDAY_LABELS.filter((day) => days.includes(day.id)).map((day) => day.short).join(' ');
}

function shell(main) {
  const themeLabel = document.documentElement.dataset.theme === 'dark' ? 'Hell' : 'Dunkel';
  return `<header class="top">
      <div>
        <h1>Chronostasis</h1>
        <p class="tag">Die Uhr, die dich gehen lässt</p>
      </div>
      <div class="top-tools">
        <time data-now datetime="${state.now.toISOString()}">${formatClock(state.now)}</time>
        <button type="button" class="ghost" data-action="theme" aria-label="Darstellung wechseln">${themeLabel}</button>
      </div>
    </header>
    <main>${main}</main>
    <nav class="tabs">
      ${tab('uhr', 'Uhr')}${tab('plan', 'Plan')}${tab('statistik', 'Statistik')}${tab('mehr', 'Mehr')}
    </nav>
    ${state.question ? questionSheet() : ''}
    ${state.toast ? `<p class="toast" role="status">${escapeHtml(state.toast)}</p>` : ''}`;
}

function tab(view, label) {
  const current = state.view === view ? ' aria-current="page"' : '';
  return `<button type="button" data-action="nav" data-view="${view}"${current}>${label}</button>`;
}

function questionSheet() {
  const q = state.question;
  const options = q.options.map((opt) => `<button type="button" data-action="answer" data-option="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</button>`).join('');
  return `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="question-title">
    <p class="kicker">Rückfrage</p>
    <h2 id="question-title">${escapeHtml(q.prompt)}</h2>
    <div class="stack">${options}</div>
    <button type="button" class="ghost" data-action="dismiss-question">Später antworten. Die Erinnerung bleibt an.</button>
  </section>`;
}

const ONBOARD = [
  {
    title: 'Eine Uhr für Wege, die du selbst einträgst',
    body: `<p>Chronostasis rechnet rückwärts: Beginn, Puffer, Weg, Fertigmachen. Dann erinnert sie, bis du am Ziel bist.</p>
      <p class="en">A voluntary clock that tells you when to leave. No account, no server, no model.</p>`,
  },
  {
    title: 'Alles bleibt auf diesem Gerät',
    body: `<p>Verpflichtungen, Orte und Gründe liegen in diesem Browser. Es gibt kein Konto und keine Auswertung nach außen.</p>
      <p>Export und Löschen findest du unter Mehr. Karte und Adresssuche fragen OpenStreetMap nur, wenn du sie benutzt. Dabei sehen die Betreiber deine IP und den Suchtext, nicht deine Termine.</p>`,
  },
  {
    title: 'Eine laufende Verpflichtung lässt sich nicht abschalten',
    body: `<p>Wenn der Wecker für heute läuft, gibt es keinen Aus-Schalter. Schlummern ist begrenzt und verschiebt die Abfahrtszeit nicht.</p>
      <p>Pausieren geht über eine konkrete Ausnahme: krank, Homeoffice, frei, Termin verschoben. Einstellungen, die das Nageln ändern, gelten erst ab morgen.</p>
      <p>Wer heute gar nicht will, löscht die Daten oder deinstalliert die App. Das ist absichtlich unbequem.</p>`,
  },
];

function onboard() {
  const step = state.onboardStep;
  if (step < 3) {
    const page = ONBOARD[step];
    return `<section class="onboard">
      <p class="kicker">Schritt ${step + 1} von 4</p>
      <h1>Chronostasis</h1>
      <h2>${page.title}</h2>
      ${page.body}
      <div class="row">
        ${step > 0 ? `<button type="button" class="ghost" data-action="onboard" data-step="${step - 1}">Zurück</button>` : ''}
        <button type="button" data-action="onboard" data-step="${step + 1}">Weiter</button>
      </div>
    </section>`;
  }
  return `<section class="onboard">
    <p class="kicker">Schritt 4 von 4</p>
    <h1>Chronostasis</h1>
    <h2>Freiwillig einrichten</h2>
    <p>Im Browser kann der Wecker aussetzen, sobald das System die Seite schlafen legt. Die Android-App kann exakte Alarme und einen Vollbild-Wecker, solange du die Berechtigungen lässt. iOS hält Hintergrund und den stummen Modus enger. Beides steht in der Dokumentation, ohne Versprechen, die das System nicht hält.</p>
    <label class="check"><input id="consent" type="checkbox"> Ich richte Chronostasis freiwillig ein. Ich verstehe, dass eine laufende Erinnerung in der App nicht abschaltbar ist.</label>
    ${state.formError ? `<p class="error">${escapeHtml(state.formError)}</p>` : ''}
    <div class="row">
      <button type="button" class="ghost" data-action="onboard" data-step="2">Zurück</button>
      <button type="button" data-action="consent">Freiwillig einrichten</button>
    </div>
  </section>`;
}

function clockView() {
  const code = shownStatus();
  const focus = state.focus;
  let body;
  if (!focus) {
    body = `<p data-testid="next-name">Keine Verpflichtung</p>
      <p>Trag Arbeit, Uni oder einen eigenen Termin ein. Die Uhr rechnet dann rückwärts.</p>
      <button type="button" data-action="nav" data-view="plan">Verpflichtung anlegen</button>`;
  } else {
    const c = focus.commitment;
    const leave = state.effective?.leaveBy;
    const wake = state.effective?.wakeAt;
    const travel = state.effective?.travelMin;
    const prep = state.effective?.prepMin;
    const occ = state.occurrences[focus.key];
    const nagging = Boolean(state.decision?.active);
    const snooze = snoozeDecision(occ?.snoozeCount || 0, state.settings.snoozeLimit, state.settings.snoozeMin);
    body = `<p class="kicker">${escapeHtml(TYPE_LABELS[c.type])} · ${escapeHtml(weekdayText(c.weekdays))}</p>
      <h2 data-testid="next-name">${escapeHtml(c.name)}</h2>
      <p>Beginn ${escapeHtml(c.startTime)}${c.dest.label ? ` · ${escapeHtml(c.dest.label)}` : ''}</p>
      ${leave ? `<p class="leave">Losgehen bis <strong data-testid="leave-by">${formatHM(leave)}</strong></p>` : ''}
      <p class="countdown" data-testid="countdown">${countdownText()}</p>
      <p class="meta">Wecken ${wake ? formatHM(wake) : '–'} · Weg ${travel == null ? '–' : `${Math.round(travel)} min`} (${SOURCE[state.plan?.travelSource] || ''}) · Fertigmachen ${prep == null ? '–' : `${Math.round(prep)} min`} · Puffer ${c.bufferMin} min</p>
      ${state.plan?.status === 'kein_ziel' ? '<p class="warn">Ohne Standort oder frühere Fahrten fehlt die Wegzeit. Erlaube den Standort oder trag ein Ziel ein, das sich von hier aus messen lässt.</p><button type="button" class="ghost" data-action="locate">Standort holen</button>' : ''}
      ${state.locStatus === 'denied' ? '<p class="warn">Standort ist blockiert. Ohne ihn kann die App die Ankunft nicht prüfen.</p>' : ''}
      ${nagging ? `<div class="nag">
        <p>Die Erinnerung bleibt an, bis du im Zielradius bist oder ein Ausnahmegrund gilt.</p>
        <div class="row">
          <button type="button" data-action="open-question">Antworten</button>
          <button type="button" data-action="snooze" ${snooze.allowed ? '' : 'disabled'}>Schlummern</button>
        </div>
        <p class="cost">${escapeHtml(snooze.explanation)}</p>
      </div>` : ''}`;
  }
  return `<section class="clock-card" data-status="${code}" data-nag="${state.decision?.active ? '1' : '0'}">
      <p class="date">${formatDateLong(state.now)}</p>
      ${clockSvg(state.now)}
      <p class="digital" data-testid="clock-time">${formatClock(state.now)}</p>
      <p class="status" data-testid="status" data-status="${code}">${STATUS_LABELS[code] || 'Bereit'}</p>
      ${body}
      ${state.note ? `<p class="note">${escapeHtml(state.note)}</p>` : ''}
    </section>`;
}

function planView() {
  if (state.editor) return editor(state.editor);
  const cards = state.commitments.map((c) => `<article class="item">
      <header><h3>${escapeHtml(c.name)}</h3><span>${escapeHtml(TYPE_LABELS[c.type])}</span></header>
      <p>${escapeHtml(weekdayText(c.weekdays))} · ${escapeHtml(c.startTime)} · ${escapeHtml(MODE_LABELS[c.mode])}</p>
      <p>${escapeHtml(c.dest.label || `${c.dest.lat.toFixed(4)}, ${c.dest.lon.toFixed(4)}`)}</p>
      <div class="row">
        <button type="button" class="ghost" data-action="edit" data-id="${escapeHtml(c.id)}">Bearbeiten</button>
        <button type="button" class="ghost danger" data-action="remove" data-id="${escapeHtml(c.id)}">Löschen</button>
      </div>
    </article>`).join('');
  return `<section>
      <div class="section-head"><h2>Plan</h2><button type="button" data-action="new">Neue Verpflichtung</button></div>
      ${cards || '<p>Noch nichts. Eine Verpflichtung hat Tage, eine Uhrzeit, ein Ziel und einen Puffer.</p>'}
    </section>`;
}

function editor(c) {
  const days = new Set(c.weekdays || []);
  const dayButtons = WEEKDAY_LABELS.map((day) => `<button type="button" data-action="weekday" data-day="${day.id}" aria-pressed="${days.has(day.id) ? 'true' : 'false'}">${day.short}</button>`).join('');
  const options = (entries, selected) => Object.entries(entries).map(([id, label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('');
  return `<form class="editor" id="commitment-form">
      <h2>${c.id ? 'Verpflichtung ändern' : 'Neue Verpflichtung'}</h2>
      <label>Name<input id="c-name" required maxlength="80" value="${escapeHtml(c.name)}"></label>
      <label>Art<select id="c-type">${options(TYPE_LABELS, c.type)}</select></label>
      <fieldset><legend>Tage</legend><div class="days">${dayButtons}</div></fieldset>
      <label>Start<input id="c-start" type="time" required value="${escapeHtml(c.startTime)}"></label>
      <div class="split">
        <label>Puffer in Minuten<input id="c-buffer" type="number" min="0" max="180" value="${Number(c.bufferMin)}"></label>
        <label>Fertigmachen in Minuten<input id="c-prep" type="number" min="0" max="180" value="${Number(c.prepDefaultMin)}"></label>
      </div>
      <label>Weg<select id="c-mode">${options(MODE_LABELS, c.mode)}</select></label>
      <label>Ort<input id="c-label" maxlength="160" value="${escapeHtml(c.dest?.label || '')}" placeholder="Name, optional"></label>
      <div class="split">
        <label>Breite<input id="c-lat" inputmode="decimal" value="${escapeHtml(c.dest?.lat ?? '')}"></label>
        <label>Länge<input id="c-lon" inputmode="decimal" value="${escapeHtml(c.dest?.lon ?? '')}"></label>
      </div>
      <div class="row">
        <button type="button" class="ghost" data-action="use-here">Aktuellen Standort als Ziel</button>
      </div>
      <label>Adresse suchen<input id="c-query" placeholder="Straße, Ort"></label>
      <button type="button" class="ghost" data-action="search">Adresse suchen</button>
      <div id="search-results" class="results"></div>
      <p class="fine">Eine Anfrage pro Sekunde, Treffer bleiben auf dem Gerät. Die Anfrage geht an nominatim.openstreetmap.org. Karte: © OpenStreetMap-Mitwirkende.</p>
      <div id="map" class="map"></div>
      ${state.formError ? `<p class="error">${escapeHtml(state.formError)}</p>` : ''}
      <div class="row">
        <button type="button" class="ghost" data-action="cancel-edit">Abbrechen</button>
        <button type="submit" data-action="save">Verpflichtung sichern</button>
      </div>
    </form>`;
}

function statsView() {
  const records = recordsInWeek(recordsFromOccurrences(state.occurrences), state.now);
  const stats = summarize(records);
  const range = weekRange(state.now);
  const from = formatISODate(range.from);
  const to = formatISODate(range.to);
  const snoozes = Object.values(state.occurrences)
    .filter((occ) => occ.date >= from && occ.date < to)
    .reduce((sum, occ) => sum + (occ.snoozeCount || 0), 0);
  const quote = stats.quote == null ? 'noch offen' : `${Math.round(stats.quote * 100)} %`;
  const reasons = Object.entries(stats.reasons);
  const reasonList = reasons.length
    ? `<ul>${reasons.map(([key, count]) => `<li>${escapeHtml(REASON_LABELS[key] || key)}: ${count}</li>`).join('')}</ul>`
    : '<p>Noch keine Gründe.</p>';
  return `<section>
      <h2>Diese Woche</h2>
      <p class="fine">${formatDateLong(range.from)} bis ${formatDateLong(addDays(range.to, -1))}</p>
      <div class="metrics">
        <article><p>Pünktlichkeitsquote</p><strong>${quote}</strong></article>
        <article><p>Durchschnittsverspätung</p><strong>${stats.late ? `${Math.round(stats.avgLateMin)} min` : '0 min'}</strong></article>
        <article><p>Häufigster Grund</p><strong>${escapeHtml(stats.topReason ? (REASON_LABELS[stats.topReason] || stats.topReason) : '–')}</strong></article>
      </div>
      <p class="fine">Die Quote zählt pünktliche Ankünfte gegen verspätete und verpasste. Krank, Homeoffice, frei und verschoben stehen außerhalb der Quote und unter den Gründen. Schlummern diese Woche: ${snoozes}.</p>
      ${reasonList}
      ${reflectionCard()}
      ${state.formError ? `<p class="error">${escapeHtml(state.formError)}</p>` : ''}
    </section>`;
}

function reflectionCard() {
  if (state.now.getHours() < 18) return '';
  const date = formatISODate(state.now);
  const occ = Object.values(state.occurrences).find((item) => item.date === date
    && !item.reflectionDone
    && (item.outcome || item.startMs <= state.now.getTime()));
  if (!occ) return '';
  const name = state.commitments.find((item) => item.id === occ.commitmentId)?.name || 'Termin';
  const known = occ.outcome
    ? `<p>Erfasst: ${escapeHtml(occ.outcome === 'on_time' ? 'pünktlich' : occ.outcome === 'late' ? `${Math.round(occ.lateMin)} min zu spät` : (REASON_LABELS[occ.reason] || occ.outcome))}.</p>`
    : `<fieldset>
        <legend>Wie war ${escapeHtml(name)}?</legend>
        <label class="check"><input type="radio" name="outcome" value="on_time"> Pünktlich oder früher</label>
        <label class="check"><input type="radio" name="outcome" value="late"> Verspätet</label>
        <label>Minuten zu spät<input id="r-late" type="number" min="0" max="300" value="0"></label>
      </fieldset>`;
  return `<form class="editor" id="reflection-form">
      <h3>Abend</h3>
      <p>Wie lange hast du dich für ${escapeHtml(name)} fertig gemacht? Die Zahl korrigiert die nächste Schätzung.</p>
      ${known}
      <input type="hidden" id="r-key" value="${escapeHtml(occ.key)}">
      <label>Fertigmachen in Minuten<input id="r-prep" type="number" min="0" max="180" placeholder="optional"></label>
      <button type="submit" data-action="reflect">Abendnotiz sichern</button>
    </form>`;
}

function settingsView() {
  const s = state.settings;
  const speedFields = ['walk', 'bike', 'transit', 'car'].map((mode) => `<div class="speed-row"><span>${MODE_LABELS[mode]}</span><label>km/h<input id="s-speed-${mode}" type="number" min="1" max="150" step="0.1" value="${s.speeds[mode]}"></label><label>Faktor<input id="s-factor-${mode}" type="number" min="0.3" max="3" step="0.05" value="${s.factors[mode]}"></label></div>`).join('');
  const phases = s.phases;
  const home = s.home;
  return `<section>
      <h2>Mehr</h2>
      ${pendingNote()}
      <form id="settings-form" class="editor">
        <h3>Tempo und Faktor</h3>
        <p class="fine">Faktor 1 ist die Grundgeschwindigkeit. Weniger als 1 macht den Weg langsamer. Gilt ab morgen.</p>
        <div class="speeds">${speedFields}</div>
        <h3>Erinnerung ab morgen</h3>
        <div class="split">
          <label>Erste Minuten, Intervall<input id="s-every-0" type="number" min="1" max="30" value="${phases[0].everyMin}"></label>
          <label>Danach bis 40 min<input id="s-every-1" type="number" min="1" max="30" value="${phases[1].everyMin}"></label>
          <label>Danach, Intervall<input id="s-every-2" type="number" min="1" max="30" value="${phases[2].everyMin}"></label>
        </div>
        <div class="split">
          <label>Schlummern, höchstens<input id="s-snooze" type="number" min="0" max="5" value="${s.snoozeLimit}"></label>
          <label>Zielradius in Metern<input id="s-geo" type="number" min="30" max="500" value="${s.geofenceM}"></label>
        </div>
        <h3>Wohnort</h3>
        <p class="fine">Der erste Wohnort gilt sofort, damit „noch zu Hause“ prüfbar ist. Ein späterer Wechsel gilt ab morgen.</p>
        <div class="split">
          <label>Breite<input id="s-lat" inputmode="decimal" value="${home ? home.lat : ''}"></label>
          <label>Länge<input id="s-lon" inputmode="decimal" value="${home ? home.lon : ''}"></label>
        </div>
        <button type="button" class="ghost" data-action="home-here">Aktuellen Standort als Wohnort</button>
        ${state.formError && state.view === 'mehr' ? `<p class="error">${escapeHtml(state.formError)}</p>` : ''}
        <button type="submit" data-action="save-settings">Für morgen sichern</button>
      </form>
      ${permissions()}
      <section class="block">
        <h3>Daten</h3>
        <p>Export ist eine JSON-Datei. Löschen entfernt Verpflichtungen, Gründe und die Zustimmung. Eine laufende Erinnerung endet damit, weil nichts mehr zu erinnern ist.</p>
        <div class="row">
          <button type="button" class="ghost" data-action="export">Alle Daten exportieren</button>
          <button type="button" class="ghost danger" data-action="arm-delete">Alle Daten löschen</button>
        </div>
        ${state.deleteArmed ? `<label>Tippe LÖSCHEN<input id="wipe-word" autocomplete="off"></label><button type="button" class="danger" data-action="wipe">Endgültig löschen</button>` : ''}
      </section>
      <section class="block en-block">
        <h3>English</h3>
        <p>Chronostasis is a voluntary, on-device alarm clock. It estimates when to leave from distance, a mode speed, and your own history. Once today’s alarm has started there is no off switch inside the app. Legitimate exceptions are illness, working from home, a free day, or a moved appointment. Settings that soften the nagging apply tomorrow. Uninstall or delete-all are the full exits. The browser cannot promise exact alarms or background geofences. The Android build can schedule exact alarms and a full-screen wake alarm when you grant those permissions. iOS cannot.</p>
      </section>
    </section>`;
}

function pendingNote() {
  if (!state.pending?.effectiveOn) return '';
  const keys = Object.keys(state.pending).filter((key) => key !== 'effectiveOn');
  if (!keys.length) return '';
  return `<p class="note">Es liegen Änderungen für morgen, 0:00 Uhr: ${escapeHtml(keys.join(', '))}.</p>`;
}

function permissions() {
  const android = state.platform === 'android';
  return `<section class="block">
      <h3>Gerät</h3>
      <p>Benachrichtigungen und Standort sind nötig, damit Wecken und Ankunft funktionieren. Verweigert das System sie, sagt die App das und fragt nach einem Grund.</p>
      <div class="stack">
        <button type="button" class="ghost" data-action="notify">Benachrichtigungen erlauben</button>
        <button type="button" class="ghost" data-action="locate">Standort holen</button>
        ${android ? `<button type="button" class="ghost" data-action="exact">Exakte Alarme öffnen</button>
          <button type="button" class="ghost" data-action="fullscreen">Vollbild-Wecker öffnen</button>
          <button type="button" class="ghost" data-action="battery">Akku-Optimierung öffnen</button>` : '<p class="fine">Exakte Alarme, Vollbild und Akku-Ausnahme gibt es in der Android-App, nicht in dieser Browserseite. iOS liefert sie nicht.</p>'}
      </div>
      ${state.needsExact ? '<p class="warn">Exakte Alarme sind aus. Ohne sie verschiebt Android den Wecker.</p>' : ''}
    </section>`;
}

export function render() {
  const root = document.getElementById('app');
  if (!root) return;
  if (!state.ready) {
    root.innerHTML = '<p class="loading">Laden …</p>';
    return;
  }
  if (state.loadError && !state.consent) {
    root.innerHTML = `<p class="error">${escapeHtml(state.loadError)}</p>`;
    return;
  }
  if (!state.consent) {
    root.innerHTML = onboard();
    return;
  }
  const view = state.view === 'plan'
    ? planView()
    : state.view === 'statistik'
      ? statsView()
      : state.view === 'mehr'
        ? settingsView()
        : clockView();
  root.innerHTML = shell(view);
}

export function afterRender() {
  const container = document.getElementById('map');
  if (container) mountMap(container);
}

export function readCommitmentForm() {
  const weekdays = [...document.querySelectorAll('[data-day][aria-pressed="true"]')].map((button) => Number(button.dataset.day));
  return {
    name: document.getElementById('c-name').value,
    type: document.getElementById('c-type').value,
    weekdays,
    startTime: document.getElementById('c-start').value,
    bufferMin: document.getElementById('c-buffer').value,
    prepDefaultMin: document.getElementById('c-prep').value,
    mode: document.getElementById('c-mode').value,
    dest: {
      lat: document.getElementById('c-lat').value,
      lon: document.getElementById('c-lon').value,
      label: document.getElementById('c-label').value,
    },
  };
}

export function readSettingsForm() {
  const speeds = {};
  const factors = {};
  for (const mode of ['walk', 'bike', 'transit', 'car']) {
    speeds[mode] = Number(document.getElementById(`s-speed-${mode}`).value);
    factors[mode] = Number(document.getElementById(`s-factor-${mode}`).value);
  }
  const phases = [
    { untilMin: 20, everyMin: Number(document.getElementById('s-every-0').value), intensity: 1 },
    { untilMin: 40, everyMin: Number(document.getElementById('s-every-1').value), intensity: 2 },
    { untilMin: null, everyMin: Number(document.getElementById('s-every-2').value), intensity: 3 },
  ];
  const lat = document.getElementById('s-lat').value.trim();
  const lon = document.getElementById('s-lon').value.trim();
  const patch = {
    speeds,
    factors,
    phases,
    snoozeLimit: Number(document.getElementById('s-snooze').value),
    geofenceM: Number(document.getElementById('s-geo').value),
  };
  if (lat !== '' || lon !== '') {
    const nextHome = { lat: Number(lat), lon: Number(lon), label: 'Wohnort' };
    const current = state.settings.home;
    if (!current || current.lat !== nextHome.lat || current.lon !== nextHome.lon) patch.home = nextHome;
  }
  return patch;
}

export function readReflectionForm() {
  const selected = document.querySelector('input[name="outcome"]:checked');
  return {
    key: document.getElementById('r-key').value,
    outcome: selected?.value || '',
    lateMin: document.getElementById('r-late')?.value || 0,
    prepMin: document.getElementById('r-prep').value,
  };
}
