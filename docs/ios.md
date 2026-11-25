# iOS

Was auf einem iPhone geht, ist weniger als auf Android. Die App behauptet nichts darüber hinaus.

English: an installed PWA can show notifications while the system allows them, and can read location only in the foreground. It cannot geofence in the background or ring through Silent mode. A native build needs a Mac, and a free Apple ID expires every 7 days.

## Installierte Webseite

In Safari die Seite öffnen und „Zum Home-Bildschirm“. Ab iOS 16.4 können so installierte Seiten Web-Benachrichtigungen bekommen, nachdem du sie erlaubst. Sie feuern nicht zuverlässig wie ein Wecker. Stumm und Fokus bleiben stumm. Es gibt keine exakten Alarme und kein Vollbild, das den Sperrbildschirm übernimmt.

Der Standort läuft nur, solange die Seite vorn ist. Im Hintergrund kein Geofence und keine Prüfung, ob du dich dem Ziel näherst. Die Erinnerung in der geöffneten Seite (Ton, Vibration, Fragen) läuft. Legst du das Telefon weg, endet sie mit der Seite.

## Native Hülle

Capacitor kann ein iOS-Projekt erzeugen (`npx cap add ios`). Ein installierbares Paket entsteht nur auf macOS mit Xcode. Ein IPA ohne Signatur installiert iOS nicht.

Der Workflow `.github/workflows/ios-unsigned-ipa.yml` ist absichtlich nur von Hand startbar. Er versucht auf einem macOS-Runner ein unsigniertes IPA zu bauen (`CODE_SIGNING_ALLOWED=NO`) und legt es als Artefakt ab. Das ist ein Baumversuch, kein installierbares Ergebnis. Ob der Lauf mit der jeweiligen Xcode-Version durchkommt, ist nicht garantiert. Dieses Repositorium hat den Lauf nicht ausgeführt.

Installation danach, wenn du das IPA selbst signierst:

- AltStore oder SideStore mit einer kostenlosen Apple-ID
- neu signieren alle 7 Tage, sonst öffnet die App nicht mehr
- eine bezahlte Entwickler-Mitgliedschaft verlängert das auf ein Jahr und ist hier nicht vorausgesetzt

Es gibt kein Critical-Alerts-Recht. Das vergibt Apple einzeln, und diese App hat es nicht. Der native Bau kann lokale Benachrichtigungen planen. Er kann den lautlosen Schalter nicht übergehen und im Hintergrund kein Geofence halten, das die Android-Seite beschreibt. Das Vollbild-Plugin ist nur Android.

## English

Add the site to the Home Screen from Safari. Web push for that icon needs iOS 16.4 or newer and still will not bypass Silent or Focus. Foreground location only. Sideloading needs an IPA built on macOS. The optional workflow uploads an unsigned IPA artifact. Re-sign it with AltStore or SideStore. A free Apple ID lasts 7 days.
