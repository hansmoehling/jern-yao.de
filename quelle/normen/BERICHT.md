# Normbibliothek – automatisch erzeugter Abdeckungsbericht

Erzeugt mit `node quelle/normen/report.cjs` aus den Familien-JSON-Dateien, dem Gewindedatensatz und dem Maschinenkatalog. `bauen.py` aktualisiert diesen Bericht automatisch. Manuelle Änderungen werden überschrieben.

Datensatzversionen laut Dateien: 2026-11-26, 2026-11-26.1. Dies ist kein neues fachliches Prüfdatum.

Der Bericht zählt vorhandene Daten und deren gespeicherten Prüfstatus. Er bestätigt weder die Vollständigkeit einer Norm noch die Aktualität ihrer Ausgabe oder die Machbarkeit eines Bauteils.

## Datenbestand

| Merkmal | Anzahl |
|---|---:|
| Familienreferenzen | 100 |
| Familien mit direkten Größenzeilen | 96 |
| Direkte Größen-/Steigungszeilen | 1100 |
| Definierte Varianten | 28 |
| Zusätzliche Varianten-Größenzeilen | 114 |
| Größen-/Variantenzeilen mit mindestens einer Längenzelle | 112 |
| Gespeicherte Längenzellen | 1246 |
| Familien mit mindestens einer Längenzelle | 15 |
| Längenrelevante Produktfamilien ohne Längenzelle | 55 von 70 |
| Ausgabe angegeben | 73 |
| Katalogausgabe nicht zugeordnet | 13 |
| Ausgabe fehlt | 14 |

Direkte Größen und Variantengrößen werden getrennt gezählt. Varianten ohne eigene Größenzeilen erzeugen keine zusätzlichen Größen. Eine Längenzelle ist ein vorhandener Eintrag in `nachLaenge`, unabhängig von seinem Quellenstatus; eine globale Kataloglängenliste ist keine nachgewiesene Matrix je Größe. Muttern, reine Durchmesserreihen und ungültige Verweise zählen nicht als längenrelevante Produktfamilien.

## Quellenstatus

| Gespeicherter Maß-/Metadatensatz | Anzahl |
|---|---:|
| Als bestätigt markiert, mindestens zwei verschiedene auflösbare Quelldokumente | 2381 |
| Nur ein auflösbares Quelldokument | 11530 |
| Ungeprüft oder nicht ausreichend zugeordnet | 94 |
| Fehlend oder ausdrücklich offen | 1045 |
| Widersprüchlich | 73 |
| Summe der Maß-/Metadatensätze | 15123 |

Zusätzliche Diagnose: 798 Datensätze ohne auflösbares Maßdokument; 0 nicht auflösbare Quellenreferenzen; 0 weitere Referenzen auf dasselbe Dokument; 92 Referenzen auf reine Status-/Änderungsseiten. Diese Diagnosezahlen überschneiden sich mit der Tabelle.

Gezählt werden Datensätze mit `sourceRefs` und Prüfstatus; derselbe Zahlenwert kann an mehreren Datenstellen vorkommen. `quellen` und `sourceMeta` werden zusammen ausgewertet. Gleiche Dokument-URLs zählen einmal. Verschiedene Domains oder Quellen-IDs beweisen keine Unabhängigkeit: „bestätigt“ übernimmt nur die bereits hinterlegte Bewertung und setzt mindestens zwei auflösbare Maßdokumente voraus. Reine Normstatusseiten bestätigen keine Maßzahl. Eine angegebene Ausgabe ist nicht automatisch verifiziert.

## Familien und Längen

| Familie | Datenedition | Direkte Größen | Variantengrößen | Varianten | Größen mit Längen | Längenzellen | Offene Größenmetadaten |
|---|---|---:|---:|---:|---:|---:|---:|
| DIN124 | 2011-03 | 12 | 0 | 0 | 0 | 0 | 0 |
| DIN1587 | Katalogausgabe offen | 13 | 0 | 0 | 0 | 0 | 0 |
| DIN302 | 2011-03 | 12 | 0 | 0 | 0 | 0 | 0 |
| DIN439 | Katalogausgabe offen | 33 | 0 | 0 | 0 | 0 | 0 |
| DIN557 | Katalogausgabe offen | 6 | 0 | 0 | 0 | 0 | 0 |
| DIN562 | Katalogausgabe offen | 4 | 0 | 0 | 0 | 0 | 0 |
| DIN603 | Katalogausgabe offen | 7 | 0 | 0 | 0 | 0 | 11 |
| DIN660 | 2012-01 | 13 | 0 | 0 | 1 | 1 | 0 |
| DIN661 | 2011-03 | 13 | 0 | 0 | 0 | 0 | 0 |
| DIN662 | 2011-03 | 8 | 0 | 0 | 0 | 0 | 0 |
| DIN674 | 2011-03 | 9 | 0 | 0 | 0 | 0 | 0 |
| DIN6791 | 2012-05 | 10 | 0 | 0 | 1 | 1 | 0 |
| DIN6792 | 2012-05 | 10 | 0 | 0 | 0 | 0 | 0 |
| DIN6921 | offen | 7 | 0 | 0 | 0 | 0 | 11 |
| DIN6923 | 1983 | 8 | 0 | 0 | 0 | 0 | 0 |
| DIN6924 | 1987 | 13 | 0 | 0 | 0 | 0 | 0 |
| DIN6926 | 1983 | 8 | 0 | 0 | 0 | 0 | 0 |
| DIN6927 | Katalogausgabe offen | 15 | 0 | 0 | 0 | 0 | 0 |
| DIN7338 | 2011-03 | 0 | 24 | 4 | 1 | 2 | 0 |
| DIN7500 | offen | 0 | 8 | 2 | 8 | 44 | 5 |
| DIN7984 | 2022-03 | 8 | 0 | 0 | 0 | 0 | 10 |
| DIN835 | offen | 13 | 0 | 0 | 0 | 0 | 0 |
| DIN928 | Katalogausgabe offen | 5 | 0 | 0 | 0 | 0 | 0 |
| DIN929 | Katalogausgabe offen | 6 | 0 | 0 | 0 | 0 | 0 |
| DIN931 | offen | 14 | 0 | 0 | 0 | 0 | 4 |
| DIN933 | offen | 16 | 0 | 0 | 0 | 0 | 2 |
| DIN934 | Katalogausgabe offen | 32 | 0 | 0 | 0 | 0 | 0 |
| DIN936 | Katalogausgabe offen | 11 | 0 | 0 | 0 | 0 | 0 |
| DIN938 | 2025-08 | 20 | 0 | 0 | 0 | 0 | 1 |
| DIN939 | 1995-02 | 19 | 0 | 0 | 0 | 0 | 2 |
| DIN940 | 2010-07 | 13 | 0 | 0 | 0 | 0 | 0 |
| DIN960 | 1990-01 | 12 | 0 | 0 | 0 | 0 | 6 |
| DIN961 | 1990-01 | 12 | 0 | 0 | 12 | 353 | 6 |
| DIN980 | Katalogausgabe offen | 30 | 0 | 0 | 0 | 0 | 0 |
| DIN985 | Katalogausgabe offen | 14 | 0 | 0 | 0 | 0 | 0 |
| EN1662 | offen | 7 | 0 | 0 | 0 | 0 | 11 |
| EN1665 | offen | 8 | 0 | 0 | 0 | 0 | 10 |
| ISO1051 | 1999 | 25 | 0 | 0 | 0 | 0 | 0 |
| ISO10511 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO10512 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO10513 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO10642 | 1997 | 10 | 0 | 0 | 0 | 0 | 8 |
| ISO10663 | 2012 | 8 | 0 | 0 | 0 | 0 | 0 |
| ISO13918 | 2017+AMD1:2021 | 0 | 82 | 14 | 11 | 66 | 0 |
| ISO14579 | 2001 | 13 | 0 | 0 | 0 | 0 | 7 |
| ISO14580 | 2011 | 7 | 0 | 0 | 0 | 0 | 1 |
| ISO14581 | 2013 | 7 | 0 | 0 | 7 | 86 | 1 |
| ISO14583 | offen | 6 | 0 | 0 | 0 | 0 | 12 |
| ISO14584 | 2001 | 7 | 0 | 0 | 0 | 0 | 11 |
| ISO15071 | 2011 | 7 | 0 | 0 | 0 | 0 | 1 |
| ISO15072 | 2012 | 7 | 0 | 0 | 7 | 104 | 0 |
| ISO1580 | 2011 | 7 | 0 | 0 | 0 | 0 | 1 |
| ISO2009 | 2011 | 7 | 0 | 0 | 0 | 0 | 1 |
| ISO2338 | 1997 | 19 | 0 | 0 | 0 | 0 | 0 |
| ISO2340 | 1986 | 15 | 0 | 0 | 0 | 0 | 0 |
| ISO2341 | 1986 | 18 | 0 | 2 | 0 | 0 | 0 |
| ISO4014 | 2022 | 15 | 0 | 0 | 0 | 0 | 3 |
| ISO4017 | 2022 | 17 | 0 | 0 | 17 | 232 | 1 |
| ISO4026 | offen | 13 | 0 | 0 | 0 | 0 | 5 |
| ISO4027 | offen | 13 | 0 | 0 | 0 | 0 | 5 |
| ISO4028 | offen | 7 | 0 | 0 | 0 | 0 | 11 |
| ISO4029 | offen | 13 | 0 | 0 | 0 | 0 | 5 |
| ISO4032 | 2023 | 14 | 0 | 0 | 0 | 0 | 0 |
| ISO4033 | 2023 | 14 | 0 | 0 | 0 | 0 | 0 |
| ISO4035 | 2023 | 14 | 0 | 0 | 0 | 0 | 0 |
| ISO4161 | 2012 | 8 | 0 | 0 | 0 | 0 | 0 |
| ISO4162 | 1990 | 7 | 0 | 0 | 0 | 0 | 11 |
| ISO4762 | 2004 | 13 | 0 | 0 | 7 | 70 | 6 |
| ISO4766 | 2024 | 12 | 0 | 0 | 0 | 0 | 1 |
| ISO7040 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO7042 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO7045 | 2011 | 6 | 0 | 0 | 0 | 0 | 12 |
| ISO7046 | 2011 | 7 | 0 | 0 | 0 | 0 | 11 |
| ISO7049 | 2011 | 9 | 0 | 0 | 9 | 57 | 0 |
| ISO7050 | 2011 | 9 | 0 | 0 | 9 | 56 | 0 |
| ISO7051 | 2011 | 9 | 0 | 0 | 9 | 56 | 0 |
| ISO7379 | 1983 | 7 | 0 | 0 | 4 | 39 | 9 |
| ISO7380-1 | 2022 | 8 | 0 | 0 | 0 | 0 | 10 |
| ISO7380-2 | offen | 8 | 0 | 0 | 0 | 0 | 10 |
| ISO7434 | Katalogausgabe offen | 7 | 0 | 0 | 0 | 0 | 2 |
| ISO7435 | 2024 | 11 | 0 | 0 | 0 | 0 | 1 |
| ISO7436 | 2024 | 11 | 0 | 0 | 0 | 0 | 1 |
| ISO7719 | 2012 | 12 | 0 | 0 | 0 | 0 | 0 |
| ISO7984 | offen | 0 | 0 | 0 | 0 | 0 | 0 |
| ISO8673 | 2023 | 16 | 0 | 0 | 0 | 0 | 0 |
| ISO8674 | 2023 | 16 | 0 | 0 | 0 | 0 | 0 |
| ISO8675 | 2023 | 16 | 0 | 0 | 0 | 0 | 0 |
| ISO8676 | 2022 | 12 | 0 | 0 | 0 | 0 | 0 |
| ISO8677 | 1986 | 7 | 0 | 0 | 0 | 0 | 11 |
| ISO8734 | 1997 | 13 | 0 | 0 | 0 | 0 | 0 |
| ISO8735 | 1997 | 9 | 0 | 2 | 0 | 0 | 0 |
| ISO8740 | 1997 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO8741 | 1997 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO8742 | 1997 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO8743 | 1997 | 13 | 0 | 0 | 0 | 0 | 0 |
| ISO8744 | 1997 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO8745 | 1997 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO8746 | 1997 | 8 | 0 | 2 | 0 | 0 | 0 |
| ISO8747 | 1997 | 13 | 0 | 2 | 0 | 0 | 0 |
| ISO8765 | 2022 | 9 | 0 | 0 | 9 | 79 | 9 |

„Offene Größenmetadaten“ zählt ausdrücklich ungeprüfte oder anderweitig offene Einträge in `sizeCoverage`. Null bedeutet nicht, dass alle möglichen Größen erfasst sind. Als „nicht in der Norm vorgesehen“ markierte Größen bleiben von Recherchelücken getrennt.

## Quellenstatus je Familie

| Familie | Bestätigt mit ≥2 Dokumenten | Einquelle | Ungeprüft | Fehlend/offen | Konflikt | Nicht vorgesehene Größen laut Metadaten |
|---|---:|---:|---:|---:|---:|---:|
| DIN124 | 48 | 36 | 1 | 1 | 0 | 0 |
| DIN1587 | 0 | 78 | 0 | 39 | 0 | 0 |
| DIN302 | 48 | 36 | 1 | 1 | 0 | 0 |
| DIN439 | 0 | 165 | 0 | 0 | 0 | 0 |
| DIN557 | 0 | 30 | 0 | 0 | 0 | 0 |
| DIN562 | 0 | 20 | 0 | 0 | 0 | 0 |
| DIN603 | 74 | 28 | 1 | 2 | 1 | 0 |
| DIN660 | 57 | 36 | 1 | 0 | 0 | 0 |
| DIN661 | 18 | 100 | 1 | 13 | 0 | 0 |
| DIN662 | 25 | 64 | 1 | 0 | 0 | 0 |
| DIN674 | 36 | 10 | 1 | 0 | 9 | 0 |
| DIN6791 | 59 | 52 | 1 | 0 | 1 | 0 |
| DIN6792 | 40 | 31 | 1 | 10 | 10 | 0 |
| DIN6921 | 20 | 8 | 0 | 7 | 0 | 0 |
| DIN6923 | 20 | 68 | 0 | 0 | 0 | 0 |
| DIN6924 | 56 | 44 | 0 | 42 | 2 | 0 |
| DIN6926 | 24 | 56 | 0 | 24 | 0 | 0 |
| DIN6927 | 0 | 135 | 0 | 15 | 0 | 0 |
| DIN7338 | 90 | 55 | 1 | 1 | 1 | 0 |
| DIN7500 | 0 | 84 | 15 | 28 | 0 | 9 |
| DIN7984 | 8 | 48 | 0 | 0 | 0 | 0 |
| DIN835 | 16 | 49 | 6 | 52 | 0 | 5 |
| DIN928 | 0 | 25 | 0 | 20 | 0 | 0 |
| DIN929 | 0 | 30 | 0 | 24 | 0 | 0 |
| DIN931 | 56 | 70 | 0 | 0 | 0 | 0 |
| DIN933 | 0 | 32 | 0 | 0 | 0 | 0 |
| DIN934 | 28 | 174 | 0 | 0 | 0 | 0 |
| DIN936 | 18 | 48 | 0 | 0 | 0 | 0 |
| DIN938 | 40 | 74 | 1 | 6 | 0 | 0 |
| DIN939 | 127 | 1 | 2 | 5 | 1 | 0 |
| DIN940 | 39 | 74 | 6 | 44 | 0 | 5 |
| DIN960 | 148 | 190 | 0 | 42 | 10 | 0 |
| DIN961 | 7 | 2336 | 0 | 15 | 1 | 0 |
| DIN980 | 71 | 136 | 0 | 30 | 3 | 0 |
| DIN985 | 0 | 70 | 0 | 42 | 0 | 0 |
| EN1662 | 0 | 28 | 0 | 7 | 0 | 0 |
| EN1665 | 40 | 32 | 0 | 16 | 0 | 0 |
| ISO1051 | 0 | 25 | 1 | 0 | 0 | 0 |
| ISO10511 | 20 | 57 | 0 | 30 | 3 | 0 |
| ISO10512 | 0 | 80 | 0 | 30 | 0 | 0 |
| ISO10513 | 0 | 70 | 0 | 10 | 0 | 0 |
| ISO10642 | 0 | 80 | 0 | 0 | 0 | 0 |
| ISO10663 | 0 | 112 | 0 | 0 | 0 | 0 |
| ISO13918 | 214 | 412 | 1 | 10 | 10 | 0 |
| ISO14579 | 0 | 130 | 0 | 0 | 0 | 0 |
| ISO14580 | 0 | 45 | 0 | 0 | 0 | 10 |
| ISO14581 | 9 | 134 | 11 | 18 | 0 | 10 |
| ISO14583 | 0 | 42 | 0 | 0 | 0 | 0 |
| ISO14584 | 0 | 35 | 0 | 0 | 0 | 0 |
| ISO15071 | 0 | 52 | 0 | 7 | 0 | 10 |
| ISO15072 | 0 | 498 | 14 | 42 | 0 | 13 |
| ISO1580 | 0 | 38 | 0 | 0 | 0 | 10 |
| ISO2009 | 0 | 38 | 0 | 0 | 0 | 10 |
| ISO2338 | 16 | 60 | 1 | 1 | 0 | 0 |
| ISO2340 | 0 | 60 | 1 | 1 | 0 | 0 |
| ISO2341 | 83 | 38 | 1 | 0 | 7 | 0 |
| ISO4014 | 60 | 126 | 0 | 9 | 0 | 0 |
| ISO4017 | 3 | 880 | 0 | 10 | 0 | 0 |
| ISO4026 | 0 | 104 | 0 | 0 | 0 | 0 |
| ISO4027 | 0 | 98 | 0 | 6 | 0 | 0 |
| ISO4028 | 0 | 35 | 0 | 0 | 0 | 0 |
| ISO4029 | 0 | 104 | 0 | 0 | 0 | 0 |
| ISO4032 | 54 | 114 | 0 | 0 | 0 | 0 |
| ISO4033 | 0 | 168 | 0 | 0 | 0 | 0 |
| ISO4035 | 39 | 101 | 0 | 0 | 0 | 0 |
| ISO4161 | 59 | 48 | 0 | 0 | 5 | 0 |
| ISO4162 | 34 | 28 | 0 | 15 | 0 | 0 |
| ISO4762 | 259 | 190 | 0 | 0 | 1 | 0 |
| ISO4766 | 0 | 129 | 0 | 24 | 0 | 9 |
| ISO7040 | 0 | 80 | 0 | 30 | 0 | 0 |
| ISO7042 | 0 | 70 | 0 | 10 | 0 | 0 |
| ISO7045 | 0 | 42 | 0 | 6 | 0 | 0 |
| ISO7046 | 0 | 28 | 0 | 7 | 0 | 0 |
| ISO7049 | 0 | 138 | 1 | 18 | 0 | 0 |
| ISO7050 | 0 | 137 | 1 | 27 | 0 | 0 |
| ISO7051 | 0 | 146 | 1 | 27 | 0 | 0 |
| ISO7379 | 143 | 171 | 2 | 0 | 3 | 2 |
| ISO7380-1 | 0 | 72 | 0 | 0 | 0 | 0 |
| ISO7380-2 | 0 | 24 | 0 | 16 | 0 | 0 |
| ISO7434 | 0 | 72 | 0 | 21 | 1 | 9 |
| ISO7435 | 0 | 119 | 0 | 66 | 0 | 9 |
| ISO7436 | 0 | 119 | 0 | 22 | 0 | 9 |
| ISO7719 | 0 | 84 | 0 | 12 | 0 | 0 |
| ISO7984 | 0 | 0 | 0 | 0 | 0 | 0 |
| ISO8673 | 0 | 192 | 0 | 0 | 0 | 0 |
| ISO8674 | 0 | 192 | 0 | 0 | 0 | 0 |
| ISO8675 | 0 | 160 | 0 | 0 | 0 | 0 |
| ISO8676 | 0 | 42 | 0 | 0 | 0 | 6 |
| ISO8677 | 77 | 15 | 1 | 7 | 0 | 0 |
| ISO8734 | 12 | 39 | 1 | 1 | 1 | 0 |
| ISO8735 | 18 | 52 | 1 | 1 | 2 | 0 |
| ISO8740 | 0 | 20 | 2 | 11 | 0 | 0 |
| ISO8741 | 0 | 20 | 2 | 11 | 0 | 0 |
| ISO8742 | 0 | 20 | 2 | 11 | 0 | 0 |
| ISO8743 | 0 | 27 | 2 | 13 | 0 | 0 |
| ISO8744 | 0 | 20 | 2 | 11 | 0 | 0 |
| ISO8745 | 0 | 20 | 2 | 11 | 0 | 0 |
| ISO8746 | 0 | 40 | 2 | 1 | 0 | 0 |
| ISO8747 | 0 | 66 | 2 | 0 | 0 | 0 |
| ISO8765 | 68 | 619 | 0 | 6 | 1 | 0 |

## Bezug zum Maschinenkatalog

Geprüfter Katalogumfang: 329 Modelle. Der Bericht verwendet denselben vorsichtigen Schaftkontur-/Werkzeugaufnahmevergleich wie die Größenauswahl. Kopf- oder Mutteraußendurchmesser allein liefern keinen Ausschluss. Fehlende Konturen oder Aufnahmemaße bleiben offen. Dies ersetzt keine Prüfung von Draht, Kraft, Stationen, Transport und Länge.

„Im Aufnahmerahmen“ bedeutet: Mindestens eine dokumentierte Werkzeugaufnahme ist groß genug. „Außerhalb“ gilt nur bei einem belegten Ausschluss durch alle Modelle. Ohne belegte Kontur oder hinreichende Maschinendaten bleibt die Zeile „offen“. Eine ausgewählte Länge wird nicht erfunden; `ml` und `cl` begrenzen unterschiedliche Größen.

| Familie | Im Aufnahmerahmen | Außerhalb aller Aufnahmen | Offen | Keine Teilekonturprüfung |
|---|---:|---:|---:|---:|
| DIN124 | 12 | 0 | 0 | 0 |
| DIN1587 | 0 | 0 | 13 | 0 |
| DIN302 | 12 | 0 | 0 | 0 |
| DIN439 | 0 | 0 | 33 | 0 |
| DIN557 | 0 | 0 | 6 | 0 |
| DIN562 | 0 | 0 | 4 | 0 |
| DIN603 | 7 | 0 | 0 | 0 |
| DIN660 | 13 | 0 | 0 | 0 |
| DIN661 | 13 | 0 | 0 | 0 |
| DIN662 | 8 | 0 | 0 | 0 |
| DIN674 | 9 | 0 | 0 | 0 |
| DIN6791 | 10 | 0 | 0 | 0 |
| DIN6792 | 10 | 0 | 0 | 0 |
| DIN6921 | 7 | 0 | 0 | 0 |
| DIN6923 | 0 | 0 | 8 | 0 |
| DIN6924 | 0 | 0 | 13 | 0 |
| DIN6926 | 0 | 0 | 8 | 0 |
| DIN6927 | 0 | 0 | 15 | 0 |
| DIN7338 | 24 | 0 | 0 | 0 |
| DIN7500 | 0 | 0 | 8 | 0 |
| DIN7984 | 8 | 0 | 0 | 0 |
| DIN835 | 0 | 0 | 13 | 0 |
| DIN928 | 0 | 0 | 5 | 0 |
| DIN929 | 0 | 0 | 6 | 0 |
| DIN931 | 14 | 0 | 0 | 0 |
| DIN933 | 16 | 0 | 0 | 0 |
| DIN934 | 0 | 0 | 32 | 0 |
| DIN936 | 0 | 0 | 11 | 0 |
| DIN938 | 0 | 0 | 20 | 0 |
| DIN939 | 0 | 0 | 19 | 0 |
| DIN940 | 0 | 0 | 13 | 0 |
| DIN960 | 10 | 0 | 2 | 0 |
| DIN961 | 10 | 0 | 2 | 0 |
| DIN980 | 0 | 0 | 30 | 0 |
| DIN985 | 0 | 0 | 14 | 0 |
| EN1662 | 7 | 0 | 0 | 0 |
| EN1665 | 8 | 0 | 0 | 0 |
| ISO1051 | 0 | 0 | 0 | 25 |
| ISO10511 | 0 | 0 | 10 | 0 |
| ISO10512 | 0 | 0 | 10 | 0 |
| ISO10513 | 0 | 0 | 10 | 0 |
| ISO10642 | 10 | 0 | 0 | 0 |
| ISO10663 | 0 | 0 | 8 | 0 |
| ISO13918 | 46 | 0 | 36 | 0 |
| ISO14579 | 11 | 0 | 2 | 0 |
| ISO14580 | 7 | 0 | 0 | 0 |
| ISO14581 | 7 | 0 | 0 | 0 |
| ISO14583 | 6 | 0 | 0 | 0 |
| ISO14584 | 7 | 0 | 0 | 0 |
| ISO15071 | 7 | 0 | 0 | 0 |
| ISO15072 | 7 | 0 | 0 | 0 |
| ISO1580 | 7 | 0 | 0 | 0 |
| ISO2009 | 7 | 0 | 0 | 0 |
| ISO2338 | 19 | 0 | 0 | 0 |
| ISO2340 | 15 | 0 | 0 | 0 |
| ISO2341 | 18 | 0 | 0 | 0 |
| ISO4014 | 15 | 0 | 0 | 0 |
| ISO4017 | 17 | 0 | 0 | 0 |
| ISO4026 | 13 | 0 | 0 | 0 |
| ISO4027 | 13 | 0 | 0 | 0 |
| ISO4028 | 7 | 0 | 0 | 0 |
| ISO4029 | 13 | 0 | 0 | 0 |
| ISO4032 | 0 | 0 | 14 | 0 |
| ISO4033 | 0 | 0 | 14 | 0 |
| ISO4035 | 0 | 0 | 14 | 0 |
| ISO4161 | 0 | 0 | 8 | 0 |
| ISO4162 | 7 | 0 | 0 | 0 |
| ISO4762 | 12 | 0 | 1 | 0 |
| ISO4766 | 8 | 0 | 4 | 0 |
| ISO7040 | 0 | 0 | 10 | 0 |
| ISO7042 | 0 | 0 | 10 | 0 |
| ISO7045 | 6 | 0 | 0 | 0 |
| ISO7046 | 7 | 0 | 0 | 0 |
| ISO7049 | 0 | 0 | 9 | 0 |
| ISO7050 | 0 | 0 | 9 | 0 |
| ISO7051 | 0 | 0 | 9 | 0 |
| ISO7379 | 0 | 0 | 7 | 0 |
| ISO7380-1 | 8 | 0 | 0 | 0 |
| ISO7380-2 | 8 | 0 | 0 | 0 |
| ISO7434 | 7 | 0 | 0 | 0 |
| ISO7435 | 8 | 0 | 3 | 0 |
| ISO7436 | 8 | 0 | 3 | 0 |
| ISO7719 | 0 | 0 | 12 | 0 |
| ISO7984 | 0 | 0 | 0 | 0 |
| ISO8673 | 0 | 0 | 16 | 0 |
| ISO8674 | 0 | 0 | 16 | 0 |
| ISO8675 | 0 | 0 | 16 | 0 |
| ISO8676 | 9 | 0 | 3 | 0 |
| ISO8677 | 7 | 0 | 0 | 0 |
| ISO8734 | 13 | 0 | 0 | 0 |
| ISO8735 | 9 | 0 | 0 | 0 |
| ISO8740 | 10 | 0 | 0 | 0 |
| ISO8741 | 10 | 0 | 0 | 0 |
| ISO8742 | 10 | 0 | 0 | 0 |
| ISO8743 | 13 | 0 | 0 | 0 |
| ISO8744 | 10 | 0 | 0 | 0 |
| ISO8745 | 10 | 0 | 0 | 0 |
| ISO8746 | 8 | 0 | 0 | 0 |
| ISO8747 | 13 | 0 | 0 | 0 |
| ISO8765 | 6 | 0 | 3 | 0 |
| **Summe** | **657** | **0** | **532** | **25** |

## Gesonderte Referenzen

- ISO1051: Durchmesserreihe; keine eigenständige vollständige Teilekontur.
- ISO7984: ungültiger Produktverweis; keine vollständige Teilefamilie.

## Grenzen der Auswertung

- DIN- und ISO-Ausgaben sowie Hersteller-Sortimente werden nicht gleichgesetzt.
- Ein fehlender Tabellenwert bedeutet eine Datenlücke; daraus folgt kein Normverbot.
- Modellannahmen für Radien, Bohrungsgründe oder Bundkonturen sind keine recherchierten Normmaße.
- Vollständige Längenmatrizen und unabhängige Zweitbelege bleiben dort offen, wo die Familien-Daten sie nicht nachweisen.
