# Fließkurven für die Möhling-Werkstoffe

Stand: 25.11.2026. Recherche und quellengebundenes Kurvenregister für die Vorauslegung.

## Ergebnis

**Ja, geeignete Literatur- und Versuchskurven sind auffindbar.** Bereits die vorhandene Sammlung enthält konkrete Anknüpfungen für **14 der 58 Katalogzeilen**. Darin enthalten sind zwei getrennte Katalogzeilen derselben Aluminiumlegierung 6082 und ein gesperrter Identitätskonflikt bei C45EC. Die Zahl bedeutet weder 14 unabhängige Messreihen noch 14 freigegebene Werkstoffe.

Zusätzliche Originalarbeiten belegen Versuche für C15C, 16MnCr5, CuZn37, AlMgSi1/6082, 1.4301 und Cu-ETP. Für C10C wurde im begrenzten Suchumfang noch keine exakt zuordenbare Kaltfließkurve nachgewiesen. Bei 23MnB4 fanden sich belegte **Warm**umformdaten; diese schließen die Kaltumformlücke nicht.

Für die manuelle Auswahl werden daraus **zwölf Katalogeinträge mit elf Literaturkurven im weichgeglühten Zustand** bereitgestellt. Die vollständigen 58 Katalogidentitäten bleiben als Wissensbasis erhalten. C45EC bleibt wegen des Nummernkonflikts gesperrt; AlMg3 fehlt ein belegter Anfangsbereich. Die 14 historischen C/n-Ansätze sind kein Kraftnachweis. Katalogidentität, Rm-Beleg und verwendbare Fließkurve bleiben getrennte Datensätze.

Das maschinenlesbare Register [fliesskurven.json](fliesskurven.json) enthält die ausgewählten Zahlen, Zustände, Quellen und Bereichsgrenzen. Acht Profile verwenden veröffentlichte Tabellenpunkte, drei den ausdrücklich belegten Potenzansatz mit einem dokumentierten linearen Anfangsanschluss. Keine Ersatzkurve aufgrund bloßer Sortenähnlichkeit wurde aktiviert.

## Zuerst geprüft: Konzept und vorhandene Literatur

Gelesen wurden `Konzept/howtounderstandthisproject.aktuell.md`, `regeln.md`, `wissenskarten.md`, `Literaturinventar.md`, die entpackte Wissensbasis sowie der vorhandene TKG-Kalkulator. Regel R-KF verweist für die bisherigen C/n-Werte auf diesen Kalkulator, nicht auf individuell zugeordnete Messreihen. Dort fehlen Temperatur, Dehnrate, genauer Ausgangszustand und eine Prüfquelle je Kurve.

Die lokalen PDFs unter `Downloads/Literatur_Sandra` sind inzwischen besser zugänglich als im alten Konzeptinventar beschrieben: Tschätsch hat lokal eine vollständige Textschicht über 370 PDF-Seiten, Dietrich über 480 und Lange über 534. Die früheren Angaben „Tschätsch ab S. 71 nicht erreichbar“ beziehungsweise „Dietrich Scan nicht lesbar“ betreffen den damaligen Connectorzugriff. Die entscheidenden Tabellen und Diagramme wurden zusätzlich als Seitenbild geprüft.

### Lokale Fundstellen

| Kennung | Original in der Sammlung | Genaue Fundstelle | Belegumfang |
|---|---|---|---|
| L1 | Lange, Kammerer, Pöhlandt, Schöck: *Fließpressen*, 2008; `epdf.pub_fliepressen-wirtschaftliche-fertigung-metallischer-przisionswerkstcke.pdf` | Buch S. 483–486 / PDF 494–497; besonders Tabelle 10.1, Buch S. 485 / PDF 496 | 21 typische Kurvenzeilen geglühter Fließpresswerkstoffe bei Raumtemperatur; Potenzansatz und teilweise ausdrückliche Umformgradgrenzen. Rückverweise auf Lange 1988 und Tschätsch 1990. |
| L2 | Dietrich: *Praxis der Umformtechnik*, 12. Auflage, 2018; `Dietrich_Praxis_der_Umformtechnik_12_Auflage.pdf`; [Buch-DOI](https://doi.org/10.1007/978-3-658-19530-4) | Tabelle 2.1, Buch S. 7 / PDF 19; Tabelle 31.1, Buch S. 446 / PDF 456; Tabelle 31.2, Buch S. 447 / PDF 457; Tabelle 31.3, Buch S. 449 / PDF 459 | Weichgeglühte Punktkurven, Parameter, Alt-/Neubezeichnungen und Werkstoffnummern. |
| L3 | Tschätsch: *Praxiswissen Umformtechnik*, 5. Auflage, 1997; `Tschaetsch_Praxiswissen_Umformtechnik_1997.pdf` | Tabelle 1, Buch S. 305 / PDF 315; Diagramme Buch S. 306–322 / PDF 316–332 | Diagramme ausdrücklich „weichgeglüht“. Für die Potenzprofile außerdem Ck15/Cq15 S. 307 / PDF 317, 34Cr4 S. 312 / PDF 322 und Al99,5 S. 314 / PDF 324 visuell geprüft; durchgezogene und gestrichelte Bereiche getrennt. |
| L4 | WAFIOS: *Grundlagen Umformtechnik*, 2011; `WAFIOS_2011_Grundlagen_Umformtechnik_Original.pdf` | PDF 10 | Drei Parameterzeilen, aber keine direkten Treffer der aktuellen 58 Katalogzeilen. Insbesondere 20MnCr5 ist kein Ersatz für 20MnB4. |

### 14 Katalogzeilen mit konkreter Literatur-Anknüpfung

`C` in N/mm², `n` dimensionslos. Die Parameter bezeichnen den jeweiligen Literaturansatz `kf = C · φ^n`; ein separat genannter Anfangswert `kf0` ist nicht dessen mathematischer Wert bei φ = 0. **Numerisch nutzbar** bedeutet hier: Quelle enthält auswertbare Zahlen innerhalb ihres Umfangs. Es bedeutet keine automatische Freigabe für beliebigen Draht oder Pressentakt.

| Katalogzeile | Gefundene Daten | Zustand / Fundstelle | Numerisch nutzbar und Grenze |
|---|---|---|---|
| C4C, 1.0303 | Diskrete kf-Werte, φ = 0,1 bis 1,6; kf0 = 250 | Weichgeglüht; L2, Tab. 31.1 | Ja, als tabellierte Literaturkurve; Dehnrate nicht ausgewiesen. |
| C15C, 1.0234 | C = 760; n = 0,165; kf0 = 280 | L2, Tab. 2.1 / 31.2 nennt C15C zusammen mit C15E; L3 weichgeglüht | Ja, als benannte Literaturkurve. Besser abgegrenzter Primärbeleg W1 unten. Keine globale Gleichsetzung aller C15-Bezeichnungen. |
| C15E2C, 1.1132 | Eigene Punktkurve bis φ = 1,6; kf0 = 280 | Weichgeglüht; L2, Tab. 31.1 | Ja. Eigene Zeile, keine aus C15C geratene Zuordnung. |
| C35EC, 1.1172 | Eigene Punktkurve bis φ = 1,6; kf0 = 340 | Weichgeglüht; L2, Tab. 31.1 und 31.3 | Ja. Die ausdrücklich benannte Punktkurve hat Vorrang vor einer bloß ähnlichen C35E/C35C-Bezeichnung. |
| C45EC, Katalog 1.1192 | Benannte Punktkurve bis φ = 1,6; kf0 = 390 | Weichgeglüht; L2, Tab. 31.1 | **Gesperrt für automatische Zuordnung:** L2, Tab. 31.3 nennt für C45EC 1.1197. Widerspruch zur Katalognummer zuerst auflösen. |
| 34Cr4, 1.7033 | C = 970; n = 0,118; kf0 = 410 | L2, Tab. 31.2; L3 weichgeglüht; L1 rundet n auf 0,12 | Ja, Literaturzustand; genaue Dehnrate fehlt. |
| 34CrMo4, 1.7220 | Eigene Punktkurve bis φ = 1,6; kf0 = 410 | Weichgeglüht; L2, Tab. 31.1 | Ja. Nicht die 34Cr4-Parameter verwenden. |
| 42CrMo4, 1.7225 | C = 1100; n = 0,149; kf0 = 420 | Weichgeglüht; L2, Tab. 31.2; L3 S. 313; L1 n = 0,15 | Ja, Literaturzustand. Kein Ersatz für +QT. Primärfund W5 ist aus den dort genannten Gründen gesperrt. |
| 16MnCr5, 1.7131 | L1: C = 810; n = 0,09; kf0 = 380; ausdrücklich φ = 0,1–0,7. L2: abweichende Punktkurve | Geglüht / Raumtemperatur, L1; weichgeglüht, L2 Tab. 31.1 | Ja, **Quellen getrennt halten**. Nicht über φ = 0,7 hinaus blind verlängern. W1/W2/W3 bieten zusätzliche Versuchsbezüge. |
| CuZn37, 2.0321 | C = 880; n = 0,4326 (L3), gerundet 0,433 (L2); kf0 = 280 | Weichgeglüht; L3 S. 320, L2 Tab. 31.2 | Ja. Nicht auf CuZn36 oder CuZn5 übertragen. |
| Al 99,5, 3.0255 | L2: EN AW-1050A, C = 150; n = 0,222; kf0 = 60. L1 enthält zusätzlich C = 110 / n = 0,24 | Weichgeglühter Literaturzustand; L2 S. 7 / 447 und L1 | Ja, **alternative Quellenkurven erhalten**, nicht mitteln. |
| AlMgSi 1, 3.2315 | C = 260; n = 0,197; kf0 = 130; Punktkurve bis φ = 4 | Weichgeglüht; L3 S. 315; L2 explizit EN AW-6082 | Ja, für diesen Literaturzustand; nicht T6. |
| AlSi1MgMn, EN AW-6082 | Dieselbe ausdrücklich zugeordnete 6082-Kurve | L2 Tab. 2.1 / 31.2 | Ja; zweite Katalogidentität, keine zweite unabhängige Versuchskurve. |
| AlMg 3, 3.3535 | C = 390; n = 0,19; ausdrücklich φ = 0,2–1,0 | Geglüht / Raumtemperatur; L1 Tab. 10.1 | Ja, innerhalb des Intervalls; kf0 und numerische Dehnrate fehlen. |

Diese Tabellen liefern eine nutzbare Grundlage für **zustandsbezogene Literaturprofile**. Sie liefern keine numerisch belegte Temperatur- oder Dehnratenabhängigkeit. „Raumtemperatur“ wird deshalb nicht nachträglich als nachgewiesener Versuch bei exakt 20 °C und 1 s⁻¹ etikettiert.

## Gezielte Originalarbeiten im Web

### W1 — C15C und 16MnCr5: exakter Werkstoff- und Zustandsbezug

Christoph Kiener, *Kaltfließpressen von gerad- und schrägverzahnten Zahnrädern*, FAU, 2020. [DOI und Universitätsnachweis](https://doi.org/10.25593/978-3-96147-288-8), [Original-PDF](https://open.fau.de/server/api/core/bitstreams/43d1ccaf-d7c1-4711-91c3-aae8e711226d/content).

**Buch S. 25–26 / PDF 39–40, Abschnitt 4.1.1, Tabelle 1, Bild 2.** C15C ausdrücklich **1.0234 im GKZ-geglühten Ausgangszustand**, daneben die Vergleichssorte 16MnCr5 **1.7131**. DIN-50106-Stauchversuch, fünf Proben, Traverse 5 mm/min, Messbereich bis φ = 0,8; darüber Hockett–Sherby-Extrapolation. Genannte Endwerte bei φ = 0,8: C15C rund 709 MPa, 16MnCr5 rund 810 MPa. **Numerisch: ja als Diagramm-/Stützstellenquelle; keine vollständige digitale Kurventabelle entnommen.** 5 mm/min ist keine konstante Dehnrate in s⁻¹. Eine numerische Prüftemperatur wird auf diesen Seiten nicht angegeben; Hochgeschwindigkeitsübertragung bleibt offen.

### W2 — 16MnCr5, CuZn37 und AlMgSi1: Versuchs- und Extrapolationsbereich getrennt

Rohrmoser, Hagenah, Merklein, 2021: [Originalarbeit](https://link.springer.com/article/10.1007/s00170-020-06449-6), [PDF](https://link.springer.com/content/pdf/10.1007/s00170-020-06449-6.pdf).

**S. 1835 / PDF 3, Abschnitt 3.1.1, Bild 2.** DIN-50106-Stauchversuche bis φ = 0,8 bei genannter Dehnrate 0,0067 s⁻¹; höhere Umformgrade extrapoliert. Die bei φ = 1 genannten 915 / 770 / 371 MPa sind deshalb **Extrapolationswerte**, keine direkt gemessenen Punkte. **Numerisch: Diagramme auswertbar, Zustands- und Temperaturzuordnung vor Übernahme vervollständigen.** Das Modell behandelt das Material dehnratenunabhängig.

Ergänzende Originalarbeit derselben Forschungsrichtung: Rohrmoser/Merklein, [2022 online / 2023, Abschnitt 2.3 und Bild 4](https://link.springer.com/article/10.1007/s11665-022-07251-z). Sie benennt **16MnCr5 +A**, CuZn37 und **AlMgSi1 T6**; gemessen bis ε = 0,8 und extrapoliert bis 4. Diese T6-Kurve ist kein Ersatz für die weichgeglühte 6082-Literaturkurve. Bild-Parameter wurden hier nicht visuell vollständig verifiziert und werden nicht als übernommener Zahlensatz behauptet.

### W3 — 16MnCr5 mit Temperatur- und Dehnrateneinfluss

Şimşir/Duran, *A flow stress model for steel in cold forging process range and the associated method for parameter identification*, [Originalpublikation](https://link.springer.com/article/10.1007/s00170-017-1160-x), 2018, S. 3795–3808.

Der frei lesbare Autorenabstract belegt Druckversuche im Bereich **25–400 °C und 0,01–40 s⁻¹**, ein Modell für dynamische Reckalterung und eine Prüfung am Vorwärtsfließpressprozess. **Numerisch derzeit nein:** Der frei geprüfte Verlagszugang enthält keine vollständig verifizierte Parametertabelle oder Zustandsbeschreibung. Eine geeignete Beschaffungsquelle für dynamische Daten, kein bereits eingelesener Datensatz. Nicht aus einem Abstract C/n ableiten.

### W4 — 1.4301: Kaltversuche und begrenzte Swift-Extrapolation

Selbmann et al., 2021: [Originalarbeit](https://link.springer.com/article/10.1007/s00419-021-01937-x), [PDF](https://link.springer.com/content/pdf/10.1007/s00419-021-01937-x.pdf).

**S. 3629 / PDF 3:** Proben 12 × 32 mm, 1050 °C / 15 min geglüht, anschließend an ruhender Luft abgekühlt; Umformversuche bei 20 °C. **S. 3631 / PDF 5, Bild 4:** Fließkurve bei **20 °C, 0,1 s⁻¹**; Messdaten bis φ = 0,35, danach Swift-Extrapolation. Parameter C1 = 1220,352, C2 = −0,225, C3 = 0,104 sind veröffentlicht. **Numerisch bedingt:** Kurve und Extrapolation sind verfügbar, aber keine drei austauschbaren Hollomon-Werte. Die angegebene negative Verschiebung verbietet eine blinde Fortsetzung zum Ursprung. Die Autoren berücksichtigen die Phasenumwandlung noch nicht im Materialmodell. Vor Einbau vollständige Gleichungsform und Rohdaten unter φ = 0,35 prüfen.

### W5 — 42CrMo4: Originalquelle gefunden, für Einbau gesperrt

Dziubińska/Gontarz/Winiarski, 2014: [Original-PDF](https://www.astrj.com/pdf-216-205?filename=FLOW-STRESS-MODEL-FOR-COL.pdf), DOI 10.12913/22998624.1091875, S. 31–35.

**PDF 2 / S. 32:** 40HM wird 42CrMo4 zugeordnet; Druckproben 10 × 20 mm, Raumtemperatur, Vergleich unbehandelt mit 680 °C / 0,5 h weichgeglüht und im Ofen abgekühlt. Der Satz zur mittleren Dehnrate enthält im Original **keinen Zahlenwert**. **PDF 3 / S. 33, Bild 4, Tabelle 2, Gleichungen 3/4:** Tabelle nennt A = 230,7450 / B = 0,1903 und A = 224,8095 / B = 0,4941. Bei ε = 1 liefert der zweite Ansatz 224,8095 MPa, während Bild 4 für die geglühte Probe ungefähr 177 MPa zeigt. **Numerisch nein für unsere Auslegung**, bis dieser innere Widerspruch und die fehlende Dehnrate geklärt sind. Die Originalseiten wurden visuell geprüft; kein OCR-Dezimalfehler als Ursache unterstellt.

### W6 — Cu-ETP und Al1050: Raumtemperatur im Versuchsfeld enthalten

Vuppala et al., RWTH Aachen, 2021: [FepiM-Originalarbeit](https://www.mdpi.com/2075-4701/11/4/602), DOI 10.3390/met11040602.

**Abschnitte 4.1–4.3 und Datenverfügbarkeit:** Druckversuche umfassen **20, 100, 200, 300, 400, 500 °C**. Cu-ETP wurde bei **0,01 / 0,1 / 1 s⁻¹** geprüft, Aluminium zusätzlich bei 10 und 100 s⁻¹. Kupferproben 10 × 15 mm; Rastegaev-Geometrie und Reibungs-/Temperaturkorrektur. Die gezeigten Beispielkurven betreffen überwiegend 300–500 °C. **Numerisch derzeit nein für 20 °C:** Die vollständigen Daten sind laut Autoren auf Anfrage erhältlich; der genaue Ausgangszustand und die vollständige 20-°C-Punktreihe sind nicht aus den Beispielbildern zu ersetzen. Keine Anfrage versandt.

### W7 — 23MnB4: bewusst ausgeschlossener Warmfund

[Originalbeitrag METAL 2015: *Formability of steels for rolling of wire rod*](https://www.confer.cz/metal/2015/download/2218-formability-of-steels-for-rolling-of-wire-rod.pdf), Tabellen 2/3 und Bilder 5/6. Die gefundenen Parameter gelten für **850–1150 °C**, Umformgrade 0,05–2,0 und Dehnraten 0,01–10 s⁻¹. **Nein für Kaltumformung.** Der exakte Sortenname allein berechtigt nicht zur Verwendung bei Raumtemperatur. Für C10C und eine passende kalte 23MnB4-Lieferzustandskurve bleibt der Nachweis im begrenzten Suchumfang offen; dies ist keine Behauptung, dass solche Daten nicht existieren.

## Gibt es eine übersichtliche Kurvenbibliothek?

| Quelle | Verifiziertes Angebot | Für unser Projekt noch zu prüfen |
|---|---|---|
| [StahlDat SX / Matplus](https://stahldaten.de/stahldat-sx/flow-curves-database/) | Mehr als 500 Datensätze für mehr als 150 Stähle und mehrere Wärmebehandlungszustände; Herkunft Institut für Metallformung, TU Bergakademie Freiberg; temperatur-, umformgrad- und dehnratenabhängiger Hensel-Spittel-Ansatz | Konkrete Kurvenabdeckung der Möhling-Sorten und Zustände, Export und Nutzungsrecht. Die öffentliche [Werkstoffliste](https://stahldaten.de/stahldat-sx/material-list/) ist **kein** Nachweis, dass jeder gelistete Stahl eine kalte Fließkurve besitzt. Datensätze benötigen Login; Fließkurvenlizenz separat prüfen. |
| [MatILDa / GMT, über KOCKS](https://www.kocks.de/de/consulting/) | Anbieter bestätigt experimentell basierte Werkstoffdaten, Fließkurven und Schnittstellen für FEM | Sorten-/Zustandsliste, Temperaturbereich, Punktdatenexport, Lizenz für Website-Backend. Keine bestätigte Vollabdeckung unserer 58 Zeilen. |
| [QForm-Materialdatenbank](https://docs.qform3d.com/qform/en/material_database.htm) | Herstellerdokumentation beschreibt mehr als 200 Stahl-/Legierungsmodelle für Warm- und Kaltumformung und tabellierte Kurven | Vorhandene Softwarelizenz, konkret gelieferte Daten und Wiederverwendungsrechte. Die Gesamtzahl belegt keine Eignung eines konkreten Datensatzes. |

StahlDat SX ist der konkret belegte Einstieg für eine systematische Stahlkurvenbibliothek. MatILDa ist wegen verschiedener Metallgruppen ebenfalls ein sinnvoller Prüfpunkt. Es wurde weder ein Konto eröffnet noch eine Lizenz gekauft oder ein fremder Datensatz ins Produkt kopiert.

## Bereitgestellter Rechenansatz

Die folgenden zwölf Katalogzeilen werden aus elf voneinander getrennten Literaturprofilen bedient. Der Zustand lautet immer **weichgeglüht**. Die Auswahl ist ein dokumentierter Ansatz zur Vorauslegung; für bereits gezogenen oder vergüteten Draht ist sie keine automatische Zustandszuordnung.

| Katalogzeile / Nummer | Aktives Profil | Verwendeter Bereich φ |
|---|---|---|
| C4C / 1.0303 | Dietrich Tab. 31.1, Punkte einschließlich kf0 = 250 | 0–1,6 |
| C15C / 1.0234 | C760, n0,165, kf0 = 280; Dietrich und Tschätsch S. 307 | Potenzfunktion 0,1–1,0; linearer Anschluss 0–0,1 |
| C15E2C / 1.1132 | Dietrich Tab. 31.1, eigene benannte Punktkurve, kf0 = 280 | 0–1,6 |
| C35EC / 1.1172 | Dietrich Tab. 31.1, kf0 = 340 | 0–1,6 |
| 34Cr4 / 1.7033 | C970, n0,118, kf0 = 410; Dietrich und Tschätsch S. 312 | Potenzfunktion 0,1–0,8; linearer Anschluss 0–0,1 |
| 34CrMo4 / 1.7220 | Dietrich Tab. 31.1, kf0 = 410 | 0–1,6 |
| 42CrMo4 / 1.7225 | Dietrich Tab. 31.1, kf0 = 420 | 0–1,6 |
| 16MnCr5 / 1.7131 | Dietrich Tab. 31.1, kf0 = 380; kein Mischen mit Lange | 0–1,6 |
| CuZn37 / 2.0321 | Dietrich Tab. 31.1, kf0 = 280 | 0–2,0 |
| Al99,5 / 3.0255 | C150, n0,222, kf0 = 60; Dietrich und Tschätsch S. 314 | Potenzfunktion 0,1–1,0; linearer Anschluss 0–0,1 |
| AlMgSi1 / 3.2315 | Dietrich Tab. 31.1, EN AW-6082, kf0 = 130 | 0–4,0 |
| AlSi1MgMn / EN AW 6082 | dasselbe 6082-Profil | 0–4,0 |

**Interpolation ist Teil des Modells:** Tabellenwerte werden stückweise linear verbunden, einschließlich des separat belegten Anfangswerts. Bei den drei Potenzprofilen verbindet eine Gerade den belegten Wert kf0 mit `C · 0,1^n`. Dieser kurze Anfangsanschluss ist eine offen benannte technische Näherung, keine zusätzliche Messreihe. Bei C15C, 34Cr4 und Al99,5 endet der freigegebene Potenzbereich spätestens am Übergang zur gestrichelten Fortsetzung des Originaldiagramms. Der Anschluss wird im Datensatz ausdrücklich als `startMode: linear-to-phiMin` geführt.

Die Tabellenwerte aus Dietrich werden als **veröffentlichte Literaturwerte** bezeichnet. Die Tabelle markiert nicht jeden Punkt als gemessen oder extrapoliert; daher wird keine durchgängige Messvalidierung bis zum Tabellenende behauptet. Es wird weder über das Tabellenende hinaus verlängert noch auf andere Lieferzustände übertragen.

## Umsetzung und Grenzen des Kraftansatzes

1. **Zustand als Teil der Identität:** Normsorte, Werkstoffnummer, Produktform, GKZ/+AC/+A/O/T4/T6/+QT, vorheriges Ziehen und Wärmebehandlung getrennt speichern. Eine Kurve gehört zu einem solchen Profil und nicht bloß zum Dropdownnamen.
2. **Modellform erhalten:** Der bisherige Ansatz `C * max(phi, 0.025)^n` mit zusätzlichem Offset `+0.025` an beiden Enden der bisherigen Mittelwertberechnung bildet den Literaturansatz nicht korrekt ab. Die neuen Profile benötigen die unveränderte Potenzform beziehungsweise stückweise lineare Punkte und das Integral über den tatsächlichen Umformgradbereich. `kf0` wird separat behandelt; ein bloßer Austausch zweier C/n-Zahlen ist ausgeschlossen. Swift und Hockett–Sherby sind andere Modellfamilien und werden nicht in einen Hollomon-Adapter gezwängt.
3. **Geltungsbereich führen:** Gemessener φ-Bereich, Bereich eines Fits, Extrapolation, Temperatur und Dehnrate müssen unterscheidbar sein. 5 mm/min nicht ohne Probengeometrie und Hubverlauf in eine konstante s⁻¹-Angabe verwandeln.
4. **Zahlen prüfen:** Diagramme kontrolliert digitalisieren oder Rohdaten beschaffen; Einheiten und mehrere Prüfpunkte gegen das Original testen. Punktkurven nicht ohne dokumentierte Anpassung in einen Hollomon-Zweiparameteransatz pressen. Quellabweichungen nicht mitteln.
5. **Gültigkeit im Ergebnis führen:** Die elf ausgewählten Literaturprofile erhalten die Kennzeichnung `approval: literature` und sind ausschließlich mit ihrem Zustand und Bereich als Rechenansatz zugelassen. Für schnelle Pressen bleiben Erwärmung, Geschwindigkeit und Lieferzustand zusätzliche Prüfgrößen. Die übrigen Funde sind Recherchekandidaten. Kraft aus Materialdaten allein ist noch keine Presskraft: Geometrie, Umformpfad, Reibung, Werkzeugkontakt und gleichzeitig wirkende Stationen müssen zusätzlich zum gewählten Kraftmodell passen.

## Gegenprüfung des Kurvenregisters

Alle elf Profile wurden gegen die genannten Tabellen beziehungsweise Diagramme geprüft. Die zwölf Werkstoffnummern stimmen exakt mit dem Katalogregister überein; alle Quellenkennungen sind aufgelöst. Anfangswerte sind positiv, Stützstellen geordnet und Fließspannungen monoton. Die numerische Integration wurde für jedes Profil über vier unterschiedliche Intervalle gegen eine unabhängige Mittelpunktsquadratur mit jeweils 20.000 Teilintervallen geprüft: **44 Gegenprüfungen**, größte Abweichung rund **1,2 · 10⁻⁷ N/mm²**. Bereichsüberschreitungen liefern keine numerische Fließspannung. Diese Prüfung bestätigt die Umsetzung der Kurven, nicht die Genauigkeit eines vollständigen Werkzeug- oder Prozessmodells.

## Geprüfte Ersatzkurven: derzeit keine Freigabe

Ähnliche Chemie, ähnliche Zugfestigkeit oder ein benachbarter Sortenname genügen nicht, um den ganzen Verfestigungsverlauf zu übertragen. Eine brauchbare Ersatzkurve benötigt mindestens einen nachgewiesenen vergleichbaren Ausgangszustand und einen belastbaren Vergleich des kf-Verlaufs im verwendeten Umformbereich. Für die konkret offenen Borstähle und C10C wurde eine solche Übereinstimmung in den folgenden Quellen nicht gefunden:

- **27MnB4 als möglicher 23MnB4-Nachbar:** Akyıldız et al., 2023, [Original-PDF](https://dergipark.org.tr/en/download/article-file/2485489), DOI 10.36306/konjes.1130504. PDF S. 4 beschreibt 14-mm-Draht und unterschiedliche Streckgrenzen nach Warmwalzen, Weichglühen und Kugelkarbidglühen. Eine vollständige numerische Fließkurve für eine überprüfbare Übertragung ist nicht zugänglich; PDF S. 11 nennt die zugrunde liegenden Daten vertraulich. Keine 23MnB4-Ersatzkurve aktiviert.
- **20MnB4/23MnB4 und C10C/C10E2C:** Das [Originaldatenblatt von British Steel, PDF S. 2](https://www.britishsteel.co.uk/wp-content/uploads/2026/02/cold-heading-datasheet.pdf) belegt benachbarte chemische Zusammensetzungen und Zugfestigkeitsangaben für warmgewalzte Produkte. Es enthält keinen vergleichenden kalten kf-Verlauf. Keine Übertragung von C10E auf C10C oder eines Borstahls auf einen anderen.
- **AlMg3:** Der belegte Ansatz beginnt erst bei φ = 0,2; Anfangswert und Anfangsverlauf fehlen. Ohne diese Ergänzung keine Berechnung der ersten Stufe. Das Material bleibt deshalb trotz direktem Literaturtreffer aus der aktuellen Auswahl.

## Begrenzung und nächster sinnvoller Schritt

Die Suche konzentrierte sich auf vorhandene Literatur und die genannten repräsentativen Sorten. Es erfolgte **keine vollständige Einzelrecherche aller 58 Zeilen**, keine vollständige OCR aller Hilgeland-Scans und keine erneute Auswertung sämtlicher 193 Einzelanlagen. Keine Behauptung vollständiger Abdeckung.

Das getrennte Kurvenregister liegt jetzt vor. Die nächsten Erweiterungen betreffen zusätzliche Lieferzustände, nachvollziehbare Daten für C10C und Borstähle sowie dynamische Daten für schnelle Pressen. Dafür eignen sich gezielte Lieferanten-/Institutsdaten oder eine geprüfte Bibliothekslizenz; die Recherchelücke wird nicht durch Zugfestigkeit als Ersatz für eine Fließkurve geschlossen.
