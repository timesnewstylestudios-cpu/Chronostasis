# Android-App in Termux bauen

Die App ist eine Capacitor-Hülle um dieselbe statische Seite. Auf einem arm64-Handy lädt das Android-Gradle-Plugin sonst eine aapt2 für x86_64. Die startet nicht. `scripts/build-android-termux.sh` setzt deshalb `android.aapt2FromMavenOverride` auf die aapt2 aus Termux und übergibt denselben Pfad an Gradle.

English: build a debug APK on device. The script points Gradle at Termux's arm64 aapt2 via `android.aapt2FromMavenOverride`. Do not set that property on a desktop.

## Pakete

```bash
pkg update
pkg install -y nodejs openjdk-21 aapt2 git curl unzip
```

Node muss mindestens 20 sein, weil die Capacitor-Werkzeuge das verlangen. `node -v` zeigt es.

## Android-SDK ohne Android Studio

Lege es nach `$HOME/android-sdk`. Plattform und Build-Tools kommen als Zip von Google, zum Beispiel Plattform 35 und Build-Tools 35. Der Ordner der Build-Tools muss so heißen, wie Gradle ihn erwartet (`35.0.0`, nicht der Name aus dem Zip). `local.properties` schreibt das Skript selbst, aus `ANDROID_HOME` oder `$HOME/android-sdk`.

## Bauen

```bash
git clone <dieses-repo>
cd chronostasis
bash scripts/build-android-termux.sh
```

Das Skript installiert die npm-Pakete, baut `dist/`, legt `android/` an, falls es fehlt, synchronisiert die Plugins und ruft `assembleDebug` auf. Die APK liegt unter `android/app/build/outputs/apk/debug/app-debug.apk`. Kopiere sie nach `~/storage/downloads` und öffne sie. Unbekannte Quellen muss Android dafür einmal erlauben.

`aapt2 version` muss vorher ohne „Exec format error“ durchlaufen. Eine Datei von Maven für Linux-Desktop erfüllt das auf dem Handy nicht.

## Was die Hülle kann, die Webseite nicht

- `@capacitor/local-notifications`: Erinnerungen mit `allowWhileIdle`, Kanal mit höchster Wichtigkeit, und die Abfrage der exakten Alarme (`checkExactNotificationSetting`, `changeExactNotificationSetting`). Ab Android 12 ist `SCHEDULE_EXACT_ALARM` nötig. Zusätzlich steht `USE_EXACT_ALARM` im Manifest, weil der Wecker der Zweck der App ist. Im Play Store prüft Google das eng. Dieser Bauweg ist für die eigene APK, nicht für den Store.
- Im Doze-Modus darf `allowWhileIdle` nur etwa einmal in neun Minuten feuern. Die Kette alle zwei Minuten ist deshalb nicht das, was Doze garantiert.
- Das lokale Plugin `chronostasis-alarm` legt den nächsten Weckzeitpunkt mit `AlarmManager.setAlarmClock` und einem Full-Screen-Intent. Das ist die Alarm-Uhr-Schnittstelle und unterliegt nicht dem Neun-Minuten-Takt. Es umgeht „Nicht stören“ und den lautlosen Modus nicht. Der Ton hängt am Alarm-Kanal. Ob er klingt, entscheidet das Klingelprofil.
- Vollbild braucht `USE_FULL_SCREEN_INTENT`. Ab Android 14 kann das in den Einstellungen liegen. Der Knopf in der App öffnet diese Seite. Die Aktivität bekommt `showWhenLocked` und `turnScreenOn`, damit der Wecker auf der Sperre erscheinen kann. Manche Hersteller halten ihn trotzdem zurück.
- `@capacitor-community/background-geolocation` statt eines reinen Geofence-Plugins: die App braucht die Positionen selbst, um „näher“ und „Richtung zum Ziel“ zu rechnen. Ein Enter/Exit-Geofence liefert das nicht. Das Plugin zeigt die vorgeschriebene Vordergrund-Benachrichtigung, solange es im Hintergrund misst. In der Capacitor-Konfiguration steht `android.useLegacyBridge: true`, sonst können die Updates nach einigen Minuten aussetzen.
- `@capacitor-community/keep-awake` hält den Bildschirm an, solange die Erinnerung läuft und die Seite sichtbar ist.
- Nach einem Neustart legt der Boot-Empfänger die gespeicherten Wecker neu. Die Kette darüber hinaus rechnet die Seite, sobald sie wieder offen ist. Ein erzwungenes Beenden der App löscht auch das.

## Berechtigungen nach dem Installieren

Benachrichtigungen, genauer Standort, Standort die ganze Zeit (für die Hintergrundprüfung), exakte Alarme, Vollbild-Intents, und Akku auf „uneingeschränkt“. Ohne die letzten Punkte verschiebt Android den Wecker. Die App sagt das, sie kann es nicht erzwingen.

## English

Install Node 20+, JDK 21, Termux `aapt2`, and an Android SDK. Run `scripts/build-android-termux.sh`. The override exists because the Maven aapt2 binary is not arm64. Exact alarms, a full-screen wake notification, background locations, and a temporary wake lock are Android-only and still depend on the permissions above. Doze can delay the ordinary notification chain. Silent mode and Do Not Disturb are not bypassed.
