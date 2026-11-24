# Konfigurator jern-yao.de

Testfeld für die Maschinenwahl mit Grobauslegung und Richtpreis 2026. Die Seite `index.html` im Wurzelordner wird gebaut, nicht von Hand bearbeitet.

## Bauen

```
python3 quelle/katalog/specs_parse.py <Ordner mit den Katalog-PDFs>     # Kataloge von https://www.jernyao.com/files/
python3 quelle/katalog/daten_bauen.py <JernYao_Richtpreise_2026.csv>     # Preisliste aus dem Projektordner
python3 quelle/bauen.py                                                  # schreibt index.html
node quelle/test/faelle.js                                               # Referenzfälle
```

## Dateien

- `engine.js`: Rechenkern. Stadienfolge, Kräfte, Werkzeuggrößen, Maschinenprüfung. Jede Regel trägt eine Kennung; die Fundstellen stehen in `regeln.md` im Projektordner JernYao_Konfigurator.
- `ui.js`, `vorlage.html`: Oberfläche.
- `maschinen.json`: 329 Katalogmodelle mit Richtpreis und Spanne. Nur Katalogdaten und Richtpreise, keine Angebote.
- `ENDPOINT` in `ui.js`: leer, solange kein Empfangsdienst läuft. Dann öffnet die Anfrage das E-Mail-Programm.
