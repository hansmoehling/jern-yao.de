# Normbibliothek – automatisch erzeugter Abdeckungsbericht

Erzeugt mit `node quelle/normen/report.cjs` aus den Familien-JSON-Dateien, dem Gewindedatensatz und dem Maschinenkatalog. `bauen.py` aktualisiert diesen Bericht automatisch. Manuelle Änderungen werden überschrieben.

Datensatzversionen laut Dateien: 2026-11-26, 2026-11-26.1, 2026-11-27, 2026-11-27-p7, 2026-11-27.p7. Dies ist kein neues fachliches Prüfdatum.

Der Bericht zählt vorhandene Daten und deren gespeicherten Prüfstatus. Er bestätigt weder die Vollständigkeit einer Norm noch die Aktualität ihrer Ausgabe oder die Machbarkeit eines Bauteils.

## Datenbestand

| Merkmal | Anzahl |
|---|---:|
| Familienreferenzen | 100 |
| Familien mit direkten Größenzeilen | 96 |
| Direkte Größen-/Steigungszeilen | 1292 |
| Definierte Varianten | 30 |
| Zusätzliche Varianten-Größenzeilen | 124 |
| Größen-/Variantenzeilen mit mindestens einer Längenzelle | 739 |
| Gespeicherte Längenzellen | 9097 |
| Familien mit mindestens einer Längenzelle | 68 |
| Längenrelevante Produktfamilien ohne Längenzelle | 2 von 70 |
| Ausgabe angegeben | 94 |
| Katalogausgabe nicht zugeordnet | 1 |
| Ausgabe fehlt | 5 |

Direkte Größen und Variantengrößen werden getrennt gezählt. Varianten ohne eigene Größenzeilen erzeugen keine zusätzlichen Größen. Eine Längenzelle ist ein vorhandener Eintrag in `nachLaenge`, unabhängig von seinem Quellenstatus; eine globale Kataloglängenliste ist keine nachgewiesene Matrix je Größe. Muttern, reine Durchmesserreihen und ungültige Verweise zählen nicht als längenrelevante Produktfamilien.

## Quellenstatus

| Gespeicherter Maß-/Metadatensatz | Anzahl |
|---|---:|
| Als bestätigt markiert, mindestens zwei verschiedene auflösbare Quelldokumente | 8637 |
| Nur ein auflösbares Quelldokument | 29839 |
| Ungeprüft oder nicht ausreichend zugeordnet | 2499 |
| Fehlend oder ausdrücklich offen | 1305 |
| Widersprüchlich | 47 |
| Summe der Maß-/Metadatensätze | 42327 |

Zusätzliche Diagnose: 1028 Datensätze ohne auflösbares Maßdokument; 0 nicht auflösbare Quellenreferenzen; 189 weitere Referenzen auf dasselbe Dokument; 103 Referenzen auf reine Status-/Änderungsseiten. Diese Diagnosezahlen überschneiden sich mit der Tabelle.

Gezählt werden Datensätze mit `sourceRefs` und Prüfstatus; derselbe Zahlenwert kann an mehreren Datenstellen vorkommen. `quellen` und `sourceMeta` werden zusammen ausgewertet. Gleiche Dokument-URLs zählen einmal. Verschiedene Domains oder Quellen-IDs beweisen keine Unabhängigkeit: „bestätigt“ übernimmt nur die bereits hinterlegte Bewertung und setzt mindestens zwei auflösbare Maßdokumente voraus. Reine Normstatusseiten bestätigen keine Maßzahl. Eine angegebene Ausgabe ist nicht automatisch verifiziert.

## Familien und Längen

| Familie | Datenedition | Direkte Größen | Variantengrößen | Varianten | Größen mit Längen | Längenzellen | Offene Größenmetadaten |
|---|---|---:|---:|---:|---:|---:|---:|
| DIN124 | 2011-03 | 12 | 0 | 0 | 3 | 15 | 0 |
| DIN1587 | 2021-11 | 14 | 0 | 0 | 0 | 0 | 0 |
| DIN302 | 2011-03 | 12 | 0 | 0 | 0 | 0 | 0 |
| DIN439 | 1987-10 | 37 | 0 | 0 | 0 | 0 | 0 |
| DIN557 | 1994-01 | 6 | 0 | 0 | 0 | 0 | 0 |
| DIN562 | 2013-05 | 10 | 0 | 0 | 0 | 0 | 0 |
| DIN603 | Katalogausgabe offen | 7 | 0 | 0 | 7 | 121 | 11 |
| DIN660 | 2012-01 | 13 | 0 | 0 | 7 | 50 | 0 |
| DIN661 | 2011-03 | 13 | 0 | 0 | 3 | 15 | 0 |
| DIN662 | 2011-03 | 8 | 0 | 0 | 3 | 3 | 0 |
| DIN674 | 2011-03 | 9 | 0 | 0 | 3 | 6 | 0 |
| DIN6791 | 2012-05 | 10 | 0 | 0 | 1 | 1 | 0 |
| DIN6792 | 2012-05 | 10 | 0 | 0 | 0 | 0 | 0 |
| DIN6921 | offen | 7 | 0 | 0 | 7 | 95 | 11 |
| DIN6923 | 1983 | 8 | 0 | 0 | 0 | 0 | 0 |
| DIN6924 | 1987 | 13 | 0 | 0 | 0 | 0 | 0 |
| DIN6926 | 1983 | 8 | 0 | 0 | 0 | 0 | 0 |
| DIN6927 | 1983-11 | 15 | 0 | 0 | 0 | 0 | 0 |
| DIN7338 | 2011-03 | 0 | 24 | 4 | 1 | 2 | 0 |
| DIN7500 | offen | 0 | 18 | 4 | 18 | 97 | 5 |
| DIN7984 | 2022-03 | 8 | 0 | 0 | 8 | 62 | 10 |
| DIN835 | 2010-07 | 13 | 0 | 0 | 13 | 179 | 0 |
| DIN928 | 2013-12 | 15 | 0 | 0 | 0 | 0 | 0 |
| DIN929 | 2013-12 | 16 | 0 | 0 | 0 | 0 | 0 |
| DIN931 | 1987-09 | 15 | 0 | 0 | 15 | 307 | 3 |
| DIN933 | offen | 16 | 0 | 0 | 16 | 345 | 2 |
| DIN934 | 1987-10 | 78 | 0 | 0 | 0 | 0 | 0 |
| DIN936 | 1985-02 | 11 | 0 | 0 | 0 | 0 | 0 |
| DIN938 | 2012-12 | 23 | 0 | 0 | 23 | 356 | 1 |
| DIN939 | 1995-02 | 22 | 0 | 0 | 22 | 350 | 2 |
| DIN940 | 2010-07 | 13 | 0 | 0 | 13 | 179 | 0 |
| DIN960 | 1990-01 | 12 | 0 | 0 | 9 | 109 | 6 |
| DIN961 | 1990-01 | 12 | 0 | 0 | 12 | 353 | 6 |
| DIN980 | 1987-05 | 38 | 0 | 0 | 0 | 0 | 0 |
| DIN985 | 1987-05 | 47 | 0 | 0 | 0 | 0 | 3 |
| EN1662 | 1997 | 7 | 0 | 0 | 7 | 96 | 11 |
| EN1665 | 1997 + AC:2007 | 8 | 0 | 0 | 8 | 112 | 10 |
| ISO1051 | 1999 | 25 | 0 | 0 | 0 | 0 | 0 |
| ISO10511 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO10512 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO10513 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO10642 | 1997 | 10 | 0 | 0 | 10 | 124 | 8 |
| ISO10663 | 2012 | 8 | 0 | 0 | 0 | 0 | 0 |
| ISO13918 | 2017+AMD1:2021 | 0 | 82 | 14 | 18 | 156 | 0 |
| ISO14579 | 2011 | 13 | 0 | 0 | 8 | 91 | 7 |
| ISO14580 | 2011 | 9 | 0 | 0 | 7 | 86 | 1 |
| ISO14581 | 2013 | 7 | 0 | 0 | 7 | 86 | 1 |
| ISO14583 | 2011 | 9 | 0 | 0 | 8 | 91 | 11 |
| ISO14584 | 2011 | 9 | 0 | 0 | 9 | 107 | 11 |
| ISO15071 | 2011 | 7 | 0 | 0 | 7 | 96 | 1 |
| ISO15072 | 2012 | 7 | 0 | 0 | 7 | 104 | 0 |
| ISO1580 | 2011 | 7 | 0 | 0 | 7 | 94 | 1 |
| ISO2009 | 2011 | 7 | 0 | 0 | 7 | 90 | 1 |
| ISO2338 | 1997 | 20 | 0 | 0 | 20 | 258 | 0 |
| ISO2340 | 1986 | 26 | 0 | 0 | 26 | 325 | 0 |
| ISO2341 | 1986 | 26 | 0 | 2 | 26 | 325 | 0 |
| ISO4014 | 2022 | 18 | 0 | 0 | 18 | 162 | 0 |
| ISO4017 | 2022 | 18 | 0 | 0 | 18 | 245 | 0 |
| ISO4026 | 2003 | 13 | 0 | 0 | 13 | 112 | 5 |
| ISO4027 | 2003 | 13 | 0 | 0 | 13 | 112 | 5 |
| ISO4028 | 2003 | 13 | 0 | 0 | 13 | 106 | 5 |
| ISO4029 | 2003 | 13 | 0 | 0 | 13 | 112 | 5 |
| ISO4032 | 2023 | 14 | 0 | 0 | 0 | 0 | 0 |
| ISO4033 | 2023 | 14 | 0 | 0 | 0 | 0 | 0 |
| ISO4035 | 2023 | 14 | 0 | 0 | 0 | 0 | 0 |
| ISO4161 | 2012 | 8 | 0 | 0 | 0 | 0 | 0 |
| ISO4162 | 1990 | 7 | 0 | 0 | 7 | 96 | 11 |
| ISO4762 | 2004 | 13 | 0 | 0 | 13 | 193 | 6 |
| ISO4766 | 2024 | 12 | 0 | 0 | 12 | 107 | 1 |
| ISO7040 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO7042 | 2012 | 10 | 0 | 0 | 0 | 0 | 0 |
| ISO7045 | 2011 | 7 | 0 | 0 | 7 | 85 | 11 |
| ISO7046 | 2011 | 7 | 0 | 0 | 7 | 87 | 11 |
| ISO7049 | 2011 | 9 | 0 | 0 | 9 | 57 | 0 |
| ISO7050 | 2011 | 9 | 0 | 0 | 9 | 56 | 0 |
| ISO7051 | 2011 | 9 | 0 | 0 | 9 | 56 | 0 |
| ISO7379 | 1983 | 7 | 0 | 0 | 4 | 39 | 9 |
| ISO7380-1 | 2022 | 8 | 0 | 0 | 8 | 57 | 10 |
| ISO7380-2 | offen | 8 | 0 | 0 | 8 | 137 | 10 |
| ISO7434 | 1983 | 12 | 0 | 0 | 12 | 92 | 1 |
| ISO7435 | 2024 | 11 | 0 | 0 | 11 | 85 | 1 |
| ISO7436 | 2024 | 11 | 0 | 0 | 11 | 98 | 1 |
| ISO7719 | 2012 | 12 | 0 | 0 | 0 | 0 | 0 |
| ISO7984 | offen | 0 | 0 | 0 | 0 | 0 | 0 |
| ISO8673 | 2023 | 16 | 0 | 0 | 0 | 0 | 0 |
| ISO8674 | 2023 | 16 | 0 | 0 | 0 | 0 | 0 |
| ISO8675 | 2023 | 16 | 0 | 0 | 0 | 0 | 0 |
| ISO8676 | 2022 | 12 | 0 | 0 | 12 | 187 | 0 |
| ISO8677 | 1986 | 7 | 0 | 0 | 7 | 69 | 11 |
| ISO8734 | 1997 | 13 | 0 | 0 | 13 | 163 | 0 |
| ISO8735 | 1997 | 10 | 0 | 2 | 10 | 157 | 0 |
| ISO8740 | 1997 | 13 | 0 | 0 | 13 | 224 | 0 |
| ISO8741 | 1997 | 13 | 0 | 0 | 13 | 229 | 0 |
| ISO8742 | 1997 | 13 | 0 | 0 | 13 | 177 | 0 |
| ISO8743 | 1997 | 13 | 0 | 0 | 13 | 189 | 0 |
| ISO8744 | 1997 | 13 | 0 | 0 | 13 | 229 | 0 |
| ISO8745 | 1997 | 13 | 0 | 0 | 13 | 253 | 0 |
| ISO8746 | 1997 | 13 | 0 | 2 | 13 | 80 | 0 |
| ISO8747 | 1997 | 13 | 0 | 2 | 13 | 75 | 0 |
| ISO8765 | 2022 | 12 | 0 | 0 | 12 | 85 | 6 |

„Offene Größenmetadaten“ zählt ausdrücklich ungeprüfte oder anderweitig offene Einträge in `sizeCoverage`. Null bedeutet nicht, dass alle möglichen Größen erfasst sind. Als „nicht in der Norm vorgesehen“ markierte Größen bleiben von Recherchelücken getrennt.

## Quellenstatus je Familie

| Familie | Bestätigt mit ≥2 Dokumenten | Einquelle | Ungeprüft | Fehlend/offen | Konflikt | Nicht vorgesehene Größen laut Metadaten |
|---|---:|---:|---:|---:|---:|---:|
| DIN124 | 87 | 24 | 1 | 1 | 0 | 0 |
| DIN1587 | 90 | 30 | 3 | 42 | 0 | 0 |
| DIN302 | 72 | 24 | 1 | 1 | 0 | 0 |
| DIN439 | 81 | 151 | 0 | 0 | 0 | 0 |
| DIN557 | 16 | 50 | 2 | 0 | 0 | 0 |
| DIN562 | 25 | 69 | 0 | 0 | 0 | 0 |
| DIN603 | 84 | 376 | 6 | 2 | 1 | 0 |
| DIN660 | 132 | 36 | 1 | 0 | 0 | 0 |
| DIN661 | 46 | 100 | 1 | 0 | 0 | 0 |
| DIN662 | 49 | 51 | 1 | 0 | 0 | 0 |
| DIN674 | 60 | 1 | 1 | 0 | 0 | 0 |
| DIN6791 | 79 | 52 | 1 | 0 | 1 | 0 |
| DIN6792 | 60 | 31 | 1 | 0 | 0 | 0 |
| DIN6921 | 58 | 236 | 19 | 7 | 0 | 0 |
| DIN6923 | 20 | 68 | 0 | 0 | 0 | 0 |
| DIN6924 | 56 | 44 | 0 | 42 | 2 | 0 |
| DIN6926 | 24 | 56 | 0 | 24 | 0 | 0 |
| DIN6927 | 49 | 86 | 0 | 15 | 0 | 0 |
| DIN7338 | 93 | 52 | 1 | 1 | 1 | 0 |
| DIN7500 | 0 | 221 | 15 | 78 | 0 | 9 |
| DIN7984 | 8 | 234 | 0 | 0 | 0 | 0 |
| DIN835 | 16 | 607 | 6 | 52 | 0 | 5 |
| DIN928 | 66 | 29 | 0 | 60 | 0 | 0 |
| DIN929 | 38 | 64 | 8 | 64 | 0 | 0 |
| DIN931 | 988 | 71 | 307 | 0 | 0 | 0 |
| DIN933 | 418 | 785 | 209 | 0 | 0 | 0 |
| DIN934 | 136 | 573 | 0 | 0 | 0 | 0 |
| DIN936 | 44 | 22 | 0 | 0 | 0 | 0 |
| DIN938 | 40 | 1157 | 2 | 6 | 0 | 0 |
| DIN939 | 127 | 1066 | 2 | 5 | 1 | 0 |
| DIN940 | 39 | 598 | 6 | 44 | 0 | 5 |
| DIN960 | 217 | 534 | 23 | 42 | 10 | 0 |
| DIN961 | 7 | 2336 | 0 | 15 | 1 | 0 |
| DIN980 | 210 | 94 | 0 | 38 | 0 | 0 |
| DIN985 | 274 | 127 | 24 | 141 | 0 | 0 |
| EN1662 | 0 | 616 | 0 | 7 | 0 | 0 |
| EN1665 | 520 | 128 | 96 | 16 | 0 | 0 |
| ISO1051 | 0 | 25 | 1 | 0 | 0 | 0 |
| ISO10511 | 20 | 57 | 0 | 30 | 3 | 0 |
| ISO10512 | 0 | 80 | 0 | 30 | 0 | 0 |
| ISO10513 | 0 | 70 | 0 | 10 | 0 | 0 |
| ISO10642 | 94 | 396 | 47 | 0 | 0 | 0 |
| ISO10663 | 0 | 112 | 0 | 0 | 0 | 0 |
| ISO13918 | 258 | 697 | 45 | 10 | 10 | 0 |
| ISO14579 | 156 | 148 | 92 | 0 | 0 | 0 |
| ISO14580 | 203 | 19 | 87 | 0 | 0 | 10 |
| ISO14581 | 9 | 134 | 11 | 18 | 0 | 10 |
| ISO14583 | 217 | 9 | 92 | 0 | 0 | 0 |
| ISO14584 | 242 | 9 | 108 | 0 | 0 | 0 |
| ISO15071 | 0 | 640 | 0 | 7 | 0 | 10 |
| ISO15072 | 0 | 498 | 14 | 42 | 0 | 13 |
| ISO1580 | 0 | 493 | 0 | 0 | 0 | 10 |
| ISO2009 | 0 | 477 | 0 | 0 | 0 | 10 |
| ISO2338 | 104 | 364 | 89 | 1 | 0 | 0 |
| ISO2340 | 0 | 754 | 1 | 1 | 0 | 0 |
| ISO2341 | 52 | 804 | 1 | 0 | 3 | 0 |
| ISO4014 | 522 | 202 | 146 | 9 | 0 | 0 |
| ISO4017 | 428 | 834 | 142 | 10 | 0 | 0 |
| ISO4026 | 166 | 213 | 92 | 13 | 0 | 3 |
| ISO4027 | 102 | 274 | 82 | 13 | 0 | 3 |
| ISO4028 | 87 | 513 | 65 | 13 | 0 | 3 |
| ISO4029 | 83 | 327 | 61 | 13 | 0 | 3 |
| ISO4032 | 54 | 114 | 0 | 0 | 0 | 0 |
| ISO4033 | 0 | 168 | 0 | 0 | 0 | 0 |
| ISO4035 | 39 | 101 | 0 | 0 | 0 | 0 |
| ISO4161 | 59 | 48 | 0 | 0 | 5 | 0 |
| ISO4162 | 34 | 604 | 0 | 15 | 0 | 0 |
| ISO4762 | 684 | 264 | 247 | 0 | 1 | 0 |
| ISO4766 | 0 | 331 | 0 | 24 | 0 | 9 |
| ISO7040 | 0 | 80 | 0 | 30 | 0 | 0 |
| ISO7042 | 0 | 70 | 0 | 10 | 0 | 0 |
| ISO7045 | 0 | 474 | 0 | 6 | 0 | 0 |
| ISO7046 | 0 | 460 | 0 | 7 | 0 | 0 |
| ISO7049 | 0 | 138 | 1 | 18 | 0 | 0 |
| ISO7050 | 0 | 137 | 1 | 27 | 0 | 0 |
| ISO7051 | 0 | 146 | 1 | 27 | 0 | 0 |
| ISO7379 | 143 | 171 | 2 | 0 | 3 | 2 |
| ISO7380-1 | 0 | 243 | 0 | 0 | 0 | 0 |
| ISO7380-2 | 0 | 572 | 0 | 16 | 0 | 0 |
| ISO7434 | 27 | 351 | 3 | 21 | 1 | 9 |
| ISO7435 | 0 | 278 | 0 | 66 | 0 | 9 |
| ISO7436 | 0 | 304 | 0 | 22 | 0 | 9 |
| ISO7719 | 0 | 84 | 0 | 12 | 0 | 0 |
| ISO7984 | 0 | 0 | 0 | 0 | 0 | 0 |
| ISO8673 | 0 | 192 | 0 | 0 | 0 | 0 |
| ISO8674 | 0 | 192 | 0 | 0 | 0 | 0 |
| ISO8675 | 0 | 160 | 0 | 0 | 0 | 0 |
| ISO8676 | 0 | 790 | 0 | 0 | 0 | 6 |
| ISO8677 | 77 | 222 | 1 | 7 | 0 | 0 |
| ISO8734 | 126 | 124 | 115 | 1 | 1 | 0 |
| ISO8735 | 124 | 172 | 107 | 1 | 2 | 0 |
| ISO8740 | 0 | 474 | 2 | 11 | 0 | 0 |
| ISO8741 | 0 | 484 | 2 | 11 | 0 | 0 |
| ISO8742 | 0 | 380 | 2 | 11 | 0 | 0 |
| ISO8743 | 0 | 405 | 2 | 13 | 0 | 0 |
| ISO8744 | 0 | 484 | 2 | 11 | 0 | 0 |
| ISO8745 | 0 | 532 | 2 | 11 | 0 | 0 |
| ISO8746 | 0 | 285 | 2 | 1 | 0 | 0 |
| ISO8747 | 0 | 242 | 2 | 0 | 0 | 0 |
| ISO8765 | 198 | 615 | 92 | 3 | 1 | 0 |

## Bezug zum Maschinenkatalog

Geprüfter Katalogumfang: 329 Modelle. Der Bericht verwendet denselben vorsichtigen Schaftkontur-/Werkzeugaufnahmevergleich wie die Größenauswahl. Kopf- oder Mutteraußendurchmesser allein liefern keinen Ausschluss. Fehlende Konturen oder Aufnahmemaße bleiben offen. Dies ersetzt keine Prüfung von Draht, Kraft, Stationen, Transport und Länge.

„Im Aufnahmerahmen“ bedeutet: Mindestens eine dokumentierte Werkzeugaufnahme ist groß genug. „Außerhalb“ gilt nur bei einem belegten Ausschluss durch alle Modelle. Ohne belegte Kontur oder hinreichende Maschinendaten bleibt die Zeile „offen“. Eine ausgewählte Länge wird nicht erfunden; `ml` und `cl` begrenzen unterschiedliche Größen.

| Familie | Im Aufnahmerahmen | Außerhalb aller Aufnahmen | Offen | Keine Teilekonturprüfung |
|---|---:|---:|---:|---:|
| DIN124 | 12 | 0 | 0 | 0 |
| DIN1587 | 0 | 0 | 14 | 0 |
| DIN302 | 12 | 0 | 0 | 0 |
| DIN439 | 0 | 0 | 37 | 0 |
| DIN557 | 0 | 0 | 6 | 0 |
| DIN562 | 0 | 0 | 10 | 0 |
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
| DIN7500 | 0 | 0 | 18 | 0 |
| DIN7984 | 8 | 0 | 0 | 0 |
| DIN835 | 0 | 0 | 13 | 0 |
| DIN928 | 0 | 0 | 15 | 0 |
| DIN929 | 0 | 0 | 16 | 0 |
| DIN931 | 15 | 0 | 0 | 0 |
| DIN933 | 16 | 0 | 0 | 0 |
| DIN934 | 0 | 0 | 78 | 0 |
| DIN936 | 0 | 0 | 11 | 0 |
| DIN938 | 0 | 0 | 23 | 0 |
| DIN939 | 0 | 0 | 22 | 0 |
| DIN940 | 0 | 0 | 13 | 0 |
| DIN960 | 10 | 0 | 2 | 0 |
| DIN961 | 10 | 0 | 2 | 0 |
| DIN980 | 0 | 0 | 38 | 0 |
| DIN985 | 0 | 0 | 47 | 0 |
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
| ISO14580 | 7 | 0 | 2 | 0 |
| ISO14581 | 7 | 0 | 0 | 0 |
| ISO14583 | 7 | 0 | 2 | 0 |
| ISO14584 | 7 | 0 | 2 | 0 |
| ISO15071 | 7 | 0 | 0 | 0 |
| ISO15072 | 7 | 0 | 0 | 0 |
| ISO1580 | 7 | 0 | 0 | 0 |
| ISO2009 | 7 | 0 | 0 | 0 |
| ISO2338 | 20 | 0 | 0 | 0 |
| ISO2340 | 26 | 0 | 0 | 0 |
| ISO2341 | 26 | 0 | 0 | 0 |
| ISO4014 | 18 | 0 | 0 | 0 |
| ISO4017 | 18 | 0 | 0 | 0 |
| ISO4026 | 10 | 0 | 3 | 0 |
| ISO4027 | 10 | 0 | 3 | 0 |
| ISO4028 | 10 | 0 | 3 | 0 |
| ISO4029 | 10 | 0 | 3 | 0 |
| ISO4032 | 0 | 0 | 14 | 0 |
| ISO4033 | 0 | 0 | 14 | 0 |
| ISO4035 | 0 | 0 | 14 | 0 |
| ISO4161 | 0 | 0 | 8 | 0 |
| ISO4162 | 7 | 0 | 0 | 0 |
| ISO4762 | 12 | 0 | 1 | 0 |
| ISO4766 | 8 | 0 | 4 | 0 |
| ISO7040 | 0 | 0 | 10 | 0 |
| ISO7042 | 0 | 0 | 10 | 0 |
| ISO7045 | 7 | 0 | 0 | 0 |
| ISO7046 | 7 | 0 | 0 | 0 |
| ISO7049 | 0 | 0 | 9 | 0 |
| ISO7050 | 0 | 0 | 9 | 0 |
| ISO7051 | 0 | 0 | 9 | 0 |
| ISO7379 | 0 | 0 | 7 | 0 |
| ISO7380-1 | 8 | 0 | 0 | 0 |
| ISO7380-2 | 8 | 0 | 0 | 0 |
| ISO7434 | 8 | 0 | 4 | 0 |
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
| ISO8735 | 10 | 0 | 0 | 0 |
| ISO8740 | 13 | 0 | 0 | 0 |
| ISO8741 | 13 | 0 | 0 | 0 |
| ISO8742 | 13 | 0 | 0 | 0 |
| ISO8743 | 13 | 0 | 0 | 0 |
| ISO8744 | 13 | 0 | 0 | 0 |
| ISO8745 | 13 | 0 | 0 | 0 |
| ISO8746 | 13 | 0 | 0 | 0 |
| ISO8747 | 13 | 0 | 0 | 0 |
| ISO8765 | 9 | 0 | 3 | 0 |
| **Summe** | **703** | **0** | **688** | **25** |

### Größen je Familie

Die folgenden Listen benennen jede gespeicherte Größe einschließlich ihrer Variante. Sie gelten für die dokumentierte Aufnahmekontur; „im Rahmen“ ist keine Zusage einer fertigen Maschinenauslegung.

| Familie | Im Aufnahmerahmen | Außerhalb | Offen | Keine Konturprüfung |
|---|---|---|---|---|
| DIN124 | 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36 | – | – | – |
| DIN1587 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M4, M5, M6, M8 | – |
| DIN302 | 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36 | – | – | – |
| DIN439 | – | – | M10, M10x0.75, M10x1, M10x1.25, M12, M12x1, M12x1.25, M12x1.5, M14, M14x1.5, M16, M16x1.5, M18, M18x1.5, M20, M20x1.5, M20x2, M22, M22x1.5, M24, M24x1.5, M24x2, M27, M27x1.5, M27x2, M3, M30, M30x1.5, M30x2, M33, M36, M4, M5, M6, M8, M8x0.75, M8x1 | – |
| DIN557 | – | – | M10, M12, M16, M5, M6, M8 | – |
| DIN562 | – | – | M1.6, M10, M2, M2.5, M3, M3.5, M4, M5, M6, M8 | – |
| DIN603 | M10, M12, M16, M20, M5, M6, M8 | – | – | – |
| DIN660 | 1, 1.2, 1.4, 1.6, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8 | – | – | – |
| DIN661 | 1, 1.2, 1.4, 1.6, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8 | – | – | – |
| DIN662 | 1.6, 2, 2.5, 3, 3.5, 4, 5, 6 | – | – | – |
| DIN674 | 1.4, 1.6, 2, 2.5, 3, 3.5, 4, 5, 6 | – | – | – |
| DIN6791 | 1.6, 10, 2, 2.5, 3, 3.5, 4, 5, 6, 8 | – | – | – |
| DIN6792 | 1.6, 10, 2, 2.5, 3, 3.5, 4, 5, 6, 8 | – | – | – |
| DIN6921 | M10, M12, M14, M16, M5, M6, M8 | – | – | – |
| DIN6923 | – | – | M10, M12, M14, M16, M20, M5, M6, M8 | – |
| DIN6924 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M5, M6, M8 | – |
| DIN6926 | – | – | M10, M12, M14, M16, M20, M5, M6, M8 | – |
| DIN6927 | – | – | M10, M10x1, M10x1.25, M12, M12x1.5, M14, M14x1.5, M16, M16x1.5, M20, M20x1.5, M5, M6, M8, M8x1 | – |
| DIN7338 | A / 10, A / 3, A / 4, A / 5, A / 6, A / 8, B / 10, B / 3, B / 4, B / 5, B / 6, B / 8, C1 / 10, C1 / 3, C1 / 4, C1 / 5, C1 / 6, C1 / 8, C2 / 10, C2 / 3, C2 / 4, C2 / 5, C2 / 6, C2 / 8 | – | – | – |
| DIN7500 | – | – | C / M3, C / M4, C / M5, C / M6, M / M3, M / M4, M / M5, M / M6, C-DUO-TX / M2.5, C-DUO-TX / M3, C-DUO-TX / M4, C-DUO-TX / M5, C-DUO-TX / M6, M-DUO-TX / M2.5, M-DUO-TX / M3, M-DUO-TX / M4, M-DUO-TX / M5, M-DUO-TX / M6 | – |
| DIN7984 | M10, M12, M16, M3, M4, M5, M6, M8 | – | – | – |
| DIN835 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M4, M5, M6, M7, M8 | – |
| DIN928 | – | – | M10, M10x1, M10x1.25, M12, M12x1.25, M12x1.5, M14, M14x1.5, M16, M16x1.5, M4, M5, M6, M8, M8x1 | – |
| DIN929 | – | – | M10, M10x1, M10x1.25, M12, M12x1.25, M12x1.5, M14, M14x1.5, M16, M16x1.5, M3, M4, M5, M6, M8, M8x1 | – |
| DIN931 | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M33, M4, M5, M6, M8 | – | – | – |
| DIN933 | M10, M12, M14, M16, M18, M20, M22, M24, M27, M3, M30, M33, M4, M5, M6, M8 | – | – | – |
| DIN934 | – | – | M1, M1.2, M1.4, M1.6, M10, M100x4, M100x6, M10x1, M10x1.25, M12, M12x1, M12x1.25, M12x1.5, M14, M14x1.5, M16, M16x1.5, M18, M18x1.5, M18x2, M2, M2.5, M20, M20x1.5, M20x2, M22, M22x1.5, M22x2, M24, M24x1.5, M24x2, M27, M27x1.5, M27x2, M3, M3.5, M30, M30x1.5, M30x2, M33, M33x2, M36, M36x3, M39, M39x3, M4, M42, M42x3, M45, M45x3, M48, M48x3, M5, M52, M52x3, M56, M56x4, M6, M60, M60x4, M64, M64x4, M68, M68x4, M7, M72x4, M72x6, M76x4, M76x6, M8, M80x4, M80x6, M85x4, M85x6, M8x0.5, M8x1, M90x4, M90x6 | – |
| DIN936 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M8 | – |
| DIN938 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M3, M30, M33, M36, M39, M4, M42, M45, M48, M5, M52, M6, M7, M8 | – |
| DIN939 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M33, M36, M39, M4, M42, M45, M48, M5, M52, M6, M7, M8 | – |
| DIN940 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M4, M5, M6, M7, M8 | – |
| DIN960 | M10, M12, M14, M16, M20, M24, M27, M30, M33, M8 | – | M18, M22 | – |
| DIN961 | M10, M12, M14, M16, M20, M24, M27, M30, M33, M8 | – | M18, M22 | – |
| DIN980 | – | – | M10, M10x1, M10x1.25, M12, M12x1.25, M12x1.5, M14, M14x1.5, M16, M16x1.5, M18, M18x1.5, M18x2, M20, M20x1.5, M20x2, M22, M22x1.5, M22x2, M24, M24x2, M27, M27x2, M3, M30, M30x2, M33, M33x2, M36, M36x3, M39, M39x3, M4, M5, M6, M7, M8, M8x1 | – |
| DIN985 | – | – | M10, M10x1, M10x1.25, M12, M12x1, M12x1.25, M12x1.5, M14, M14x1.5, M16, M16x1.5, M18, M18x1.5, M18x2, M20, M20x1.5, M20x2, M22, M22x1.5, M22x2, M24, M24x1.5, M24x2, M27, M27x2, M3, M30, M30x1.5, M30x2, M33, M33x2, M36, M36x3, M39, M39x3, M4, M42, M42x3, M45, M45x3, M48, M48x3, M5, M6, M7, M8, M8x1 | – |
| EN1662 | M10, M12, M14, M16, M5, M6, M8 | – | – | – |
| EN1665 | M10, M12, M14, M16, M20, M5, M6, M8 | – | – | – |
| ISO1051 | – | – | – | 1, 1.2, 1.4, 1.6, 10, 12, 14, 16, 18, 2, 2.5, 20, 22, 24, 27, 3, 3.5, 30, 33, 36, 4, 5, 6, 7, 8 |
| ISO10511 | – | – | M10, M12, M14, M16, M20, M24, M30, M5, M6, M8 | – |
| ISO10512 | – | – | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M20x1.5, M24x2, M30x2, M8x1 | – |
| ISO10513 | – | – | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M20x1.5, M24x2, M30x2, M8x1 | – |
| ISO10642 | M10, M12, M14, M16, M20, M3, M4, M5, M6, M8 | – | – | – |
| ISO10663 | – | – | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M20x1.5, M8x1 | – |
| ISO13918 | UD / 10, UD / 12, UD / 14.6, UD / 16, UD / 6, UD / 8, ND / 3, ND / 4, ND / 5, ID / M10-D14.6, ID / M10-D16, ID / M12-D18.38, ID / M5-D10, ID / M6-D10, ID / M8-D12, ID / M8-D14.6, SD / 10, SD / 12.7, SD / 13, SD / 16, SD / 19, SD / 22, SD / 25, SD / 25.4, SD / 9.5, US / 3, US / 4, US / 5, US / 6, US / 7.1, US / 8, IS / M3-D5, IS / M4-D6, IS / M5-D7.1, IS / M5-D8, IS / M6-D8, UT / 3, UT / 4, UT / 5, UT / 6, UT / 7.1, IT / M3-D5, IT / M4-D6, IT / M5-D7.1, IT / M5-D8, IT / M6-D8 | – | FD / M10, FD / M12, FD / M16, FD / M20, FD / M6, FD / M8, MD / M10, MD / M12, MD / M16, MD / M6, MD / M8, PD / M10, PD / M12, PD / M16, PD / M20, PD / M24, PD / M6, PD / M8, RD / M10, RD / M12, RD / M16, RD / M20, RD / M24, RD / M6, RD / M8, PS / M10, PS / M3, PS / M4, PS / M5, PS / M6, PS / M8, PT / M3, PT / M4, PT / M5, PT / M6, PT / M8 | – |
| ISO14579 | M10, M12, M14, M16, M18, M20, M3, M4, M5, M6, M8 | – | M2, M2.5 | – |
| ISO14580 | M10, M3, M3.5, M4, M5, M6, M8 | – | M2, M2.5 | – |
| ISO14581 | M10, M3, M3.5, M4, M5, M6, M8 | – | – | – |
| ISO14583 | M10, M3, M3.5, M4, M5, M6, M8 | – | M2, M2.5 | – |
| ISO14584 | M10, M3, M3.5, M4, M5, M6, M8 | – | M2, M2.5 | – |
| ISO15071 | M10, M12, M14, M16, M5, M6, M8 | – | – | – |
| ISO15072 | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M8x1 | – | – | – |
| ISO1580 | M10, M3, M3.5, M4, M5, M6, M8 | – | – | – |
| ISO2009 | M10, M3, M3.5, M4, M5, M6, M8 | – | – | – |
| ISO2338 | 0.6, 0.8, 1, 1.2, 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 30, 4, 40, 5, 50, 6, 8 | – | – | – |
| ISO2340 | 10, 100, 12, 14, 16, 18, 20, 22, 24, 27, 3, 30, 33, 36, 4, 40, 45, 5, 50, 55, 6, 60, 70, 8, 80, 90 | – | – | – |
| ISO2341 | 10, 100, 12, 14, 16, 18, 20, 22, 24, 27, 3, 30, 33, 36, 4, 40, 45, 5, 50, 55, 6, 60, 70, 8, 80, 90 | – | – | – |
| ISO4014 | M10, M12, M14, M16, M18, M20, M22, M24, M27, M3, M3.5, M30, M33, M4, M5, M6, M7, M8 | – | – | – |
| ISO4017 | M10, M12, M14, M16, M18, M20, M22, M24, M27, M3, M3.5, M30, M33, M4, M5, M6, M7, M8 | – | – | – |
| ISO4026 | M10, M12, M16, M20, M24, M3, M4, M5, M6, M8 | – | M1.6, M2, M2.5 | – |
| ISO4027 | M10, M12, M16, M20, M24, M3, M4, M5, M6, M8 | – | M1.6, M2, M2.5 | – |
| ISO4028 | M10, M12, M16, M20, M24, M3, M4, M5, M6, M8 | – | M1.6, M2, M2.5 | – |
| ISO4029 | M10, M12, M16, M20, M24, M3, M4, M5, M6, M8 | – | M1.6, M2, M2.5 | – |
| ISO4032 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M5, M6, M7, M8 | – |
| ISO4033 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M5, M6, M7, M8 | – |
| ISO4035 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M27, M30, M5, M6, M7, M8 | – |
| ISO4161 | – | – | M10, M12, M14, M16, M20, M5, M6, M8 | – |
| ISO4162 | M10, M12, M14, M16, M5, M6, M8 | – | – | – |
| ISO4762 | M10, M12, M14, M16, M20, M24, M3, M30, M4, M5, M6, M8 | – | M36 | – |
| ISO4766 | M10, M12, M3, M3.5, M4, M5, M6, M8 | – | M1.2, M1.6, M2, M2.5 | – |
| ISO7040 | – | – | M10, M12, M14, M16, M20, M24, M30, M5, M6, M8 | – |
| ISO7042 | – | – | M10, M12, M14, M16, M20, M24, M30, M5, M6, M8 | – |
| ISO7045 | M10, M3, M3.5, M4, M5, M6, M8 | – | – | – |
| ISO7046 | M10, M3, M3.5, M4, M5, M6, M8 | – | – | – |
| ISO7049 | – | – | ST2.2, ST2.9, ST3.5, ST4.2, ST4.8, ST5.5, ST6.3, ST8, ST9.5 | – |
| ISO7050 | – | – | ST2.2, ST2.9, ST3.5, ST4.2, ST4.8, ST5.5, ST6.3, ST8, ST9.5 | – |
| ISO7051 | – | – | ST2.2, ST2.9, ST3.5, ST4.2, ST4.8, ST5.5, ST6.3, ST8, ST9.5 | – |
| ISO7379 | – | – | M10, M12, M16, M20, M5, M6, M8 | – |
| ISO7380-1 | M10, M12, M16, M3, M4, M5, M6, M8 | – | – | – |
| ISO7380-2 | M10, M12, M16, M3, M4, M5, M6, M8 | – | – | – |
| ISO7434 | M10, M12, M3, M3.5, M4, M5, M6, M8 | – | M1.2, M1.6, M2, M2.5 | – |
| ISO7435 | M10, M12, M3, M3.5, M4, M5, M6, M8 | – | M1.6, M2, M2.5 | – |
| ISO7436 | M10, M12, M3, M3.5, M4, M5, M6, M8 | – | M1.6, M2, M2.5 | – |
| ISO7719 | – | – | M10, M12, M14, M16, M18, M20, M22, M24, M30, M5, M6, M8 | – |
| ISO7984 | – | – | – | – |
| ISO8673 | – | – | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M18x1.5, M18x2, M20x1.5, M20x2, M22x1.5, M22x2, M24x2, M27x2, M30x2, M8x1 | – |
| ISO8674 | – | – | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M18x1.5, M18x2, M20x1.5, M20x2, M22x1.5, M22x2, M24x2, M27x2, M30x2, M8x1 | – |
| ISO8675 | – | – | M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M18x1.5, M18x2, M20x1.5, M20x2, M22x1.5, M22x2, M24x2, M27x2, M30x2, M8x1 | – |
| ISO8676 | M10, M12, M14, M16, M24, M27, M30, M33, M8 | – | M18, M20, M22 | – |
| ISO8677 | M10, M12, M16, M20, M5, M6, M8 | – | – | – |
| ISO8734 | 1, 1.5, 10, 12, 16, 2, 2.5, 20, 3, 4, 5, 6, 8 | – | – | – |
| ISO8735 | 10, 12, 16, 20, 25, 30, 40, 50, 6, 8 | – | – | – |
| ISO8740 | 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 4, 5, 6, 8 | – | – | – |
| ISO8741 | 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 4, 5, 6, 8 | – | – | – |
| ISO8742 | 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 4, 5, 6, 8 | – | – | – |
| ISO8743 | 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 4, 5, 6, 8 | – | – | – |
| ISO8744 | 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 4, 5, 6, 8 | – | – | – |
| ISO8745 | 1.5, 10, 12, 16, 2, 2.5, 20, 25, 3, 4, 5, 6, 8 | – | – | – |
| ISO8746 | 1.4, 1.6, 10, 12, 16, 2, 2.5, 20, 3, 4, 5, 6, 8 | – | – | – |
| ISO8747 | 1.4, 1.6, 10, 12, 16, 2, 2.5, 20, 3, 4, 5, 6, 8 | – | – | – |
| ISO8765 | M10, M12, M14, M16, M24, M27, M30, M33, M8 | – | M18, M20, M22 | – |

## Gesonderte Referenzen

- ISO1051: Durchmesserreihe; keine eigenständige vollständige Teilekontur.
- ISO7984: ungültiger Produktverweis; keine vollständige Teilefamilie.

## Grenzen der Auswertung

- DIN- und ISO-Ausgaben sowie Hersteller-Sortimente werden nicht gleichgesetzt.
- Ein fehlender Tabellenwert bedeutet eine Datenlücke; daraus folgt kein Normverbot.
- Modellannahmen für Radien, Bohrungsgründe oder Bundkonturen sind keine recherchierten Normmaße.
- Vollständige Längenmatrizen und unabhängige Zweitbelege bleiben dort offen, wo die Familien-Daten sie nicht nachweisen.
