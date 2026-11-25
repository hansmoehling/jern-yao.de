# Konzept als Wissensbasis

Die Website liest technische Regeln und Wissenskarten serverseitig. Die Originale und der private Snapshot gehören **außerhalb** dieses öffentlichen Repositories. Kundenzeichnungen, E-Mails und private Fundstellen werden nicht veröffentlicht.

## Snapshot erstellen und übertragen

Die aktuellen Dateien aus dem freigegebenen Projekt herunterladen: `regeln.md`, `wissenskarten.md`, `Literaturinventar.md`. Als Ursprung gilt das Projekt Konzept; ein alter lokaler Stand wird nicht ungeprüft zum aktuellen Wissen erklärt.

```
python quelle/wissen/prepare_konzept.py --source /private/Konzept --output /private/konzept-cache.private.json
node quelle/wissen/sync_konzept.mjs publish /private/konzept-cache.private.json
```

Der erste Befehl entfernt alte Rollenpassagen, private Fundstellen, Pfade und Kontakte aus der technischen Projektion. Er hält Prüfsummen sowohl der Originale als auch der Projektion fest. Das Literaturinventar wird als Zugangshinweis zusammengefasst; ein Titel allein ist kein Beleg.

Der zweite Befehl braucht `CLOUDFLARE_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID` und `CLOUDFLARE_API_TOKEN` in der lokalen Umgebung. Er schreibt zuerst versionierte Inhalte, dann `konzept:manifest`. Ein unvollständiger Transfer schaltet den alten Wissensstand nicht ab. Der Worker liest die Schlüssel des Manifests. Die Aktivierung muss nach KV-Propagation mit dem Dienst geprüft werden.

## Rücklauf

Neue Recherchebelege werden mit Status `ungeprueft` im privaten Wissenseingang des Dienstes abgelegt. Sie sind keine Regeländerung. Die Datei für die fachliche Prüfung lässt sich exportieren:

```
node quelle/wissen/sync_konzept.mjs export-learning /private/lernen-export.private.json
```

Den Export auf Kundenbezug prüfen, dann in Konzept/Wissenseingang ablegen. Eine bestätigte Erkenntnis erhält Kennung, Quelle, Geltungsbereich und Prüffall. Anschließend die betroffenen Originaldateien in Konzept aktualisieren und einen neuen Snapshot veröffentlichen. Der Export selbst wird nicht automatisch als bestätigtes Wissen eingespielt.

Die Live-Verbindung von Google Drive zum Hosting wird bewusst separat eingerichtet: Der Drive-Connector dieses Chats ist kein dauerhaftes Server-Zugangstoken. Ein automatischer Abruf braucht einen eng begrenzten, vom Eigentümer eingerichteten Serverzugang. Ohne ihn funktioniert der versionierte Export-/Importweg; automatische Drive-Synchronisierung wird nicht behauptet.
