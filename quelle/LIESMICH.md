# Agentische Auslegung auf jern-yao.de

Eine Zeichnung oder Skizze zentral einreichen und Fertigungskonzepte im Fachdialog entwickeln. Das Maschinenprogramm steht vor dem Einstieg. Der Rechenkern prüft Zahlen und Maschinen; der Dienst liest zuerst den versionierten Konzeptstand. Die Seite `index.html` wird gebaut, nicht von Hand bearbeitet. Der **Expertenkonfigurator** steht unter `manual/konfigurator-v1.html` und über `/manual/` bereit. Er bietet Schrauben/Bolzen, den Formteilbaukasten und klassische Muttern. Er enthält keinen zweiten Datei-Upload. Der alte Link `archiv/konfigurator-v1.html` leitet mit Query und Hash weiter; unveränderte historische Sicherungen bleiben unter `archiv/`.

Am zentralen Eingang wird eine Datei einmal gewählt. „Zeichnung mit KI auswerten“ startet nur die Analyse; „Anfrage an Hans senden“ öffnet die Kontaktfelder für den separaten Mailauftrag. Der Fachfrage-Tab dient allgemeinen technischen Fragen. Exzentrische Achsen, Innenkonturen am Schaftende und Sonder-Beschnitt werden vor einer numerischen Maschinenzuordnung auf die tatsächlich abgedeckten Rechenmodelle geprüft. Nicht abgedeckte Geometrien erhalten ein qualitatives Stadienkonzept und konkrete offene Punkte statt einer Rechnung für einen vereinfachten Ersatzkörper.

`geometry-model.js` berechnet den booleschen Körper als Vereinigung aller additiven Elemente abzüglich der Vereinigung aller Aussparungen und Beschnitte. Bezug ist die Werkzeugtrennkante z=0, Stempelseite z<0, Matrizenseite z>0; keine Seite ist automatisch die Kopfseite. Zylinder, Kegelstümpfe, Sechskante, Achsversätze und axiale Beschnittebenen sind modelliert. Analytische Fälle liefern Einzelwerte; sonst liefern räumlich eingeschlossene Zellen belastbare Unter-/Obergrenzen. Darstellung und Masse übernehmen diese Intervalle, keinen vermeintlich genauen Mittelpunkt. Fertiggewicht bezieht sich auf das Teil nach Beschnitt, Abschnitt auf den modellierten Vorrat davor. Nicht modellierte Verluste bleiben offen.

`geometry-wizard.js` zeigt die fortschreitende X–Z-Schnittskizze (Y=0), Volumen und Gewicht. `/geometry-preview` überträgt das validierte Modell mit dem Drahtprozess ohne Kontaktdaten und ohne Datei. Der Server berechnet die Geometrie unabhängig nach; vom Client behauptete Zahlen oder Freigaben gelten nicht als Beleg. Die Quelle heißt ausdrücklich `structured_geometry`, nicht Zeichnung. Unvollständige Krallenkonturen sperren Fertiggewicht und Abschnitt. Aus der Geometrie entwickelt die KI ein qualitatives Stadienkonzept; eine vollständige numerische Kraft- und Maschinenfreigabe für beliebige boolesche Formen ist damit nicht behauptet.

`standard-families.js` enthält recherchierte Normreferenzen für Schrauben, kopflose Gewindestifte und Muttern. Die Auswahl setzt die Grundform, keine ungeprüften Normmaße und keinen Draht-Ø aus der Gewindenennweite. Flanschmuttern führen in den Formteilbaukasten. Gewindearten steuern die tatsächlichen Rohschaftfelder; Profilquerschnitte und Spitzen werden nicht stillschweigend durch einen Rundschaft ersetzt. Jern Yao wird keine Doppeldruckmaschinen-Baureihe zugeschrieben.

## Bauen

```
python3 quelle/katalog/specs_parse.py <Ordner mit den Katalog-PDFs>     # Kataloge von https://www.jernyao.com/files/
python3 quelle/katalog/daten_bauen.py <JernYao_Richtpreise_2026.csv>     # Preisliste aus dem Projektordner
python3 quelle/bauen.py                                                  # baut Startseite, Manual, Weiterleitungen und 404-Seite
node quelle/test/faelle.js                                               # Referenzfälle und Prüffälle aus Stadienplänen
node quelle/test/fachliche-pruefung.cjs                                   # numerische Regressionen mit Assertions
node quelle/test/grenzen.cjs                                             # ungültige Geometrien / Laufzeitgrenzen
node quelle/test/werkstoffe.cjs                                          # Werkstoffidentitäten und offene Kennwerte
node quelle/test/ui-vertrag.cjs                                          # Formular und API-Vertrag
node --test quelle/ki-gutachter/test/*.test.js quelle/test/*.test.cjs      # Dienst, Stadien, Antriebe und Sprachen
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
- `innenantriebe-quellen.md`, `Innenantriebe_inbetriebnahme_20261125.md`: Profilgrößen, fachliche Rechengrenzen und protokollierte Inbetriebnahme.

## Veröffentlichung

Die Domain ist GitHub Pages zugeordnet. Der Dienst läuft separat; ein Umzug der Domain ist für diese Architektur nicht notwendig. Nach Dienständerungen den kontrollierten Übertragungsweg prüfen, die bestätigte API-Basis in `site-config.js` eintragen, neu bauen und den geprüften Stand veröffentlichen. Die API-Basis enthält keine Zugangsschlüssel. Ein erfolgreicher Worker-Deploy ersetzt die Prüfung der anschließend veröffentlichten Startseite und Manual nicht.

Inbetriebnahme vom 25.11.2026: Cloudflare-Dienst, versioniertes Projektwissen, Anthropic und Resend waren in der Vorschau verbunden. Eine eigens erstellte PDF-Testzeichnung wurde über den echten Upload gelesen und gerechnet; die unabhängige Vergleichsrechnung bestätigte Ø8 × 43,203 mm Abschnitt. Die parallele Eingangs-Mail mit Originalanhang wurde beim Versanddienst als zugestellt bestätigt. Die Innenantriebe des Manual wurden im Browser in allen fünf Sprachen geprüft. Dieser Nachweis dokumentiert den Dienst- und Vorschautest, nicht den separat auszuführenden Publish der Hauptdomain. Alte Version und neuer Quellstand werden getrennt gesichert.


## Mehrsprachigkeit und Manual

`integration_bauen.py <jernyao.de-Checkout>/docs` exportiert nach `bauen.py` die Module `/auslegung/` und `/konfigurator/` für die Hauptseite ohne Bindestrich. Diese Variante enthält keine Maschinenpreise im clientseitigen Katalog und keine Preisausgabe in Ergebnissen, Druck oder E-Mail. Die ursprünglichen Ausgaben dieses Repositorys bleiben mit Preisen. Im Dienst ist die preisfreie Herkunft von Upload bis Folgechat verbindlich gespeichert; eine Nutzereingabe kann die Freigabe nur weiter einschränken. Die Einbettung verwendet `embedded=1`, passt ihre Höhe an und lässt den Datenschutz erreichbar.

Die Material-Dropdowns lassen das Wort „weichgeglüht“ weg; Lieferzustand, ausgewählte Fließkurve und Rechenannahmen bleiben unverändert im Modell und in der Ergebnisbasis.

Ziehgeräte und Abzug sind kundenseitig vorgegeben. Inline-Vorzug verändert nur den mathematischen Ausgangszustand der Kraftrechnung und erzeugt keine Rückfrage zur Zieheinrichtung an Jern Yao sowie kein zusätzliches Maschinenkriterium.

Aktueller Ausbau: **15 auswählbare Identitäten mit 14 Kurvenprofilen**, darunter 14 Möhling-Katalogidentitäten und AISI 1010. Neu ist 20MnB4 im normalisierend warmgewalzten Zustand nach Komischke (ETH 2019); [Quellenprüfung und Modellgrenzen](20MnB4_Quellenpruefung.md). Die ältere Bestandsbeschreibung weiter unten beschreibt die bisherigen weichgeglühten Profile.

Dropdowns nennen Sorte, Werkstoffnummer und Zustand; Quellen bleiben im Datenmodell. Der braune Hinweisblock unter der Grobauslegung entfällt. Maschinen führen stattdessen konkrete `openPoints` mit zuständigem Kunden/Drahtlieferanten, Jern Yao oder unserer Auslegung. Dieselben Angaben stehen in Fachchat, Druckblatt und Mailtext.

`wirePreparation: inline-drawing` aktiviert Walzdraht mit Inline-Vorzug. `rodDiameter` gilt vor, `d0` und `rm` nach dem Ziehen. Die Engine integriert über die um `2 ln(rodDiameter/d0)` verschobene Fließkurve, begrenzt die Gesamtdehnung und weist die separate Zieheinrichtung vor den Pressenstadien aus. Ausgangszustand und Kurve müssen vor dem Ziehen passen; keine Zwischen- oder Nachglühung und kein Einsatz einer bereits gezogenen AISI-Kurve als Walzdrahtbasis. Die Modellannahme ist in den Konzeptdetails dokumentiert.

`python quelle/bauen.py` baut Startseite, Manual, Weiterleitungen und 404-Seite. Bei vorhandener `werkstoffe-recherche.json` wird vorher `werkstoffe_bauen.build()` ausgeführt. Die unveränderten Originalarchive bleiben unangetastet.

`i18n-*.json` enthalten deutsche Originaltexte und je vier Übersetzungen in der Reihenfolge Italienisch, Slowenisch, Englisch, vereinfachtes Chinesisch. `bauen.build_i18n()` erzeugt daraus den browser- und servergeeigneten UMD/CJS-Katalog `i18n.js`. Vollständige Sätze und dynamische `{identifier}`-Vorlagen haben Vorrang vor Fachbegriffen. Zitierte Originalwerte, Werkstoffnamen und Zahlen bleiben erhalten. Nur Fachlabel-Platzhalter `field`, `feature`, `operation`, `location` werden ihrerseits übersetzt.

`i18n-browser.js` verwaltet `?lang=de|it|sl|en|zh`, den lokal gespeicherten Sprachwunsch sowie `document.lang` (`zh-Hans`) und sichtbare Texte/Attribute. Nutzereingaben, Originalzitate und bereits empfangene KI-Antworten werden nicht umgeschrieben; die Antwortsprache ist ausgewiesen. Ein Sprachwechsel erzeugt keine versteckte KI-Anfrage. Neue Nachrichten übergeben die neue Sprache.

`concept-ui.js` stellt den maschinenspezifischen Abschnitt und die qualitative Stadienfolge aus dem Rechenkern dar. `archiv-ui.js` enthält die technische Oberfläche; `archiv-vorlage.html` ihre Vorlage.

Im Manual stehen Torx, Innensechskant, Phillips PH und Pozidriv PZ mit Größenwahl und eigener Tiefe zur Verfügung. Für Torx/PH/PZ bleibt die Abschnittlänge ohne Vertiefungsvolumen oder verwertbare Teilmasse offen; eine Profilnummer ist kein Geometriemaß. Ein CAD-Volumen erlaubt die Volumenbilanz, liefert aber noch keine profilabhängige Formkraft. Auswahl und Grenzen erscheinen auch in Maschinenkonzept, Druckblatt und E-Mail. Details und Primärquellen: [Innenantriebe](innenantriebe-quellen.md).

Die Werkstoffauswahl im Manual zeigt ausschließlich freigegebene Kombinationen aus Werkstoff, Lieferzustand und Literaturkurve aus `fliesskurven.json`: dreizehn Katalogzeilen mit zwölf Kurven für den weichgeglühten Zustand sowie AISI 1010 als eigenständigen gezogenen Literaturzustand. Der vollständige 58er-Katalog bleibt für den Fachassistenten erhalten. `werkstoffe_bauen.py` ordnet Kurven über exakte Werkstoffnummern oder ausdrücklich angegebene eigenständige `materialIds` zu. Zusätzliche Identitäten stehen in `werkstoffe-ergaenzungen.json`, ohne die Katalogliste zu verändern. Alte C/n/Rm-Parameter bleiben nur als `legacyParameters` dokumentiert und liefern keine Kräfte oder Drahtzugfestigkeit. Rm kann ausdrücklich aus dem Drahtzeugnis eingegeben werden. Die vier Geometriebeispiele nennen C4C, weichgeglüht; frühere Borstahl-/Festigkeitsklassenangaben werden damit nicht fortgeschrieben. Die M8-Geometrie verwendet einen Drahtversuch Ø8 mm, damit die Rechnung im belegten Kurvenbereich bleibt. Andere Werkstoffe und Lieferzustände können weiterhin über die Zeichnungsanfrage geprüft werden.

Das zusätzliche AISI-1010-Profil verwendet Rosochowska et al. (2009): `kf = 680 · (0,1 + φ)^0,29 MPa`, gezogenes Stabmaterial, Raumtemperatur, mittlere Versuchsdehnrate 0,0336 s⁻¹, gemessener Bereich φ = 0…1,5. Der Swift-Ansatz wird auf Server und Client identisch mit exaktem Integral berechnet. Der Anfangswert ist aus dem Modell abgeleitet und keine gemessene Rp0,2. Keine Zuordnung zu C10C/C15C, keine Extrapolation oder Geschwindigkeitskorrektur. Ziehgrad und Wärmebehandlung sind nicht vollständig dokumentiert. Dichte und spezifische Umformgrenzen fehlen; die Teilemasse bleibt offen und Stadiengrenzen vorläufig. Auswahl, Zustand und Grenzen sind in DE/IT/SL/EN/ZH verfügbar.

Lokale Prüfungen ohne Netzwerk oder Browser:

```
node quelle/test/ui-vertrag.cjs
node --test quelle/test/i18n.test.cjs quelle/test/archiv-ui.test.cjs
```

Die Tests prüfen Payloads/Idempotenz, fünf Sprachen, Wechsel und Rückwechsel, Originaltextschutz, Dateigrenzen, das qualitative Maschinenkonzept und offene Kräfte. Sie ersetzen keine visuelle Browserprüfung.
