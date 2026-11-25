# Fachassistent und Anfrage-Eingang

Der Worker trennt zwei bewusste Aktionen: „Zeichnung scannen“ erstellt über `/preview` ausschließlich einen Analyseauftrag ohne Kontaktpflicht oder Mail. „Anfrage senden“ erstellt über `/anfrage` ausschließlich die E-Mail an Hans mit Angaben und Originalanhang. Beide Aufträge werden vor der Empfangsbestätigung gespeichert und haben einen privaten Statuszugang. Bereits gespeicherte ältere Aufträge mit kombinierter Analyse bleiben kompatibel.

Claude Opus 5.5 liest zuerst das freigegebene Projektwissen und kann dann mehrmals das echte Werkzeug für Geometrie, Stadienfolge und Katalogprüfung aufrufen. Das Ergebnis erscheint direkt im Fachchat. Das frühere Verfahren mit einer zwingenden internen Entwurfsfreigabe wurde für diesen Ablauf abgelöst. Es gibt keinen automatischen Versand einer KI-Antwort an Kunden.

Die Modellrunden verwenden `tool_choice: {type: "auto"}`. Systemtext und Werkzeugdefinitionen bleiben während einer Ausarbeitung unverändert; zurückgegebene Thinking-Blöcke bleiben erhalten. Der Server erlaubt Rechnung und Recherche erst in einer späteren Runde, nachdem `projektwissen` gelesen wurde. Ein gleichzeitig mit dem Wissensaufruf gesendeter Rechenaufruf wird noch nicht ausgeführt. Vorzeitige Schlussantworten erhalten die gezielte Anforderung, zuerst das Projektwissen zu lesen.

Die letzten zwei Runden bilden eine Schlussphase: keine wiederholte Wissensabfrage oder weitere Recherche, sondern ein Ergebnis mit gezielten Rückfragen. Eine zuvor gültige Engine-Rechnung bleibt bei einer später unvollständigen Variante erhalten und wird als solche ausgewiesen. Ist nach gelesenem Projektwissen noch keine verwertbare Maßzuordnung vorhanden, endet der Auftrag mit einer offen benannten Rückfrage und ohne erfundene Maße oder Maschinen. Fehlendes Projektwissen und Anbieterfehler bleiben Fehlerfälle.

## API für das Frontend

- POST /preview: multipart mit datei (PDF/PNG/JPEG/WebP), optional notiz, language und pricePolicy sowie erforderlichem idempotency_key. Antwort HTTP 202 mit {id, token, kind:"preview", status:"queued", notificationStatus:"not_requested"}. Kein Mailauftrag und keine Kontaktdaten. Gleiche Kennung mit unverändertem Inhalt liefert gespeicherten Auftrag/Ergebnis, Änderungen zur gleichen Kennung HTTP 409.
- POST /anfrage: multipart mit email, name, firma, notiz, optional datei, betreff, language und idempotency_key. Neue Formulare senden consent="true"; ältere veröffentlichte Formulare ohne dieses Feld bleiben kompatibel, ausdrückliche Ablehnung wird zurückgewiesen. E-Mail sowie Datei **oder** Beschreibung sind nötig. Antwort HTTP 202 mit {id, token, kind:"enquiry", status:"received", analysisStatus:"not_requested", notificationStatus:"pending"}. Nur Mail, keine Analyse. Derselbe unveränderte Retry bekommt die gespeicherte Identität; abweichender Inhalt zur gleichen Kennung HTTP 409. Ein optionaler Betreff wird auf 160 Zeichen begrenzt und von Steuerzeichen bereinigt.
- GET /status?id=…&token=…: {status, answer, proposal, questions, sources, notificationStatus}. Es werden keine Kontaktstammdaten oder Originalanhänge zurückgegeben.
- POST /chat: JSON {message, history?, requestId?, token?}. Ohne E-Mail möglich. history ist [{role:"user"|"assistant",content:string}]. Bei einer verknüpften Anfrage ersetzt die gespeicherte Historie die vom Browser gelieferte Historie; id und Token müssen zusammen passen. Antwort {answer, questions, proposal, sources, status}.
- GET /health: {ready, checks, knowledgeStatus, credentialsVerified:false, model}. Prüft vorhandene Bindings/Secrets und liest die referenzierten Wissenstexte tatsächlich. Dies testet **keine** Anbieter-Zugangsdaten, Domainzustellung oder Ressourcen-Erreichbarkeit. Ein unvollständiger Snapshot macht ready=false.
- Fehler: JSON {error}, kein Stacktrace, kein Anbieter-Rohtext.

Analysezustände: queued → processing → ready oder needs_info. Nach ausgeschöpften Wiederholungen failed. Chat kann needs_info nach einer Ergänzung zu ready ändern. Mailzustand unabhängig: pending → sent oder failed. sent bedeutet vom Mailanbieter angenommen, nicht durch einen Zustellbeleg im Posteingang bestätigt.

Dateien: höchstens 15 MiB. `/preview` liest PDF/PNG/JPEG/WebP als Dokument/Bild und prüft die Dateisignatur. `/anfrage` erlaubt außerdem TIFF sowie STEP/STP/DXF/DWG/IGS/IGES als Originalanhänge. Für deren KI-Auswertung wird eine PDF-/Bildansicht angefordert. CAD wird nicht ausgeführt oder als ausgelesen ausgegeben. Text höchstens 20.000 Zeichen, Chatnachricht 8.000, Chatkörper 64 kB.

Ein berechnetes proposal enthält belegte Eingabewerte mit Originaleinheit/Herkunft, sichtbare Prozessannahmen, Drahtversuch, Engine-Stadien, echte Katalogkandidaten mit Einzelkriterien, öffentliche Regelkurztexte, konkrete Grenzen und eine reproduzierbare calculation. Die numerische Stadienberechnung erfolgt durch das Berechnungsprogramm; die KI liest Zeichnungen und entwickelt qualitative Konzepte. Fehlender Werkstoff/fehlende Maße oder unplausible Wände verhindern eine entsprechende Rechnung. C35 wird nicht als C15C gerechnet.

Daneben können fachlich befürwortete Modellnennungen im Antworttext qualitative Anfragekandidaten erzeugen. Der Server gleicht sie mit dem echten Katalog ab und liefert sie unter proposal.machines mit selectionBasis:"qualitative", status:"offen" und reason. Ein rein qualitatives proposal hat classification:"qualitative" und calculation:null; es enthält keine erfundenen Kräfte, Auslastungen oder berechneten Stadien. Berechnete Treffer bleiben bei Duplikaten führend; ausdrücklich verworfene Modelle werden nicht aufgewertet. Preise stammen ausschließlich aus dem Katalog und bleiben auf jernyao.de serverseitig ausgefiltert.

Ohne Werkstoffansatz orientiert sich diese Vorauswahl am nominalen Drahtabschnitt und der Stationszahl des geometrischen Konzepts sowie an bekannter Abschnitt- und Produktlänge. Auswerfer, Einstecktiefe, Wenden und Transfer begründen eine Familienpräferenz, soweit die Angaben reichen. Bleiben beispielsweise JPF und JBP möglich, dürfen beide erscheinen; den endgültigen Vorzug klären die Technologen in Taiwan. Die Karten bieten „Angebot anfragen“ und übernehmen die Begründung getrennt von den Kundenangaben.

Die erste Drahtidee kann aus dem belegten Körperdurchmesser, bei Muttern aus 0,8 × Schlüsselweite entstehen. Sie ist ausdrücklich ein Prozessversuch, keine gemessene Zeichnungsangabe oder abschließend optimierter Draht. Die KI kann andere begründete Drahtversuche vergleichen. Zeichnungsauslesung bleibt als Interpretation erkennbar. Fmax ist eine einzelne Stationsspitze; Gesamtlast über den Hub sowie Zwischenformen/Transfer/KO/PKO bleiben konkrete offene Prüfungen. Ein Rm-Override ändert keine Fließkurve.

## Wissen und Prüfeingang

Der private KV-Snapshot wird durch die Werkzeuge unter ../wissen/ vorbereitet und synchronisiert. Aktiv ist ausschließlich konzept:manifest:

    {
      "version": "<snapshot>",
      "keys": {
        "regeln": "konzept:<sha>:regeln",
        "wissenskarten": "konzept:<sha>:wissenskarten",
        "literaturinventar": "konzept:<sha>:literaturinventar"
      }
    }

Die beiden Fachtexte sind UTF-8-Markdown. Erst werden versionierte Texte geschrieben, anschließend das Manifest umgeschaltet. Ein vorhandenes, aber unvollständiges Manifest führt zum Fehler; Generationen werden nicht gemischt. Nur wenn **kein** Manifest existiert, liest der Loader die alten Schlüssel regeln/wissenskarten, sichtbar als legacy-unversioned. Vor regulärem Betrieb einen versionierten Snapshot verwenden. Das Literaturinventar bleibt serverseitig; der Worker gibt keine vollständigen privaten Quellen oder Dokumente zurück.

Fachtexte werden als Tool-Daten mit niedrigerem Vertrauen behandelt, nicht als Systeminstruktionen. Alte Rollenpassagen und erkennbare private Fundstellen-/Kontaktzeilen werden zusätzlich entfernt. Nutzerhistorie liegt vollständig in einem untrusted Datenblock. Herkunftsprüfung, Modell-Allowlist und Sperre größerer wörtlicher Wissensexporte ergänzen das Prompting. Das ist keine mathematische Garantie gegen sämtliche semantischen Fehlinterpretationen eines Sprachmodells.

Bedarfsrecherche erfolgt erst nach dem Projektwissen. ALLOW_WEB_SEARCH=true aktiviert die Suche mit dem vorhandenen Anthropic-Zugang; optional kann ein eigenes Service-Binding RECHERCHE dieselbe Aufgabe übernehmen. Ein Analysevorgang darf höchstens einen Recherche-Aufruf mit bis zu zwei tatsächlichen Suchnutzungen machen. Die Domainliste begrenzt Treffer auf Hersteller-/Primärquellen. Es werden nur allgemeines Fachthema und bekannte öffentliche Modell-/Werkstoffbezeichnung gesendet, keine Kundenmaße, Kontaktdaten oder Originaltexte.

Neue Quellenhinweise landen unter lernen:<uuid>, Status ungeprueft, mit URL, Abrufdatum, Evidenzauszug und Hinweis auf noch ungeprüfte Widersprüche. Sie enthalten keinen Anfragebezug. Aufbewahrung 90 Tage. Es gibt keine automatische Änderung von Fachregeln. Nach Sichtung/Quellenabgleich wird ein neuer freigegebener Snapshot erstellt.

## Speicher und Laufzeit

- anfrage:<id>: Eingang und Dateimetadaten; analyse:<id>: Ergebnis/Status.
- nachricht:<id>: unabhängiger Mailstatus und Anbieter-ID.
- chat:<id>: Gesprächsverlauf, maximal 20 Einträge.
- idempotenz:<hash>, versandauftrag:<id>: Wiederaufnahme desselben Eingangs.
- vorschau-idempotenz:<hash>, vorschauauftrag:<id>: eigene Wiederaufnahme einer KI-Auswertung; keine Mailkennungen.
- rate:<bucket>:<day>:<IP-hash>: ungefähre tägliche Begrenzung, keine Roh-IP.
- diagnose:last:chat / queue / request: letzte klassifizierte Dienststörung, private Aufbewahrung eine Stunde. Nur feste Fehlerklasse, Dienst, Status, Zeitpunkt und validierte Anbieter-Request-ID; keine Rohantwort, Zeichnung, Kontaktdaten oder Zugangsschlüssel.
- Originaldatei: privates R2-Objekt anfragen/<id>/original. Keine öffentliche Downloadroute.

KV-Einträge zu Anfragen haben 30 Tage TTL. Der Zugriff erlischt zusätzlich nach 30 Tagen ab createdAt. Das HMAC-Token ist ein Geheimnis; keine URLs mit Token, Formulardaten oder Modell-/Mail-Request-Bodies loggen. Secretrotation macht bisherige Tokens ungültig.

**R2 löscht customMetadata.expiresAt nicht von selbst.** Im eingerichteten Dienst wurde die Lifecycle-Regel für Präfix anfragen/ mit Löschung nach 30 Tagen aktiviert und überprüft. Bei einer Neuinstallation muss diese Regel im R2-Bucket unter Settings → Object lifecycle rules erneut eingerichtet und im Dashboard kontrolliert werden. Ohne Regel bleibt die Datei liegen. Die Lifecycle-Löschung ist asynchron. Die separat zugestellten E-Mail-Anhänge unterliegen nicht dieser R2-Regel.

Cloudflare Queues trägt ausschließlich {kind,id}; die Originaldatei gehört nicht in die Queue. Neue Aufträge verwenden intake_mail oder preview_analysis; ältere analysis-Aufträge bleiben unterstützt. Batchgröße 1 und bis zu vier parallele Consumer. Die Queue erlaubt drei Retries nach dem ersten Versuch; neue Preview-Aufträge beenden bereits nach zwei fehlgeschlagenen Zustellungen mit sichtbarem Fehlerstatus. Fertige oder fehlgeschlagene Previews werden durch identische Wiederholungen nicht erneut analysiert. Die Analyse ist auf sieben Modellrunden und 240 Sekunden begrenzt, der synchrone Chat auf fünf Runden und 120 Sekunden. Kein mehrminütiges fire-and-forget über waitUntil.

KV ist eventual consistent: kurze Statusverzögerungen und gleichzeitig eintreffende identische Erstübertragungen sind nicht atomar abgesichert. Wiederholungen nach bestätigtem Speichern werden wiedererkannt. Resend erhält pro Anfrage einen Idempotency-Key (Anbieterfenster 24 Stunden); bereits als sent gespeicherte Nachrichten werden übersprungen. Vor einem manuellen DLQ-Replay nach längerer Pause Anbieterstatus prüfen. Keine Exactly-once-Zusage. Für harte globale Idempotenz/Quoten wäre ein Durable Object nötig.

Die tägliche KV-Begrenzung (je 10 neue Mailanfragen und Previews, 40 Chats je IP-Hash) ist ebenfalls näherungsweise. WAF-Limits für /anfrage, /preview und /chat sowie das API-Budget beim Anbieter sind separate Betriebseinstellungen und werden durch den Code nicht eingerichtet oder bestätigt. Limits auf den tatsächlichen Traffic abstimmen; CORS allein begrenzt keine Nutzung. Kosten hängen von Seitenzahl, Modell, Runden und Suche ab.

## Einrichtung und Aktivierung

Der Dienst wurde bereitgestellt. Die Anbieter-Zugänge liegen als verschlüsselte Cloudflare-Secrets außerhalb dieses Checkouts. Im kontrollierten Vorschautest vom 25.11.2026 wurden ein echter PDF-Upload, die Analyse mit dem aktiven Modell und der unabhängige Originalanhang-Versand durchlaufen. Der Versanddienst bestätigte die Zustellung. Einzelheiten zum neutralen Geometriefall stehen in [der Inbetriebnahme-Notiz](../Innenantriebe_inbetriebnahme_20261125.md). Ein positives `/health` bleibt trotzdem nur der oben beschriebene Konfigurationscheck.

Für Neuinstallation oder Wiederherstellung:

1. KV-Namespace SPEICHER, privaten R2-Bucket und Haupt-/Fehlerqueue anlegen beziehungsweise die vorhandenen Ressourcen wiederverwenden; Bindings in wrangler.toml kontrollieren. Ausreichenden Worker-/Queue-Tarif wählen.
2. R2-Lifecycle wie oben tatsächlich einrichten. Bucket ohne Public URL betreiben.
3. Als Secrets ANTHROPIC_API_KEY, RESEND_API_KEY und ZUGRIFF_SCHLUESSEL (mindestens 32 zufällige Zeichen) setzen. FREIGABE_SCHLUESSEL wird für die Migration noch gelesen. Keine Secrets in Repository oder ZIP.
4. Resend-Absenderdomain verifizieren; EMPFAENGER ist die fest konfigurierte Hans-Adresse. Die KI darf keinen Empfänger setzen. Richtiges Empfängerpostfach vor Inbetriebnahme verifizieren.
5. Den freigegebenen versionierten Wissenssnapshot synchronisieren. ALLOW_WEB_SEARCH und erlaubte Primärquellen-Domains prüfen.
6. Betriebslimits und Budget prüfen. Worker bereitstellen, Health lesen und einen kontrollierten echten Test mit eigener Beispielzeichnung/Adresse durchführen: Eingang, Tokenzugriff, tatsächliche Mailzustellung, KI-Runden, Rückfrage und Chatfortsetzung. Queue-Fehlerpfad mit einer dafür vorgesehenen Testumgebung prüfen.
7. Erst nach diesen Prüfungen JY_API_BASE in der Frontend-Konfiguration aktivieren und die Seite bauen. Ein fehlendes/noch nicht verbundenes Backend darf nicht als empfangene Anfrage dargestellt werden.

## Lokale Regression

Node 22+ (hier Node 24) mit Unterstützung für JSON-Importattribute:

    node --test test/*.test.js

Die Tests benutzen den echten Rechenkern und Maschinenkatalog, aber nachgebildete Antworten von Anthropic/Resend und In-Memory-KV/R2/Queue. Sie prüfen Maße/Einheiten, unsupported Werkstoffe, lokale Napfwände, Snapshot-Wechsel, Quellenbegrenzung, Toolrunden, Status-Token, Uploadgrenzen, Retry und die Unabhängigkeit der Mail. Sie ersetzen keinen Live-Diensttest oder visuellen Abgleich einer realen Zeichnung.

Offizielle Schnittstellenquellen, geprüft am 25.11.2026:

- [Cloudflare Queue-Konfiguration](https://developers.cloudflare.com/queues/configuration/configure-queues/)
- [Queue-Laufzeit und Nachrichtengröße](https://developers.cloudflare.com/queues/platform/limits/)
- [R2-Lifecycle-Verhalten](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Anthropic Tooldefinitionen](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- [Opus-5.5-Migration und Werkzeugwahl](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide)
- [Resend E-Mail-API und Idempotency-Key](https://resend.com/docs/api-reference/emails/send-email)
