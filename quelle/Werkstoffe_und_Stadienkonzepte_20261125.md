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
| Neu freigegebene Kaltfließkurven | 0 |

Jeder Zahlenbeleg nennt Quelle, Einheit, Lieferzustand, Produktform und den belegten Abmessungsbereich beziehungsweise dessen fehlende Spezifikation. Mindestwerte, Höchstwerte, Bereiche und typische Werte werden unterschieden. Vergütete Stäbe, einsatzgehärtete Proben oder Walzband liefern keine automatisch gültigen Kennwerte für geglühten Kaltstauchdraht. Herstellerreferenzen und berechnete Nenndichten sind keine Chargenmessungen.

Die **14 ungeprüften Bestandsmodelle** bleiben als historische Näherungsmodelle gekennzeichnet. Die neue Recherche bestätigt deren Fließkurvenparameter nicht. Aus Rm, Rp0,2 oder Härte wird keine Fließkurve abgeleitet. Für neue Werkstoffe ohne passende Kurve können Abschnitt und Stadien geometrisch bestimmt werden; Kraft und Werkzeugdruck bleiben offen. Für eine Abschnittsberechnung aus Masse ist außerdem eine belegte Dichte erforderlich.

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

Neue Kennwerte werden nur mit dokumentierter Identität und passendem Geltungsbereich ergänzt. Eine spätere Freigabe von Fließkurven erfordert zusätzlich einen belegten Zusammenhang mit Lieferzustand, Temperatur, Dehnrate, Dehnungsbereich und verwendeter Modellkonvention.
