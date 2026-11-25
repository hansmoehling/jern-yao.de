# Innenantriebe und Inbetriebnahme der agentischen Auslegung

Technische Ergänzung für Konzept / Wissen · 25. November 2026

## Innenantriebe im Manual

Die Auswahl besteht aus Profil, Größe und Tiefe. Angeboten werden Torx T5, T6, T7, T8, T9, T10, T15, T20, T25, T27, T30, T40, T45, T50, T55 und T60; Innensechskant SW 1,5 bis 12 mm in den hinterlegten üblichen Abstufungen sowie eine freie Schlüsselweite; Phillips PH0 bis PH4 und Pozidriv PZ0 bis PZ4. Phillips und Pozidriv bleiben getrennte Profile. Die Größenlisten sind durch Werkzeug-Herstellerangaben belegt, keine vollständigen Prägestempelzeichnungen.

Die Auswahl erscheint in den Kennzahlen, der qualitativen Stadienfolge für jeden Maschinenkandidaten, im Druckblatt und in der Anfrage-E-Mail. Deutsch, Italienisch, Slowenisch, Englisch und vereinfachtes Chinesisch wurden für diesen Ablauf im Browser geprüft. Der Profil- oder Größenwechsel verwirft ein zuvor eingetragenes CAD-Volumen, damit kein Wert der vorherigen Vertiefung weitergerechnet wird.

## Rechenmodell und konkrete Grenzen

- **Innensechskant:** Die geometrische Näherung verwendet eine prismatische Sechskantfläche mit der eingegebenen Schlüsselweite und Tiefe. Eckenradien, Einlauf und Bodenform sind damit nicht einzeln modelliert. Die vorhandene Kraftnäherung bleibt als solche gekennzeichnet.
- **Torx, PH und PZ:** Die Profilnummer wird nicht als Millimetermaß oder Sechskantfläche verwendet. Ohne tatsächliches Vertiefungsvolumen oder verwertbare Teilmasse bleiben Teilvolumen und Abschnittlänge offen. Die qualitative Operation und ihre Lage am Teil bleiben sichtbar.
- **Volumen aus Zeichnung / CAD:** Ein optionales Vertiefungsvolumen erlaubt die Volumenbilanz. Eine angegebene Teilmasse erlaubt die Abschnittsrechnung bei belegter Dichte. Beides ersetzt keine profilabhängige Kraftrechnung. Für Torx und Kreuzschlitz bleibt die Antriebsformkraft deshalb offen; die höchste Stationskraft und die gesamte Last dürfen nicht aus den übrigen Teilkräften als vollständig ausgegeben werden.
- **Restwand und Restboden:** Positive Restgeometrie ist erforderlich. Für Innensechskant wird die Umhüllung der Ecken gegenüber Kopf beziehungsweise Schaft geprüft; reicht der Antrieb in den Schaft, wird diese Lage ausgewiesen. Bei Torx und Kreuzschlitz müssen Kontur, lokale Restwand und Stempelkonzept anhand der Zeichnung bestimmt werden. Ein gleichzeitig eingegebener Napf erfordert zunächst die Klärung von Lage und Überlappung, damit Hohlraumvolumen nicht doppelt abgezogen wird.
- **Maschinenzuordnung:** Eine zusätzliche Maschinenstation bleibt Reserve, solange ihr keine konkrete Operation zugewiesen wurde. Ein größeres Stationsangebot erzeugt keine erfundenen Zwischenformen. Fehlende Fließkurven oder Profilkräfte erscheinen als offene Größen, nicht als Nullkraft.

Die automatisierten Prüfungen decken unter anderem Profilwechsel, getrennte PH-/PZ-Kennungen, Rückwärtskompatibilität des bisherigen Innensechskants, offene Volumen-/Kraftwerte, Massevorgaben, Restgeometrie sowie Übersetzung und Übernahme in Druck und E-Mail ab. Sie belegen das implementierte Verhalten, nicht die Serienprozessfähigkeit eines beliebigen Teils.

## Kontrollierter Test des echten Anfragewegs

Eine eigens erstellte, neutrale PDF-Zeichnung wurde über den tatsächlichen Upload verarbeitet. Angegeben waren C10C, Kopf Ø13 × 5 mm, Schaft Ø8 × 30 mm unter Kopf und Draht Ø8 mm. Der Assistent las diese Maße aus der Zeichnung. Die unabhängige Volumenrechnung lautet:

`V = π/4 × (13² × 5 + 8² × 30) = 2.171,6259 mm³`

`L₀ = V / (π/4 × 8²) = 43,203125 mm`

Die ausgegebene Abschnittsabmessung **Ø8 × 43,203 mm** stimmt damit überein. Dieser Vergleich gilt für die dargestellte idealisierte Geometrie ohne zusätzliche Schnitt-, Radius- oder Fertigungszugaben. Die Auswertung zeigte fünf reale Katalogkandidaten mit zugeordneter Basisfolge aus einer Kopf-Umformstufe und jeweils ausgewiesenen freien Stationen. Das bestätigt die durchgängige Zeichnungs-, Rechen- und Zuordnungskette für diesen Testfall; es validiert keine neuen C10C-Fließdaten und ersetzt keine Werkzeug- oder Transferprüfung.

Die parallel erzeugte Eingangs-Mail enthielt den Originalanhang. Der Versanddienst bestätigte ihre Zustellung. Der Mailauftrag und die technische Analyse werden unabhängig verarbeitet. Diese Inbetriebnahmeprüfung erfolgte am verbundenen Vorschau-Dienst; die Veröffentlichung und Prüfung der Hauptdomain ist ein eigener Schritt.

Weitere fachliche Grenzfälle mit echten Modellantworten werden in gesonderten Liveprotokollen beurteilt. Das Durchlaufen deterministischer Rechenkern- und Oberflächentests wird nicht als bestandene Modellprüfung ausgegeben.

## Quellen und Pflege

- [Wera 867/1 TZ – Torx-Größen](https://www.wera.de/de/werkzeuge/867-1-tz-torx-bits)
- [Wera 967 PKL – größere Torx-Größen, Herstellerdatenblatt](https://hybris-media.wera.de/download/pdfgenerator-datasheets/en/05024202001.pdf)
- [Wera 950 PKL – metrische Innensechskantgrößen](https://www.wera.de/de/werkzeuge/950-pkl-winkelschluessel-metrisch-gestellverchromt)
- [Wera 851/1 Z – Phillips](https://www.wera.de/de/werkzeuge/851-1-z-bits)
- [Wera 855/1 Z – Pozidriv](https://www.wera.de/de/werkzeuge/855-1-z-bits)

Eine Erweiterung um genaue Profilvolumina oder Formkraftmodelle benötigt eine eindeutig bezeichnete Profilgeometrie, Tiefe, Restgeometrie und einen dokumentierten Werkstoff-/Prozessbereich. Eine veröffentlichte Werkzeuggröße allein liefert diese Daten nicht. Neue Belege werden im Wissenseingang geprüft und erst anschließend in den freigegebenen Konzeptstand übernommen.
