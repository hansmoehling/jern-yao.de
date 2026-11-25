# 20MnB4: geprüftes Quellenprofil

Stand: 2026-11-25. Profil-ID: `komischke2019-20mnb4-normalized-rolled`.

## Primärbeleg

Tim Komischke, ETH-Dissertation 25968 (2019), *Experimental and virtual methods for the prediction of the onset of ductile fracture in cross rolling operations*: [institutioneller Eintrag](https://www.research-collection.ethz.ch/entities/publication/61878c52-524b-4808-ada5-d2c48ee2470d), [Original-PDF](https://www.research-collection.ethz.ch/server/api/core/bitstreams/5e3d6e74-1b84-4bc4-ae8f-af9c9502b524/content). Frei zugänglich; offene Nachnutzungslizenz nicht geprüft. Das PDF wird nicht im Website-Repository veröffentlicht.

Gedruckte Seitenangaben; PDF-Seiten jeweils +21:

| Beleg | Befund |
| --- | --- |
| S.53–54 | 20MnB4 nach EN10263-4:2002; normalisierend warmgewalzter Draht; ferritisch-perlitisch, etwa10µm; keine Vorverformung/Textur nachgewiesen. |
| S.56–61 | Reibungskorrigierter Druckversuch bis φ0,4. Identifikation bei90°C/0,1s⁻¹; Temperaturversuche bei0,1s⁻¹; Ratenversuche0,01/0,1/1/10s⁻¹ bei90°C. Bei1/10s⁻¹ nur φ≤0,2 wegen Eigenerwärmung. |
| S.61–63 | Text nennt20°C, Bild28 benennt25°C. Tabelle3 verlangt Kelvin. Hensel-Spittel-Anpassung verwendet nur φ>0,01. |
| S.63–66 | Torsion bis äußerer Vergleichsdehnung1,5; Vergleichsfaktor0,946, beiφ0,8 angepasst. Torsionsrate/-temperatur nicht angegeben. Härteprüfung stützt den Hochdehnungsverlauf. Hensel-Spittel wird dem sättigenden Hockett-Sherby vorgezogen. |

Gl.2.3.7, S.22, und Tabelle3, S.63, im Original visuell geprüft:

```text
kf = A * phi^n * exp(C/phi) * exp(m1*T_K) * strainRate^m2
A=1146.6 MPa; n=0.0944; C=-0.0055; m1=-0.001; m2=0.013
```

## Umsetzung und eigene Modellentscheidungen

Das Profil verwendet25°C (=298,15K) und0,1s⁻¹. Die Temperatur folgt der Beschriftung von Bild28; die abweichende Textangabe bleibt sichtbar. Einsetzen von20°C würde den Fit um0,5013% erhöhen. Das ausgewählte Profil rechnet keine Geschwindigkeitskorrektur oder Wärmeentfestigung für die Produktion.

Die Tabellenpunkte sind **berechnete Fitwerte**, keine Messpunkte. Vonφ0,01 bis0,1 wird im Abstand0,0005, danach bis1,5 im Abstand0,005 abgetastet. Dazu kommenφ0 und der Anfangswert. Insgesamt462 Punkte, stückweise lineare Interpolation; das Intervallintegral wird aus den linearen Abschnitten exakt berechnet.

Für0≤φ≤0,01 setzen wir konstant kf(0,01)=308,507035535MPa. Das ist eine eigene Startregularisierung: höher als der dort gegen0 kollabierende Originalfit, aber **keine nachgewiesene obere Schranke des wirklichen Anfangsfließens und kein gemessener Rp0,2**. Direkt gemessener Druckbereich und qualifizierte Modellfortsetzung werden getrennt geführt. Oberhalbφ1,5 ist keine Fortschreibung freigegeben.

Ein Inline-Vorzug darf als isotrope Näherung mitφ_pre=2ln(D_Walzdraht/d_Draht) berücksichtigt werden, wenn der Ausgangsdraht dem Quellenzustand entspricht. Kraft und Arbeit der folgenden Stufe verwenden das verschobene Intervall[φ_pre+φ_bisher, φ_pre+φ_bisher+Δφ]. Die gesamte kumulierte Dehnung bleibt≤1,5. Eine spätere Glühung hebt diese einfache Zustandsfortschreibung auf. Unbekannte Vorverformung, weich-/kugelgeglühter oder vergüteter Draht sind nicht automatisch dieses Profil.

## Unabhängige Zahlenprüfung

Python-Neuberechnung gegen die analytische Formel auf10000 gleichmäßig verteilten Intervallen (10001 Prüfstellen) über0..1,5: maximale relative Abweichung der gespeicherten Interpolation **0,0221111324%** beiφ0,0102; Ziel≤0,05% erfüllt. Die zunächst geprüfte Abtastung0,001 im unteren Bereich überschritt das Ziel und wurde deshalb auf0,0005 verfeinert. Die Zahlen unten beziehen sich auf die tatsächlich gespeicherten Tabellenpunkte.

| Größe | MPa |
| --- | ---: |
| kf(0)=kf(0,01), regularisiert | 308,507035535 |
| kf(0,1) | 628,985800351 |
| kf(0,4) | 747,119293505 |
| kf(1,0) | 821,369208544 |
| kf(1,5) | 854,983314724 |
| Mittelspannung0..0,1 | 520,689499094375 |
| Mittelspannung0..0,4 | 657,150844818694 |
| Mittelspannung0..1,5 | 770,882343726523 |
| Mittelspannung0,2..0,4 | 722,123206817 |

Prüfbeispiel Inline-Vorzug6,0→5,5mm: φ_pre=0,174022753979259. Für eine folgende Stufe mitΔφ0,3 ergibt das kf am Ende760,821952530009MPa und die Mittelspannung726,770827883943MPa. Die erste Stufe beginnt damit im verfestigten Zustand.

## Nicht als Ersatz verwendet

[Kocatürk et al.2021](https://popups.uliege.be/esaform21/index.php?id=4140) nennt für20MnB4 zugleich5mm/min und1/10/50s⁻¹, ohne den Widerspruch aufzulösen; der Ausgangszustand bleibt offen. Bei12mm Anfangshöhe entsprechen5mm/min zunächst0,006944s⁻¹. Diese Quelle liefert daher weder die gewählte Kurve noch einen belastbaren pauschalen Sicherheitsaufschlag. Keine Ersatzzuordnung von19MnB4,23MnB4 oder anderen Normqualitäten.
