# KI-Gutachter

Cloudflare Worker hinter dem Anfrageknopf des Konfigurators. Er nimmt Anfrage und Zeichnung an und antwortet dem Besucher sofort. Danach liest Claude die Zeichnung, rechnet mit dem Rechenkern (`../engine.js`, Werkzeug `grobauslegung`) und schreibt Gutachten und Kundentext. Beides geht als Entwurf an info@jernyao.de, die Zeichnung im Anhang. Der Link im Entwurf öffnet eine Seite mit dem Kundentext zum Bearbeiten; erst der Knopf dort sendet an den Kunden, in Kopie an info@jernyao.de.

Wissen und Regeln stehen nicht im Code. Sie liegen im KV-Speicher unter den Schlüsseln `wissenskarten` und `regeln` und kommen aus dem Projektordner `JernYao_Konfigurator/Wissen/`.

## Einrichten

1. Konto bei Cloudflare (Workers, kostenloser Plan genügt) und bei Anthropic (API-Schlüssel, Monatslimit setzen).
2. Konto bei Resend für den Versand; die Domain jernyao.de dort bestätigen (drei DNS-Einträge bei INWX). Die Postfächer bei INWX bleiben unberührt.
3. In diesem Ordner:
   ```
   npm install -g wrangler
   wrangler login
   wrangler kv namespace create SPEICHER        # ID in wrangler.toml eintragen
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put RESEND_API_KEY
   wrangler secret put FREIGABE_SCHLUESSEL      # beliebige lange Zeichenfolge
   wrangler kv key put --binding SPEICHER wissenskarten --path ".../JernYao_Konfigurator/Wissen/wissenskarten.md"
   wrangler kv key put --binding SPEICHER regeln --path ".../JernYao_Konfigurator/Wissen/regeln.md"
   wrangler deploy
   ```
4. `BASIS` in `wrangler.toml` auf die ausgegebene Adresse setzen, erneut `wrangler deploy`.
5. In `../ui.js` `ENDPOINT` auf `<BASIS>/anfrage` setzen, `python3 quelle/bauen.py`, pushen.

## Kosten und Grenzen

Eine Anfrage mit Zeichnung kostet mit Sonnet rund 5 bis 20 Cent, je nach Seitenzahl und Werkzeugrunden; das Wissen wird zwischengespeichert. Höchstens 10 Anfragen je Adresse und Tag, Zeichnung bis 15 MB. PDF und Bilder liest Claude selbst; DXF, DWG und STEP gehen nur als Anhang an Hans Möhling.

## Prüfung

`quelle/ki-gutachter/worker.js` ist mit nachgebildeten Antworten von Claude und Resend durchgelaufen: Werkzeugrunde, Entwurf mit Anhang, Freigabeseite, Versand mit Kopie, Schutz gegen Doppelversand und falsche Signatur. Gegen die echten Dienste ist er noch nicht gelaufen.
