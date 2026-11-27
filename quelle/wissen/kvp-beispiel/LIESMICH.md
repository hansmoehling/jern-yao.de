# KVP-Import: Spaltenvorlage für Hans

Die beiden CSV-Dateien enthalten genau zwei **frei erfundene Formatbeispiele**. Maße, Stadien und Modellzuordnungen belegen keinen Fertigungsfall. Es gibt keine vorgetäuschten Messwerte. Beide Beispiele bleiben `synthetic:true`, `nur_konzept`, `freigegeben:false` und `knowledgeEligible:false` und werden vom Lernmodul ausgeschlossen – auch bei versehentlich gesetzter Freigabe.

Die echten, anonymisierten CSV-Dateien und Importergebnisse gehören in Sandras privaten Projektordner. Das öffentliche Repo enthält nur Code, Tests und diese ausdrücklich synthetischen Vorlagen. Kunden, Zeichnungen, Artikelnummern, Personen, Kontaktdaten, Auftragswerte und Freitext gehören nicht in diese CSVs. `F-0001` usw. sind neu zu vergebende anonyme Fallnummern; eine private Zuordnung bleibt separat.

## Ablauf

1. Pro Fertigungsfall eine Zeile in `faelle.csv`, pro Station eine Zeile in `stadien.csv`. Beide Dateien verwenden dieselbe Fallnummer. Für echte Fälle `synthetisch=nein`, eine `F-`-Nummer und die tatsächliche Ergebnis-/Quellenart einsetzen. Keine Freigabespalten hinzufügen.
2. UTF-8, Semikolon als Spaltentrenner; Dezimalpunkt und Dezimalkomma werden akzeptiert. Leere Zahlen bleiben unbekannt, null wird nicht daraus gemacht. Gemessene und gerechnete Kräfte stehen getrennt in **kN**. Werte in Tonnen vorab fachlich umrechnen; nicht ungeprüft einsetzen.
3. Importprogramm aufrufen. Es liest nur die beiden Dateien, schreibt den Entwurf nach stdout und lädt nichts hoch:

```text
node quelle/wissen/import_kvp.mjs <faelle.csv> <stadien.csv> kvp-start-v1
```

4. Hans prüft Geometrie, Operationsfolge, Ergebnis, Maschinenzuordnung und Einheiten am Original. Erst ein gesondert geprüfter echter Fall darf `knowledgeEligible:true`, `freigegeben:true` und `freigabe:{von:"Hans",am:"YYYY-MM-DD"}` erhalten. Dasselbe gilt für das Manifest. Eine Fallfreigabe ist keine automatische Freigabe neuer Regelgrenzen oder Gewichte. Das Importprogramm bietet keine Freigabeoption.
5. Einspielen des geprüften privaten Manifests, Rückrechnung und Veröffentlichung sind eigene Schritte. Synthetische Beispieldaten werden dafür nicht umetikettiert. Aus ihnen werden keine Erfahrungsgrenzen gelernt.

## Pflichtspalten der Fälle

| Spalte | Inhalt |
|---|---|
| `fall_id` | Echte Fälle: `F-` und 4–8 Ziffern. Beispiele: `SYN-` und 4–8 Ziffern. |
| `synthetisch` | Genau `ja` oder `nein`. |
| `klasse` | `schraube`, `niet`, `bolzen`, `mutter`, `formteil`. |
| `topologie` | `kopf-schaft`, `kopf-schaft-napf`, `stufenkoerper`, `huelse`, `ring`, `mutter-durchgang`, `mutter-sackloch`, `massiv`, `unbekannt`. |
| `werkstoffgruppe` | `unlegiert-weich`, `borstahl`, `legiert-weich`, `rostfrei`, `kupfer`, `messing`, `aluminium`, `unbekannt`. |
| `draht_mm`, `abschnitt_mm` | Tatsächlicher Abschnitt Ø und Länge in mm; daraus berechnet sich `L0_d0`. |
| `ergebnis` | `laeuft`, `laeuft_mit_muehe`, `nicht_machbar`, `nur_konzept`. Fehlgeschlagene Fälle sind ausdrücklich erwünscht. |
| `quelle_art` | `stadienplan`, `tkg-aggregat`, `drahtzeugnis`, `jern-yao-referenz`, `kunden-ergebnis`, `expertenfeedback`, `fachchat`; Beispiele ausschließlich `synthetisch`. |

Weitere Fallspalten sind optional: Rm in N/mm², geometrische Verhältnisse (Anteile 0–1), Stempelpressung in N/mm², exakte Katalog-Modellbezeichnung, ursprünglich geplante Stadienzahl, gemessene Hubzahl in min⁻¹. Für Plan-/Ist-Ausbringung müssen beide Zahlen und die gemeinsame Einheit (`strokes-per-minute` oder `pieces-per-minute`) gemeinsam angegeben werden. Ohne gemessene Ausbringung bleibt die Gruppe leer.

## Stationsdatei

`fall_id`, `station` und `operation` sind Pflicht. Die Stationsnummern beginnen bei 1 und sind lückenlos; kombinierte Operationen stehen in einer Zelle, getrennt durch Komma. Zulässig sind die Operationsnamen aus `src/kvp.js`, etwa `Abscheren, Planstauchen`, `Vorstauchen Kopf`, `Fertigstauchen`, `Reduzieren`, `Vorwärtsfließpressen`, `Rückwärtsfließpressen`, `Napf vertiefen`, `Butzen auslochen`, `Kalibrieren`, `Beschnitt`, `Antrieb prägen`.

Die optionalen Kennzahlen tragen Verhältniswerte, Stempelpressung in N/mm² sowie getrennte Rechen- und Messkraft in kN. Bei unbekannten Werten bleibt die Zelle leer. Das Programm lehnt doppelte Fälle/Stationen, fehlende Stationen, unbekannte Modelle, nicht zugeordnete Stationen, unzulässige Spalten oder uneindeutige Zahlen ab. Fehlerausgaben enthalten keine Zellinhalte.

`manifest.json` ist das reproduzierbare Ergebnis der beiden Beispieldateien mit Version `kvp-beispiel-v1`.
