# Agentische Auslegung auf jern-yao.de

Zeichnung, Skizze oder Maßbeschreibung einreichen und Fertigungskonzepte im Fachdialog entwickeln. Der Rechenkern prüft Zahlen und Maschinen; der Dienst liest zuerst den versionierten Konzeptstand. Die Seite `index.html` wird gebaut, nicht von Hand bearbeitet. Die bisherige technische Oberfläche bleibt in `archiv/konfigurator-v1.html` erhalten.

## Bauen

```
python3 quelle/katalog/specs_parse.py <Ordner mit den Katalog-PDFs>     # Kataloge von https://www.jernyao.com/files/
python3 quelle/katalog/daten_bauen.py <JernYao_Richtpreise_2026.csv>     # Preisliste aus dem Projektordner
python3 quelle/bauen.py                                                  # schreibt index.html
node quelle/test/faelle.js                                               # Referenzfälle und Prüffälle aus Stadienplänen
node quelle/test/fachliche-pruefung.cjs                                   # numerische Regressionen mit Assertions
node quelle/test/grenzen.cjs                                             # ungültige Geometrien / Laufzeitgrenzen
node quelle/test/ui-vertrag.cjs                                          # Formular und API-Vertrag
node --test quelle/ki-gutachter/test/*.test.js                            # Dienste mit kontrollierten Testantworten
python3 quelle/test/test_wissen.py                                       # private Fundstellen aus Laufzeitprojektion entfernen
```

## Dateien

- `engine.js`: Rechenkern. Stadienfolge, Kräfte, Werkzeuggrößen, Maschinenprüfung. Jede Regel trägt eine Kennung; die Fundstellen stehen in `regeln.md` im Projektordner JernYao_Konfigurator.
- `ui.js`, `vorlage.html`: Oberfläche.
- `maschinen.json`: 329 Katalogmodelle mit Richtpreis und Spanne, dazu Schlittenhub, Motor, Gewicht und bei Teile- und Mutternpressen das Produktmaß ψ. Nur Katalogdaten und Richtpreise, keine Angebote. Der Leser `specs_parse.py` nimmt die Zellen aus den Tabellenlinien der PDFs; verbundene Zellen gelten für alle Modelle darunter. Gegenprobe: alle 329 Modelle stimmen mit dem Modellkonfigurator der Sammlung «Literatur» überein.
- `site-config.js`: öffentliche Dienstadresse `window.JY_API_BASE`. Leer lassen, bis Dienst und echter Übertragungsweg geprüft sind; die Oberfläche zeigt dann ausdrücklich den Einrichtungsstand und einen Mailkontakt.
- `ki-gutachter/`: tatsächlicher Cloudflare-Dienst für Upload, Queue, KI-Tool-Loop, Status, Fachchat und unabhängige Eingangsbenachrichtigung an Hans; Einrichtung in dessen `LIESMICH.md`.
- `wissen/`: Snapshot und Rücklauf. Private Quelldateien bleiben außerhalb dieses öffentlichen Repos; `wissen/LIESMICH.md` beschreibt den versionierten Weg.
- `test/agentische-prueffaelle.json`: vorbereitete Testszenarien für echte Modellantworten. Ein bestandener Code-Test ersetzt diese Modellprüfung nicht.

## Veröffentlichung

Die Domain ist bereits GitHub Pages zugeordnet. Der Dienst läuft separat; ein Umzug der Domain ist für diese Architektur nicht notwendig. Zuerst den Dienst einschließlich Secrets, privatem Speicher, Löschregeln, Wissenssnapshot und Versand einrichten. Dann echte Testanfrage und Fachchat prüfen, die bestätigte API-Basis in `site-config.js` eintragen, neu bauen und den geprüften Stand veröffentlichen. Die API-Basis enthält keine Zugangsschlüssel.

Der aktuelle Entwicklungsstand ist ohne aktive Konten getestet und noch nicht als vollständiger Livebetrieb freigegeben. Alte Version und neuer Entwurf werden getrennt gesichert.
