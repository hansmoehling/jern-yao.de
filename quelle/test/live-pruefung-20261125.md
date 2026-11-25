# Live-Prüfung am 25.11.2026

Manuelle Prüfung der tatsächlich ausgelieferten Oberfläche und des echten Modells Claude Opus 5.5. Verwendet wurden ausschließlich eigens erstellte neutrale Testdaten. Die vorbereitete Datei `agentische-prueffaelle.json` bleibt eine Testvorlage; dieses Protokoll dokumentiert die davon getrennten Live-Läufe.

## Zeichnung und Versand

Die PDF `TEST-FB-001_Flanschbolzen_C10C.pdf` zeigt C10C, Draht Ø8 mm, Kopf Ø13 × 5 mm und Schaft Ø8 × 30 mm. Der Auftragstext enthält diese Zahlen nicht. Die unabhängige Referenz ist π/4 × (8² × 30 + 13² × 5) = 2171,625921794 mm³; daraus folgt ein idealer Abschnitt Ø8 × 43,203125 mm ohne Zuschläge.

Die englische Auswertung las alle genannten Maße und den Werkstoff von Seite 1 und gab Ø8 × 43,203 mm aus. Die fünf ausgegebenen Katalogkandidaten waren JBF-13B2S, JBF-13B2SL, JBF-17B2S, JBF-13B3S und JBF-17B2SL. Jeder Kandidat erhielt die berechnete einstufige Kopfoperation und seine verbleibenden Reservestationen. Näherungsmodell, nicht belegter Lieferzustand, Zwischenformen und Transfer blieben ausdrücklich erkennbar. Eine anschließende englische Dialogfrage griff auf dieselbe Originalzeichnung zu und nannte wieder C10C, Draht Ø8 mm und Kopf Ø13 × 5 mm.

Der Eingang wurde gespeichert. Der unabhängige Mailweg führte den Original-PDF-Anhang mit; der Anbieter zeigte ein Zustellereignis an das konfigurierte Hans-Postfach. Die Statusanzeige der Website meldete die erfolgte Benachrichtigung. Das prüft Zustellung zum Mailserver, nicht das Öffnen oder Lesen durch den Empfänger.

## Sechs fachliche Grenzfälle

| Fall | Beobachtetes Ergebnis |
|---|---|
| AG-QA-01, Nullwand | Außen-Ø und Innen-Ø je 10 mm als widersprüchlich erkannt; keine Berechnung oder Maschine, gezielte Rückfragen zu Durchmessern, Boden und Werkstoff. |
| AG-QA-02, Einheiten | 0,012 m → 12 mm; 0,04 m → 40 mm; 0,018 kg → 18 g; 430 MPa → 430 N/mm². 500 kN mit Faktor 9,80665 als etwa 51,0 tf ausgegeben. Bedeutung der Versuchskraft und Geometrie blieben offen. |
| AG-QA-03, Gesamtlast | 45 % höchste Einzelstation, 135 % Summe der drei Einzelspitzen; tatsächlich gleichzeitig wirkende Last ohne Kraftverläufe offen. Keine pauschale Eignungsbestätigung. |
| AG-QA-04, Zwischenform | 95-mm-Zwischenform gegenüber 64,7-mm-Abschnitt berücksichtigt. KO/PKO nicht pauschal auf 95 mm gesetzt; Einstecktiefen, Greifer und Wenden nachgefragt. |
| AG-QA-05, Lagetoleranz | 0,05 mm nicht als generelles Verbot behandelt. 0,03 mm weder pauschal abgelehnt noch garantiert; Bezug/Messverfahren und Kalibrieren/Nacharbeit angesprochen. |
| AG-QA-06, Werkstoff/Stufen | C35 nicht durch C10C ersetzt; C35EC-Zuordnung ausdrücklich nachgefragt. Fertigteilklasse 8.8 vom Drahtzustand getrennt. Vier benötigte Stufen nicht durch Stationsvorgabe eins verkürzt. |

AG-QA-02 und AG-QA-03 wurden nach Präzisierung der Antwortvorgaben wiederholt. Zuvor fehlten beim Einheitenfall die tf-Angabe und bei einem Lastfall die direkte konzeptionelle Antwort. Der abschließende Lauf zeigte die oben protokollierten Ergebnisse.

## Oberfläche und Rechenkern

- Startseite und Archiv in Deutsch, Italienisch, Slowenisch, Englisch und vereinfachtem Chinesisch im Browser geprüft.
- Innenantriebe Torx, Innensechskant, PH und PZ mit Größenlisten; ausgewähltes Profil und Tiefe erscheinen im Ergebnis und in den Maschinenkonzepten. Ohne belegtes Vertiefungsvolumen bleiben bei Torx/PH/PZ Abschnitt und Profilkraft offen. Kein Null-Kraft-Ersatzwert.
- 79 JavaScript-Tests, 25 deterministische Fachprüfungen, drei Wissensprojektionstests, Werkstoff-, Geometriegrenzen- und UI-Vertragsprüfungen bestanden.

Die Prüfungen belegen die genannten Testfälle. Sie sind kein gemessener Prozessfähigkeitsnachweis und keine Validierung einer neuen Werkstoff-Fließkurve.
