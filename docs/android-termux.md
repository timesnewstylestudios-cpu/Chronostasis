# Android-App in Termux bauen

Die App ist eine Capacitor-Hülle um dieselbe statische Seite. Auf einem arm64-Handy lädt das Android-Gradle-Plugin sonst eine aapt2 für x86_64. Die startet nicht. `scripts/build-android-termux.sh` sucht eine aapt2, die auf dem Gerät läuft, schreibt `android.aapt2FromMavenOverride` und `sdk.dir`, und sagt vorher, welche Umgebung es erkannt hat.

English: build a debug APK on device. The script detects Termux Studio first, then plain Termux, then `ANDROID_HOME` / `ANDROID_SDK_ROOT` / `JAVA_HOME`, and points Gradle at that aapt2. Do not set the override on a desktop.

## Pakete

```bash
pkg update
pkg install -y nodejs openjdk-21 aapt2 git curl unzip
```

Node muss mindestens 20 sein, weil die Capacitor-Werkzeuge das verlangen. `node -v` zeigt es.

## Termux Studio

[Termux Studio](https://github.com/poordevcode/termux-android-studio) ist eine Termux-Umgebung mit eigenem `studio`-Befehl, nicht Android Studio auf dem Desktop. Der Installer (Stand der Datei `install.sh` im Repo) legt die Werkzeuge so ab:

| Was | Pfad |
| --- | --- |
| Prefix | `$PREFIX`, sonst `/data/data/com.termux/files/usr` |
| Home | `$HOME`, sonst `/data/data/com.termux/files/home` |
| Android-SDK | `$HOME/android-sdk` |
| JDK 21, auch 17 und 11 | `$PREFIX/lib/jvm/java-21-openjdk` (daneben `java-17-openjdk`, `java-11-openjdk`) |
| aapt2, die moderne | `$HOME/android-sdk/build-tools/36.0.0/aapt2`, Kopie `$PREFIX/bin/aapt2-aosp`; vorhanden falls da auch `build-tools/34.0.4/aapt2` |
| Gradle-Vorgabe | `$HOME/.gradle/gradle.properties`: `android.aapt2FromMavenOverride` und `org.gradle.java.home` |
| Gradle-Paket | `$PREFIX/bin/gradle` |
| Marker | `$PREFIX/bin/studio`, `$HOME/.studio`, `$HOME/termux_studio.py`, Ordner `$HOME/termux-studio` |

Node kommt dabei nicht mit. Dafür bleibt `pkg install nodejs` (mindestens 20).

Das Bau-Skript erkennt Studio an einem dieser Marker und nimmt dann zuerst die Studio-Pfade. Die aapt2 aus `pkg` (`$PREFIX/bin/aapt2`) kann nur bis SDK 34 lesen. Studio legt deshalb eine eigene aarch64-aapt2 über die Build-Tools. Die wird bevorzugt, auch wenn das Paket installiert ist. `JAVA_HOME` zeigt auf das JDK aus `org.gradle.java.home` oder auf Java 21. `local.properties` bekommt `sdk.dir` des erkannten SDK.

Beim Start druckt das Skript Umgebung, PREFIX, HOME, JAVA_HOME, ANDROID_HOME, aapt2, Node und das System-Gradle. Gebaut wird trotzdem mit `android/gradlew`.

Andere Installationen heißen ähnlich, legen die Dateien aber woanders hin. Das Skript probiert sie der Reihe nach und nimmt die erste, die wirklich existiert und sich starten lässt. Es rät nicht einen einzelnen Pfad als den einzigen:

- SDK: `$HOME/android-sdk`, `$HOME/Android/Sdk`, `$HOME/Android/sdk`, `$PREFIX/opt/android-sdk`, danach `ANDROID_SDK_ROOT` und `ANDROID_HOME`
- aapt2: Eintrag in `~/.gradle/gradle.properties`, dann `build-tools/36.0.0`, `36.1.0`, `35.0.0`, `34.0.4`, dann die übrigen Build-Tools absteigend, `$PREFIX/bin/aapt2-aosp`, `$HOME/.androidide/aapt2` (das ist AndroidIDE, ein anderes Programm), zum Schluss `$PREFIX/bin/aapt2` und die Variable `AAPT2`
- JDK: `org.gradle.java.home`, `java-21-openjdk`, `java-17-openjdk`, `java-11-openjdk`, `$PREFIX/opt/openjdk`, danach `JAVA_HOME`

`$HOME/.androidide/aapt2` und `$PREFIX/opt/openjdk` stammen von AndroidIDE (`com.itsaky.androidide`), nicht von Termux Studio. Sie stehen nur auf der Suchliste, falls die Binärdatei dort liegt.

Ohne Studio-Marker gilt die Reihenfolge für ein gewöhnliches Termux: zuerst `$HOME/android-sdk` und `$PREFIX/bin/aapt2`, und nur wenn die fehlen `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME` und `AAPT2`. Eine gesetzte Variable gewinnt also nicht gegen ein gefundenes Studio. Wer absichtlich ein anderes SDK will, ruft das Skript ohne die Studio-Marker auf oder verschiebt sie.

Das Projekt muss unter `$HOME` liegen. `/storage` ist oft `noexec`, dann startet `./gradlew` nicht.

## Android-SDK ohne Termux Studio

Lege es nach `$HOME/android-sdk`. Plattform und Build-Tools kommen als Zip von Google, zum Beispiel Plattform 35 und Build-Tools 35. Der Ordner der Build-Tools muss so heißen, wie Gradle ihn erwartet (`35.0.0`, nicht der Name aus dem Zip). `local.properties` schreibt das Skript selbst.

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

Install Node 20+ (`pkg install nodejs`; Termux Studio does not install Node), JDK 21, and an Android SDK. With Termux Studio the usual places are `$HOME/android-sdk`, `$PREFIX/lib/jvm/java-21-openjdk`, and `$HOME/android-sdk/build-tools/36.0.0/aapt2`. The script prints the paths it actually found and still falls back to plain Termux and to `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`. The override exists because the Maven aapt2 binary is not arm64. Exact alarms, a full-screen wake notification, background locations, and a temporary wake lock are Android-only and still depend on the permissions above. Doze can delay the ordinary notification chain. Silent mode and Do Not Disturb are not bypassed.
