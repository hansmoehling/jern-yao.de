# Werkstoffe und maschinenbezogene Stadienkonzepte

Technische Konzept-Ergänzung · Stand 25.11.2026

Die Erweiterung verbindet einen quellengebundenen Werkstoffkatalog mit nachvollziehbaren Stadienfolgen je Maschinenkandidat. Fehlende Werkstoffdaten bleiben sichtbar. Eine geometrisch mögliche Folge ist noch keine Freigabe von Kraft, Werkzeug oder Serienprozess.

## Werkstoffdaten und Geltungsbereich

Alle **58 Katalogidentitäten** der [Möhling-Materialübersicht](https://moehling.com/de/produkte/materialien.html) sind mit Originalname, Werkstoffnummer und Kataloggruppe erfasst. Historische Benennungen und doppelte Katalogzeilen bleiben erhalten; die Zahl bezeichnet nicht zwingend 58 verschiedene Legierungen.

| Rechercheabdeckung | Stand |
|---|---:|
| Zustandsbezogene Kennwertzeilen | 386 |
| Katalogeinträge mit mindestens einem Zahlenbeleg | 50 |
| Einträge mit Zugfestigkeitsbeleg Rm | 48 |
| Einträge mit Dehngrenzenbeleg Rp0,2 | 33 |
| Einträge mit Dichtebeleg | 30 |
| Literaturprofile für die Vorauslegung, jeweils weichgeglüht | 12 |
| Damit auswählbare Katalogeinträge | 13 |
| Zusätzliche eigenständige Auswahl AISI 1010, gezogen | 1 |

Jeder Zahlenbeleg nennt Quelle, Einheit, Lieferzustand, Produktform und den belegten Abmessungsbereich beziehungsweise dessen fehlende Spezifikation. Mindestwerte, Höchstwerte, Bereiche und typische Werte werden unterschieden. Vergütete Stäbe, einsatzgehärtete Proben oder Walzband liefern keine automatisch gültigen Kennwerte für geglühten Kaltstauchdraht. Herstellerreferenzen und berechnete Nenndichten sind keine Chargenmessungen.

Die **14 ungeprüften Bestandsmodelle** bleiben ausschließlich historische Daten und berechtigen nicht zur Kraftberechnung. Das manuelle Dropdown enthält die dreizehn Katalogeinträge mit einem quellengebundenen Literaturprofil: C4C, C10C, C15C, C15E2C, C35EC, 34Cr4, 34CrMo4, 42CrMo4, 16MnCr5, CuZn37, Al99,5 sowie die zwei erhaltenen 6082-Katalogzeilen. Bei diesen gehört der weichgeglühte Ausgangszustand zur Auswahl. Zusätzlich steht **AISI 1010 – gezogen (Literaturzustand)** zur Verfügung. Die vollständigen 58 Katalogidentitäten bleiben unverändert als Wissensbasis erhalten; AISI 1010 wird separat geführt und keinem EN-Werkstoff gleichgesetzt.

Aus Rm, Rp0,2 oder Härte allein wird keine Fließkurve abgeleitet. C45EC bleibt wegen eines Werkstoffnummernkonflikts ausgeschlossen; Borstähle erhalten ohne passenden Nachweis auch keine Ersatzkurve. **C10C besitzt jetzt einen direkten Literaturfit aus Stauchversuchen an geglühtem QSt36-3/1.0214 (Önder2004)** und benötigt keinen C15C-Ersatz. Für Werkstoffe ohne passende Kurve können Abschnitt und Stadien geometrisch bestimmt werden; Kraft und Werkzeugdruck bleiben offen. Für eine Abschnittsberechnung aus Masse ist außerdem eine belegte Dichte erforderlich. Frühere C10C-Livetests aus der Inbetriebnahme belegen lediglich den damaligen technischen Datenfluss und gelten nicht als Nachweis dieses neuen Kurvenprofils.

Die zwölf Profile verwenden acht veröffentlichte Punktkurven und vier Potenzansätze mit dokumentiertem linearem Anfangsanschluss. Anfangswert, Modellform und Umformgradgrenzen bleiben erhalten; es gibt keine automatische Extrapolation. Details, die Unschärfe des historischen C15C-Namensmappings und verworfene Ersatzkurven stehen in [Fließkurven-Recherche](Fliesskurven_Recherche_20261125.md), die exakten Daten in [fliesskurven.json](fliesskurven.json).

Das dreizehnte Profil verwendet für AISI 1010 das [Swift-Modell von Rosochowska et al. (2009)](https://strathprints.strath.ac.uk/13927/1/Rosochowska_FiniteElementAnalysisod_ColdForwardExtrusionof_1010Steel_1_.pdf): `kf = 680 · (0,1 + φ)^0,29 MPa`, Rastegaev-Druckversuch an gezogenem Stabmaterial bei Raumtemperatur, mittlere Versuchsdehnrate 0,0336 s⁻¹. Die Rechnung ist auf den gemessenen Bereich φ = 0…1,5 begrenzt und integriert das Swift-Modell exakt. Ziehgrad und Wärmebehandlung sind nicht vollständig dokumentiert. Keine weichgeglühte Ersatzkurve, kein C10C-Alias und keine Geschwindigkeitskorrektur. Die Quelle liefert keine Dichte; Teilemasse und werkstoffspezifische Umformgrenzen bleiben entsprechend offen beziehungsweise vorläufig.

## Offene Identitätsfrage NiFe 47

Der Katalog führt **NiFe 47 / 2.4478**. Das [Originaldatenblatt von Deutsche Nickel](https://www.deutsche-nickel.de/fileadmin/user_upload/download/Datenblaetter_deutsch/Deutsche-Nickel-GmbH-Technisches-Datenblatt-Ni-52.pdf) ordnet 2.4478 dagegen **Ni 52 / Dilaton 51** zu. Die gewünschte Legierung muss deshalb geklärt werden. Der Katalogeintrag bleibt unverändert; Kennwerte von Ni 52 werden nicht unter NiFe 47 eingesetzt.

Eine andere Zuordnung ist belegt: AlMgSi 1 / 3.2315 und AlSi1MgMn / EN AW 6082 verweisen auf dieselbe 6082-Legierung. Beide Katalogzeilen bleiben nachvollziehbar erhalten; die Zuordnung ist im [Elisental-Drahtdatenblatt](https://www.elisental.de/files/bilder_elisental/produkte/aluminiumdraehte/legierungen/de/DE_Datenblatt_Draehte_6082_kurz_DE.pdf) dokumentiert. A2 und A4 gelten nicht als eindeutige Werkstoffidentitäten.

## Stadienkonzept je Maschinenkandidat

Das Konzept ordnet die berechnete Basisfolge einer konkreten Katalogmaschine zu. Es zeigt Abschnittdurchmesser und -länge, die benötigten und verfügbaren Stationen sowie je Stufe **Operation und Lage am Teil**. Kombinierte Vorgänge bleiben als solche erkennbar. Feste Maschinenkriterien werden gegen die konkreten Katalogdaten geprüft; eine ungeeignete Maschine erhält keine zugeordnete Folge.

Zusätzliche Maschinenstationen erscheinen als **Reserve**. Sie erzeugen keine erfundenen Zwischenformen. Bindet eine Stationsvorgabe weitere Plätze, bleibt deren Operation ausdrücklich festzulegen. Gleiches gilt für angeforderte Zusatzoperationen und deren Lage. Mehrere geeignete Maschinen können daher dieselbe berechnete Basisfolge mit unterschiedlicher Reserve zeigen; eine eigenständige Prozessoptimierung je Maschine wird damit nicht behauptet.

Zur belastbaren Auslegung gehören anschließend die Bestätigung von Werkstoff und Lieferzustand, passende Fließdaten, Zeichnungsprüfung sowie die Prüfung von Zwischenformen, Werkzeugaufbau, Transfer und Prozessversuch.

Die manuelle Auslegung im Manual unterscheidet inzwischen Torx, Innensechskant, Phillips und Pozidriv. Profilgröße und Tiefe bleiben in der Maschinenfolge nachvollziehbar; unbekannte Vertiefungsvolumina und profilabhängige Kräfte werden nicht durch Sechskantwerte ersetzt. Die [technische Ergänzung zu Innenantrieben und Inbetriebnahme](Innenantriebe_inbetriebnahme_20261125.md) beschreibt das Modell, seine Grenzen und den kontrollierten PDF-Test des verbundenen Dienstes.

## Fünf Sprachen

Die Oberfläche und technischen Auslegungstexte unterstützen **Deutsch, Italienisch, Slowenisch, Englisch und vereinfachtes Chinesisch**. Dazu gehören Regeln, Fehl- und Offenhinweise sowie Operationen, Positionen und Konzeptbegründungen. Dynamische Textschablonen erhalten Zahlen, Einheiten, Werkstoffnamen und Maschinenkennungen; freie Nutzereingaben werden nicht automatisch übersetzt.

## Nachweise und Datenpflege

Die vollständigen Belege und Einschränkungen stehen im [Quellenregister](werkstoffe-quellen.md); die maschinenlesbaren Einzelwerte in [werkstoffe-recherche.json](werkstoffe-recherche.json). Die Recherche enthält auch nicht übernommene Kandidaten: Beispielsweise beschreibt die [C15-Studie zum Widerstandspunktschweißen](https://link.springer.com/article/10.1007/s40194-023-01528-0) einen anderen Ausgangszustand und Simulationszweck und begründet keine allgemeine Fließkurve für geglühten Kaltstauchdraht.

Neue Kennwerte werden nur mit dokumentierter Identität und passendem Geltungsbereich ergänzt. Die aktuellen Literaturprofile belegen einen weichgeglühten Kaltumformzustand, jedoch keine numerische Dehnraten- oder Temperaturabhängigkeit. Weitere Kurven und Lieferzustände benötigen eigene Nachweise und eine passende Modellkonvention; unbekannte Versuchsbedingungen werden nicht nachträglich als gemessen ausgegeben.
