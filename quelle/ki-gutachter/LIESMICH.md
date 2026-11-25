# Fachassistent und Anfrage-Eingang

Der Worker nimmt eine Zeichnung, Skizze oder Beschreibung an. Er speichert den Auftrag vor der Empfangsbestätigung und stellt zwei voneinander unabhängige Queue-Aufträge ein: Eingangs-Mail an Hans mit Originalanhang und technische Analyse. Eine gescheiterte KI-Ausarbeitung verhindert die Eingangs-Mail nicht; ihr eigener Status bleibt sichtbar.

Claude Opus 5.5 liest zuerst das freigegebene Projektwissen und kann dann mehrmals das echte Werkzeug für Geometrie, Stadienfolge und Katalogprüfung aufrufen. Das Ergebnis erscheint direkt im Fachchat. Das frühere Verfahren mit einer zwingenden internen Entwurfsfreigabe wurde für diesen Ablauf abgelöst. Es gibt keinen automatischen Versand einer KI-Antwort an Kunden.

## API für das Frontend

- POST /anfrage: multipart mit email, name, firma, notiz, optional datei und idempotency_key. E-Mail sowie Datei **oder** Beschreibung sind nötig; keine technischen Pflichtfragen. Antwort HTTP 202 mit {id, token, status:"queued", notificationStatus:"pending"}. Derselbe unveränderte Retry bekommt die gespeicherte Identität; abweichender Inhalt zur gleichen Kennung HTTP 409.
- GET /status?id=…&token=…: {status, answer, proposal, questions, sources, notificationStatus}. Es werden keine Kontaktstammdaten oder Originalanhänge zurückgegeben.
- POST /chat: JSON {message, history?, requestId?, token?}. Ohne E-Mail möglich. history ist [{role:"user"|"assistant",content:string}]. Bei einer verknüpften Anfrage ersetzt die gespeicherte Historie die vom Browser gelieferte Historie; id und Token müssen zusammen passen. Antwort {answer, questions, proposal, sources, status}.
- GET /health: {ready, checks, knowledgeStatus, credentialsVerified:false, model}. Prüft vorhandene Bindings/Secrets und liest die referenzierten Wissenstexte tatsächlich. Dies testet **keine** Anbieter-Zugangsdaten, Domainzustellung oder Ressourcen-Erreichbarkeit. Ein unvollständiger Snapshot macht ready=false.
- Fehler: JSON {error}, kein Stacktrace, kein Anbieter-Rohtext.

Analysezustände: queued → processing → ready oder needs_info. Nach ausgeschöpften Wiederholungen failed. Chat kann needs_info nach einer Ergänzung zu ready ändern. Mailzustand unabhängig: pending → sent oder failed. sent bedeutet vom Mailanbieter angenommen, nicht durch einen Zustellbeleg im Posteingang bestätigt.

Dateien: höchstens 15 MiB. PDF/PNG/JPEG/WebP werden als Dokument/Bild gelesen, mit Prüfung der Dateisignatur. STEP/STP/DXF/DWG werden als Original gesichert und an Hans weitergegeben; ohne zusätzliche lesbare Ansicht oder Textmaße gibt es eine gezielte Rückfrage. CAD wird nicht ausgeführt oder als ausgelesen ausgegeben. Text höchstens 20.000 Zeichen, Chatnachricht 8.000, Chatkörper 64 kB.

proposal enthält belegte Eingabewerte mit Originaleinheit/Herkunft, sichtbare Prozessannahmen, Drahtversuch, Engine-Stadien, echte Katalogkandidaten mit Einzelkriterien, öffentliche Regelkurztexte, konkrete Grenzen und eine reproduzierbare calculation. Maschinen, Kräfte und Maße werden nicht aus einem frei erfundenen JSON des Modells übernommen. Fehlender Werkstoff/fehlende Maße oder unplausible Wände verhindern eine Rechnung. C35 wird nicht als C15C gerechnet.

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
- rate:<bucket>:<day>:<IP-hash>: ungefähre tägliche Begrenzung, keine Roh-IP.
- Originaldatei: privates R2-Objekt anfragen/<id>/original. Keine öffentliche Downloadroute.

KV-Einträge zu Anfragen haben 30 Tage TTL. Der Zugriff erlischt zusätzlich nach 30 Tagen ab createdAt. Das HMAC-Token ist ein Geheimnis; keine URLs mit Token, Formulardaten oder Modell-/Mail-Request-Bodies loggen. Secretrotation macht bisherige Tokens ungültig.

**R2 löscht customMetadata.expiresAt nicht von selbst.** Vor Aktivierung im R2-Bucket unter Settings → Object lifecycle rules eine Regel für Präfix anfragen/ mit Löschung nach 30 Tagen einrichten und anschließend die tatsächliche Regel im Dashboard überprüfen. Ohne diese Einstellung bleibt die Datei liegen. Die Lifecycle-Löschung ist asynchron. Bei absichtlich verlängerten Untersuchungen zuerst eine passende dokumentierte Aufbewahrung festlegen.

Cloudflare Queues trägt ausschließlich {kind,id}; die Originaldatei gehört nicht in die Queue. Mail und Analyse haben eigene Nachrichten, Batchgröße 1 und bis zu vier parallele Consumer. Drei Retries nach dem ersten Versuch, Verzögerung 60 Sekunden, danach jy-anfragen-dlq. Die Analyse ist auf sieben Modellrunden und 240 Sekunden begrenzt, der synchrone Chat auf fünf Runden und 65 Sekunden. Kein mehrminütiges fire-and-forget über waitUntil.

KV ist eventual consistent: kurze Statusverzögerungen und gleichzeitig eintreffende identische Erstübertragungen sind nicht atomar abgesichert. Wiederholungen nach bestätigtem Speichern werden wiedererkannt. Resend erhält pro Anfrage einen Idempotency-Key (Anbieterfenster 24 Stunden); bereits als sent gespeicherte Nachrichten werden übersprungen. Vor einem manuellen DLQ-Replay nach längerer Pause Anbieterstatus prüfen. Keine Exactly-once-Zusage. Für harte globale Idempotenz/Quoten wäre ein Durable Object nötig.

Die tägliche KV-Begrenzung (10 Eingänge, 40 Chats je IP-Hash) ist ebenfalls näherungsweise. Vor öffentlicher Aktivierung in Cloudflare eine WAF-Rate-Limit-Regel für /anfrage und /chat setzen; CORS allein ist kein Missbrauchsschutz. Limits auf eigenen Traffic abstimmen und API-Budget beim Anbieter setzen. Kosten hängen von Seitenzahl, Modell, Runden und Suche ab; es gibt hier keine unbestätigte Cent-Pauschale.

## Einrichtung und Aktivierung

Dieser Checkout enthält keine Live-Zugangsdaten und wurde nicht deployed. Vor Aktivierung:

1. KV-Namespace SPEICHER, privaten R2-Bucket jy-anfragen und Queues jy-anfragen / jy-anfragen-dlq anlegen; KV-ID in wrangler.toml ersetzen. Ausreichenden Worker-/Queue-Tarif wählen.
2. R2-Lifecycle wie oben tatsächlich einrichten. Bucket ohne Public URL betreiben.
3. Als Secrets ANTHROPIC_API_KEY, RESEND_API_KEY und ZUGRIFF_SCHLUESSEL (mindestens 32 zufällige Zeichen) setzen. FREIGABE_SCHLUESSEL wird für die Migration noch gelesen. Keine Secrets in Repository oder ZIP.
4. Resend-Absenderdomain verifizieren; EMPFAENGER ist die fest konfigurierte Hans-Adresse. Die KI darf keinen Empfänger setzen. Richtiges Empfängerpostfach vor Inbetriebnahme verifizieren.
5. Den freigegebenen versionierten Wissenssnapshot synchronisieren. ALLOW_WEB_SEARCH und erlaubte Primärquellen-Domains prüfen.
6. WAF-Regeln und Budget setzen. Worker bereitstellen, Health lesen und einen kontrollierten echten Test mit eigener Beispielzeichnung/Adresse durchführen: Eingang, Tokenzugriff, tatsächliche Mailannahme, KI-Runden, Rückfrage, Chatfortsetzung und Queue-Fehlerpfad.
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
- [Resend E-Mail-API und Idempotency-Key](https://resend.com/docs/api-reference/emails/send-email)
