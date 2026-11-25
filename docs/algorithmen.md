# Algorithmen

Chronostasis rechnet nur mit festen Formeln. Es gibt kein Modell, keine eingebaute Sprachausgabe und keine Anfrage an einen Dienst, der Antworten erzeugt. Jede Zahl lässt sich aus den Eingaben nachrechnen.

English: every estimate below is a deterministic function of distance, a speed table, and the samples stored on the device.

## Entfernung

Zwei Koordinaten werden mit der Haversine-Formel auf einer Kugel mit Radius 6371 km in eine Strecke umgerechnet. Dieselbe Funktion prüft den Zielradius und die Bewegungsrichtung.

## Wegzeit aus Tempo

Vier Grundgeschwindigkeiten, Tür zu Tür, nicht Höchsttempo:

| Weg | km/h |
| --- | --- |
| Zu Fuß | 4,8 |
| Rad | 15 |
| ÖPNV | 22 |
| Auto | 32 |

Ein Faktor pro Wegart skaliert die Geschwindigkeit. Faktor 0,8 macht denselben Weg langsamer, Faktor 2 schneller. Minuten = Entfernung / (Tempo × Faktor) × 60.

## Erfahrung: EWMA und Perzentil

Vergangene Dauern eines Termins, älteste zuerst:

- Mittel: exponentiell gewichtetes Mittel, α = 0,3. Der neueste Wert zählt 30 Prozent, der Rest bleibt im bisherigen Mittel.
- Puffer: das 85. Perzentil derselben Liste, linear interpoliert (Typ 7). Liegt es über dem Mittel, ist die geplante Dauer das Perzentil, sonst das Mittel.

So zieht ein einzelner langer Weg den Plan nach oben, ohne dass ein einzelner kurzer Weg ihn wieder klein macht.

Die ersten Fahrten ersetzen das Tempo nicht sofort. Mit n Proben und einer Rampe von 4 gilt Gewicht n/4, höchstens 1. Vorher mischt sich das Tempo noch darunter. Ab der vierten Probe zählt nur noch der gelernte Wert. Dieselbe Mischung gilt fürs Fertigmachen, mit dem eingetragenen Standard als Basis.

## Abfahrt und Wecken

Abfahrt = Beginn − Puffer − Wegzeit. Wecken = Abfahrt − Fertigmachen.

„Pünktlich“ heißt: jetzt ist mehr als das knappe Fenster (5 Minuten) vor der Abfahrt, und die Ankunft bei sofortigem Losgehen liegt ebenso vor Beginn minus Puffer. „Knapp“ liegt in diesem Fenster. „Zu spät“ heißt, die Abfahrt ist vorbei. Der Puffer ist der geplante Vorsprung, nicht die Definition von Verspätung. Verspätet in der Statistik ist eine Ankunft nach dem Beginn.

Sobald die Weckzeit erreicht ist, werden Abfahrt und Wegzeit für diesen Tag eingefroren. Ein neuer Standort ändert den heutigen Plan nicht mehr.

## Geofence und Richtung

Im Zielradius (120 m, einstellbar ab morgen) gilt der Termin als erreicht, frühestens 15 Minuten vor dem Wecken. Vorher würde ein Ziel neben der Wohnung den Morgen schon in der Nacht beenden.

„Unterwegs“ braucht beides: die Entfernung zum Ziel ist um mindestens 25 m gesunken, und die Richtung der letzten Positionsänderung liegt höchstens 50 Grad neben der Richtung zum Ziel. Kleineres Zittern zählt nicht. Entfernen ist dasselbe mit umgekehrtem Vorzeichen und einem Winkel von mindestens 130 Grad.

„Noch am Ausgangsort“ ist der Wohnort, falls einer gesetzt ist (80 m). Sonst der erste Standort des Tages: die Lücke zum Ziel hat sich noch nicht um 25 m geschlossen.

Unterwegs wird die Erinnerung langsamer (alle 10 Minuten, leise), sie hört nicht auf. Sie hört auf, wenn der Radius erreicht ist oder ein zulässiger Grund pausiert.

## Eskalation

Ab dem Wecken, solange die Abfahrt noch nicht vorbei ist:

1. bis 20 Minuten: alle 10 Minuten, Stufe 1
2. bis 40 Minuten: alle 5 Minuten, Stufe 2
3. danach, oder sobald die Abfahrt vorbei ist: alle 2 Minuten, Stufe 3

Die native Warteschlange hält die nächsten 24 Zeitpunkte und wird neu geschrieben, wenn die App vorn ist, ein Schlummer gesetzt wird oder sich „unterwegs“ ändert. Schlummern verschiebt nur den Ton (5 Minuten, höchstens 3 mal) und die Abfahrt nicht.

## Fragen

Ein fester Baum, keine freien Sätze. Zuerst kommt „du entfernst dich“, dann „schon wieder geschlummert“, dann „noch am Ausgangsort nach der Abfahrt“, dann „kein Standort nach der Abfahrt“.

Pause nur bei krank, Homeoffice, frei, Termin verschoben, oder Standort unbekannt, wenn keiner da ist. „Keine Lust“ lässt die Erinnerung an. Fertigmachen und Suchen geben höchstens einen Schlummer.

## Woche

Pünktlichkeitsquote = pünktliche Ankünfte / (pünktlich + verspätet + verpasst). Pausen mit den Gründen oben fehlen in der Quote und erscheinen unter den Gründen. Die Durchschnittsverspätung ist der Mittelwert der verspäteten Ankünfte, sonst 0. Bei Gleichstand gewinnt der alphabetisch erste Grund.

Die Woche beginnt montags um 0:00 Uhr Ortszeit.

## Impulsschutz

Thema wechselt sofort. Der erste Wohnort auch, sonst kann „zu Hause“ nicht stimmen. Tempo, Faktoren, Intervalle, Schlummergrenze, Zielradius und ein späterer Wohnort gelten ab der nächsten lokalen Mitternacht. Eine laufende Verpflichtung lässt sich an dem Tag nicht bearbeiten oder einzeln löschen.
