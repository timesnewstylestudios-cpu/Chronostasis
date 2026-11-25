# Chronostasis

Eine freiwillige Uhr gegen Zuspätkommen. Du trägst Arbeit, Uni oder einen eigenen Termin ein. Die App rechnet aus Entfernung, Tempo und deinen bisherigen Wegen, wann du aufstehen und losgehen musst, und erinnert dich, bis du im Zielradius bist.

Es gibt kein Konto, keinen Server und kein Modell. Die Rechnung steht in [docs/algorithmen.md](docs/algorithmen.md). Alles außer der Karte bleibt auf dem Gerät.

## Funktionen

- Wiederkehrende Verpflichtungen mit Wochentagen, Beginn, Ziel und Puffer. Das Ziel kommt von der Karte (Leaflet, Kacheln von OpenStreetMap), von einer Adresse (Nominatim, höchstens eine Anfrage pro Sekunde, Treffer bleiben lokal) oder von Koordinaten.
- Abfahrt und Wecken: Haversine-Entfernung, Tempo zu Fuß, Rad, ÖPNV oder Auto, dazu ein Faktor. Aus echten Dauern werden ein exponentiell gewichtetes Mittel und ein 85.-Perzentil-Puffer. Fertigmachen lernt mit.
- Erinnerung ab der Weckzeit, zuerst alle 10 Minuten, dann alle 5, dann alle 2, lauter in der Stufe. Im Zielradius endet sie. Wer sich nachweisbar nähert, bekommt nur noch die langsame Stufe. Schlummern ist begrenzt und verschiebt die Abfahrt nicht.
- An einem laufenden Tag gibt es keinen Aus-Schalter. Pause nur über die Fragen: krank, Homeoffice, frei, Termin verschoben, oder kein Standort, wenn keiner messbar ist. „Keine Lust“ lässt die Erinnerung an. Einstellungen, die das Nageln ändern, gelten ab der nächsten Mitternacht. Daten löschen und Deinstallieren bleiben möglich.
- Abendnotiz und Wochenzahlen: Pünktlichkeitsquote, Durchschnittsverspätung, häufigste Gründe.
- Großes Zifferblatt, Hell und Dunkel, als PWA installierbar, offline über einen Service Worker.

## Datenschutz

IndexedDB und `localStorage` auf diesem Gerät. Kein Tracking, kein Konto. Export und Löschen stehen unter Mehr.

Netz nur, wenn du die Karte oder die Adresssuche öffnest. OpenStreetMap sieht dann deine IP, Nominatim zusätzlich den Suchtext. Deine Termine gehen nicht mit. Im Browser lässt sich der User-Agent nicht setzen. Die Android-Hülle hängt `Chronostasis/1.0` an.

## Installieren

### Android, nur die Seite

Chrome, Seite öffnen, „Zum Startbildschirm“. Benachrichtigungen erlauben. Der Browser kann die Seite schlafen legen. Exakte Alarme und ein Geofence im Hintergrund gibt es so nicht. Die Erinnerung ist verlässlich, solange die Seite offen ist.

### Android, App aus Termux oder Termux Studio

[docs/android-termux.md](docs/android-termux.md). Kurz: Node 20, JDK 21, eine aapt2 für arm64, ein Android-SDK, dann `bash scripts/build-android-termux.sh`. Das Skript erkennt Termux Studio (`~/android-sdk`, JDK unter `$PREFIX/lib/jvm`, aapt2 in `build-tools/36.0.0`) und fällt sonst auf ein gewöhnliches Termux und auf `ANDROID_HOME` zurück. Die APK ist eine Debug-APK. Danach Benachrichtigungen, Standort inklusive Hintergrund, exakte Alarme, Vollbild-Intent und eine Ausnahme von der Akku-Optimierung erlauben.

Die Hülle nutzt `@capacitor/local-notifications` für die Erinnerungskette und die Berechtigung für exakte Alarme. Den Weckzeitpunkt mit Vollbild legt das lokale Plugin `chronostasis-alarm` über `AlarmManager.setAlarmClock`, weil das offizielle Plugin keinen Full-Screen-Intent kennt und `allowWhileIdle` im Doze-Modus nur etwa einmal in neun Minuten feuern darf. Hintergrundpunkte kommen von `@capacitor-community/background-geolocation`: die App muss selbst sehen, ob die Entfernung sinkt und die Richtung zum Ziel zeigt. Ein reines Betreten-Verlassen-Geofence reicht dafür nicht. `@capacitor-community/keep-awake` hält den Bildschirm während der Erinnerung an.

Lautlos und „Nicht stören“ werden nicht umgangen. Ein erzwungenes Beenden löscht die Wecker bis zum nächsten Öffnen.

### Android Studio

[docs/android-studio.md](docs/android-studio.md). Dort die Termux-aapt2 nicht eintragen.

### iOS

[docs/ios.md](docs/ios.md). Safari, „Zum Home-Bildschirm“. Web-Benachrichtigungen für installierte Seiten ab iOS 16.4, nur solange das System sie zulässt, nicht durch den lautlosen Schalter. Standort nur im Vordergrund. Kein Hintergrund-Geofence, kein Wecker, der den Fokus übergeht.

Eine native Hülle braucht einen Mac. `.github/workflows/ios-unsigned-ipa.yml` kann von Hand ein unsigniertes IPA bauen. iOS installiert das nicht, bevor AltStore oder SideStore es mit einer Apple-ID signiert. Bei einer kostenlosen Apple-ID alle 7 Tage neu. Der Workflow ist ein Versuch, kein Versprechen, dass der aktuelle Xcode-Stand durchläuft.

## Seiten bauen und veröffentlichen

```bash
npm install
npm test
npm run build
npm run dev
```

GitHub Pages: unter Einstellungen der Quelle **GitHub Actions** wählen. Der Workflow `.github/workflows/pages.yml` baut `dist/` und veröffentlicht sie. Er läuft beim Schieben auf `main`. Die App nutzt relative Pfade, damit sie unter `https://<name>.github.io/<repo>/` liegt.

Pull Requests führt `.github/workflows/ci.yml` die Unit-Tests und den Playwright-Lauf auf einem Handy-Viewport aus.

## English

Chronostasis is a voluntary, on-device clock for getting to work or class on time. You enter the commitment. It estimates leave-by and wake time from distance, a mode speed, and your own history (an exponential moving average plus an 85th-percentile buffer). Nagging escalates until you enter the destination radius or answer a fixed question with a real exception. There is no off switch for a day that has already started. Settings that would soften it apply at the next local midnight. Data stays in IndexedDB. Delete and export are in the app. There is no model and no account.

Install the static site as a PWA, or build the Android debug APK in Termux or Termux Studio with `scripts/build-android-termux.sh` (it prints the SDK, JDK, and aapt2 it found). Set GitHub Pages to deploy from GitHub Actions. iOS is the Safari Home Screen app, plus an optional unsigned IPA workflow that still needs re-signing every 7 days. Platform limits are spelled out in `docs/ios.md` and `docs/android-termux.md` and are not exceeded here.

## Lizenz

[CC0 1.0](LICENSE). Die Autorin oder der Autor gibt die Urheberrechte an diesem Werk auf, soweit das Recht das zulässt. OpenStreetMap und die npm-Pakete behalten ihre eigenen Lizenzen.
