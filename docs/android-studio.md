# Android Studio

Für einen Rechner mit Android Studio brauchst du die Termux-Umleitung nicht. `android.aapt2FromMavenOverride` würde dort auf eine Handy-Datei zeigen und den Desktop-Bau stören. Lass die Eigenschaft weg.

English: on a desktop, do not set `android.aapt2FromMavenOverride`. Android Studio's own aapt2 is the right one.

## Schritte

Node 20 oder neuer, JDK 21, Android Studio mit SDK 35.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio das SDK zuweisen und die Debug-Variante starten. `scripts/patch-android.mjs` kannst du ohne aapt2-Pfad aufrufen, wenn du nur das Statusleisten-Icon und `showWhenLocked` / `turnScreenOn` an der Aktivität setzen willst:

```bash
node scripts/patch-android.mjs
```

Die Plugins sind dieselben wie in [android-termux.md](android-termux.md): lokale Benachrichtigungen mit exaktem Alarm, das Vollbild-Plugin `chronostasis-alarm`, Hintergrundortung über `@capacitor-community/background-geolocation`, und `@capacitor-community/keep-awake`.

Warum nicht ein Geofence-only-Plugin: die Entscheidung „nähert sich“ braucht die Punkte und die Richtung. Die rechnet die App selbst. Die Hintergrundortung liefert die Punkte und die Vordergrund-Benachrichtigung, die Android dafür verlangt.

## Grenzen

Dieselben wie auf dem Gerät: Doze bündelt gewöhnliche `allowWhileIdle`-Erinnerungen auf ungefähr eine alle neun Minuten. Der Weckzeitpunkt selbst geht über `setAlarmClock`. Lautlos und „Nicht stören“ bleiben in der Hand des Systems. Nach „Beenden erzwingen“ ist kein Wecker mehr da, bis die App wieder läuft.

Die APK aus diesem Weg ist eine Debug-APK ohne Store-Signatur. `USE_EXACT_ALARM` ist für eine Wecker-App gedacht. Im Play Store gilt dafür eine eigene Richtlinie. Dieser Bau ist zum Sideload.
