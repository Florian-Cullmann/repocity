# RepoCity

Eine interaktive Low-Poly-Modellstadt für Software-Repositories. **GitHub-URL oder `owner/repository` eingeben, laden und als Stadt erkunden.** Öffentliche Repositories werden direkt im Browser analysiert; Besucher brauchen keinen lokalen Checkout. Jede Quelldatei wird ein Gebäude, Ordner bilden die Viertel. Die eigene Codebasis dient als sofort verfügbares Startbeispiel; eine Demo mit fiktiven Daten bleibt auswählbar.

React · TypeScript · Vite · Three.js · React Three Fiber

![RepoCity-Demo mit sechs Vierteln, 96 Gebäuden, Flusspromenade und Marktplatz](docs/preview.png)

## Starten

Voraussetzung: **Node.js 22.12+** (empfohlen: Node.js 24 LTS) und npm.

```sh
npm ci
npm run dev
```

Anschließend **http://127.0.0.1:5174** öffnen. Der feste Port verhindert, dass Tests versehentlich ein anderes lokales Projekt aufrufen. Bei Bedarf: `npm run dev -- --port 5180`.

```sh
npm run build       # TypeScript-Prüfung und Produktionsbuild nach dist/
npm run preview     # Produktionsbuild lokal ansehen
npm run analyze     # Aktuelles Projekt als RepositorySnapshot in JSON analysieren
npm test            # Analyzer-, Generator- und Geometrie-Tests
npx playwright install chromium
npm run test:e2e     # Browser-Tests mit echtem WebGL (Software-Renderer für CI)
REPOCITY_E2E_PREVIEW=1 npm run test:e2e # Browser-Tests gegen den fertigen Build
```

## Als Website veröffentlichen

`npm run build` erzeugt die statische Website in `dist/`. Dessen Inhalt kann auf einem statischen Hostingdienst veröffentlicht werden, auch unter einem Unterpfad. Auf dem Hosting ist kein Node.js-Prozess, eigener Backenddienst oder API-Schlüssel erforderlich. Der GitHub-Import funktioniert zur Laufzeit im Browser.

1. Website öffnen und im Feld „Repository“ die GitHub-URL oder `owner/repository` eingeben.
2. „Repository laden“ anklicken.
3. Die fertige Stadt erkunden; ein Gebäude führt zur Quelldatei im importierten Commit.

### GitHub-Import

- **Öffentliche Repositories:** Kein Login und kein Token. Private Repositories und GitHub-Enterprise-Instanzen sind derzeit nicht unterstützt. Die Eingabe muss auf die Hauptseite des Repositories verweisen; URLs zu einzelnen Dateien oder Branch-Unterseiten werden abgewiesen.
- **Konsistenter Stand:** Der Standardbranch wird einmal auf einen Commit aufgelöst. Dateistruktur, Metriken und Quelltextlinks beziehen sich auf diesen Commit; der Branchname und die kurze Commit-ID erscheinen in der Stadtüberschrift.
- **Vollständige Stadt:** Jede unterstützte Quelldatei im GitHub-Verzeichnisbaum bekommt ein Gebäude. Die Höhe folgt ihrer Dateigröße in Bytes, die Farbe dem Ordner. Es gibt keine Stichprobe und keine Grenze von 768 Dateien oder 32 MiB. Abhängigkeiten, generierte Dateien, versteckte Pfade und nicht unterstützte Dateitypen werden weiterhin nach den gemeinsamen Dateifiltern ausgeschlossen.
- **Laden und Fehler:** Der Import lädt nur Metadaten und die Dateistruktur. Fortschritt und Abbrechen sind sichtbar. Nach Fehlern, Abbruch oder einer Änderung an der Eingabe bleibt die letzte erfolgreich erzeugte Stadt erhalten. Ein Import endet nach spätestens zwei Minuten mit einem verständlichen Fehler.
- **Codezeilen bei Bedarf:** Erst beim Öffnen eines Gebäudes wird seine Quelldatei von `raw.githubusercontent.com` geladen und im Browser gezählt. Gezählt werden nichtleere Zeilen einschließlich Kommentaren; Projektcode wird nicht ausgeführt. Die Messung bleibt an denselben Commit gebunden, wird beim Wechsel abgebrochen und beim erneuten Auswählen innerhalb des geöffneten Infofensters wiederverwendet. Fehler lassen sich erneut versuchen. Dateien über 8 MiB und Dateien mit Binärinhalt behalten ihr Gebäude, zeigen jedoch keine gemessenen Codezeilen. Eine Messung endet spätestens nach 30 Sekunden. Abhängigkeiten und Testabdeckung bleiben „Nicht verfügbar“.
- **API-Grenzen:** Ein Import benötigt drei GitHub-API-Anfragen; nur ausdrücklich geöffnete Quelldateien werden anschließend separat geladen. Ohne Anmeldung gilt derzeit ein [GitHub-API-Limit von 60 Anfragen pro Stunde und IP-Adresse](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). Erreichte Limits werden angezeigt. Liefert GitHub eine abgeschnittene Dateistruktur, wird der Import mit einem Fehler beendet.
- **Datenaustausch:** Nach dem Absenden kontaktiert der Browser `api.github.com`, beim Öffnen eines Gebäudes zusätzlich `raw.githubusercontent.com`. Nur die ausgewählte Datei wird zur Messung gelesen; der Snapshot enthält relative Pfade und Metriken. RepoCity verwendet dafür keinen eigenen Server und speichert keine Tokens oder Repository-Daten im Browser-Speicher.

## Entdecken

- **Drehen:** linke Maustaste ziehen; auf Touchscreens mit einem Finger.
- **Verschieben:** rechte Maustaste ziehen; auf Touchscreens mit zwei Fingern.
- **Zoomen:** Scrollrad, Pinch-Geste oder die Plus-/Minus-Tasten.
- **Zurück zur Übersicht:** die Taste „Ansicht zurücksetzen“ rechts unten.
- **Module erkunden:** Gebäude oder Miniatur-Stadtplan anklicken. Alternativ das barrierearm per Tastatur bedienbare Modul-Auswahlfeld verwenden.
- **Viertel hervorheben:** ein Viertel links auswählen; erneut klicken, um die Hervorhebung zu entfernen.
- **Datenquelle:** GitHub, das mitgelieferte RepoCity-Startbeispiel oder die Demo wählen. Der aktive Datenstand wird in der Stadtüberschrift und den Gebäudeinformationen angezeigt.
- **Neue Stadt:** Seed wählen, in der Demo außerdem Repository-Demoname und Stadtgröße, dann „Stadt generieren“. Der Würfel setzt nur das Seed-Eingabefeld; erzeugt wird erst beim Absenden.

Die Startansicht zeigt den mitgelieferten RepoCity-Snapshot mit Seed `hello-world`, während das Formular bereits für einen GitHub-Import bereitsteht. Netzwerkaufrufe erfolgen erst beim Laden. In der Datenquelle „Demo“ bestimmt der Repository-Name ausschließlich fiktive Modulmetriken und wird nicht von GitHub abgerufen. Derselbe Snapshot und Seed erzeugen dieselbe Stadt – einschließlich Pflanzen, Autos und Gebäudedetails. Ein anderer Seed ändert Straßenverlauf, Parzellen, Architektur und Dekoration, nicht die Modulidentität oder Metriken; ein erneuter GitHub-Import kann inzwischen geänderten Quellcode enthalten.

Die Stadt wächst aus unterschiedlich großen Parzellen entlang einer leicht geschwungenen Flusspromenade. Hauptstraßen mit Brücken verbinden beide Ufer; versetzte Nebenstraßen bilden T-Kreuzungen. Gebäude orientieren sich an den Straßen und teilen sich begrünte Innenhöfe. Gärten und ein zentraler Marktplatz mit Funkturm unterbrechen die Bebauung. Der Miniatur-Stadtplan zeigt dieselben Straßen, Parzellen und Gebäudeausrichtungen.

## Optional: lokales Startbeispiel und CLI

Für das Startbeispiel analysiert ein Vite-Plugin beim Start des Entwicklungsservers und beim Produktionsbuild das Projektverzeichnis. Der Browser erhält einen Snapshot aus relativen Dateipfaden und gemessenen Metriken; der lokale Analyzer übernimmt keine Quelltextinhalte in den Snapshot und führt keinen Projektcode aus. Ein Produktionsbuild enthält diesen festen Datenstand zusätzlich zur GitHub-Importfunktion. Nach Änderungen am Startbeispiel den Entwicklungsserver neu starten bzw. neu bauen. Besucher benötigen diese lokale Analyse nicht.

Entwickler können optional ein anderes lokales Projekt als mitgeliefertes Startbeispiel wählen:

```sh
REPOCITY_REPOSITORY=/absoluter/pfad/zum/projekt npm run dev
REPOCITY_REPOSITORY=/absoluter/pfad/zum/projekt npm run build
```

Ein eigenständiger Analyzer exportiert dasselbe anbieterunabhängige Datenformat, beispielsweise für weitere Adapter oder Auswertungen:

```sh
npm run analyze -- . --output /tmp/repocity-snapshot.json
npm run analyze -- /pfad/zum/projekt --name mein-projekt --output /tmp/projekt-snapshot.json
```

- **Ein Gebäude pro Quelldatei:** IDs sind relative Dateipfade und bleiben bei Inhaltsänderungen stabil.
- **Viertel nach Ordnern:** Unter `src`, `app` und `lib` wird nach dem unmittelbar nächsten Unterordner gruppiert, z. B. `src/city`. Andere Verzeichnisse werden nach dem obersten Ordner gruppiert; Dateien auf Projektebene bilden die „Projektwurzel“.
- **Gemessene Größe:** `lines` zählt nichtleere Zeilen, einschließlich Kommentaren. Leerzeilen zählen nicht. Gebäudehöhen folgen einer festen logarithmischen Skala mit 2–13 Geschossen, sodass auch kleine Dateien unterscheidbar sind.
- **Unterstützte Dateien:** TypeScript, JavaScript, CSS/SCSS, HTML, Vue, Svelte, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C/C++, C#, Shell und SQL.
- **Ausgeschlossen:** Versteckte Dateien und Ordner, Symlinks, `node_modules`, `dist`, `build`, `coverage`, `test-results`, `playwright-report`, `vendor`, `target`, `__pycache__`, `*.min.*`, `*.generated.*`, Dateien über 1 MiB und Inhalte mit Nullbytes. Die Ausschlüsse sind fest definiert; `.gitignore` wird noch nicht ausgewertet.
- **Fehlende Metriken:** Abhängigkeiten und Testabdeckung werden nicht aus der Dateistruktur abgeleitet. Ihre Werte sind `null` und erscheinen als „Nicht verfügbar“, ohne Prozentbalken. Gemessene Nullwerte bleiben davon unterscheidbar.
- **Fehler:** Leere Projekte oder nicht lesbare Verzeichnisse liefern einen Fehler statt fiktiver Ersatzdaten. Die Regeln für Dateiauswahl, Gruppierung und Messung werden vom lokalen und vom GitHub-Adapter gemeinsam verwendet.

## Architektur

```text
src/
  domain/repository.ts       Anbieterunabhängiger RepositorySnapshot
  data/mockRepository.ts     Optionaler Mock-Datenadapter
  data/localRepository.d.ts  Typisierung des lokal erzeugten Snapshots
  data/sourceRepository.mjs  Gemeinsame Dateifilter, Messung und Ordnerzuordnung
  data/githubRepository.ts   GitHub-Import mit Commitbindung, Limits und Abbruch
  city/
    types.ts                Serialisierbares Stadtmodell
    random.ts               Seed-Hash und lokaler Zufallsgenerator
    generateCity.ts         Reine Funktion: Snapshot + Seed → CityLayout
  scene/
    primitives.ts           Renderprimitive und Instanzdaten
    buildings.ts            Vier Architekturstile und Gebäudedetails
    environment.ts          Straßen, Fluss, Brücken, Marktplatz und Landschaft
    compileCity.ts          CityLayout → gebündelte Renderprimitive
    CityScene.tsx           R3F-Renderer, Beleuchtung, Picking und Kamera
  ui/                       Gebäudeinformationen und Miniatur-Stadtplan
  App.tsx                   Formularzustand und Verknüpfung der Schichten
tooling/
  analyzeRepository.mjs     Lokale Dateianalyse ohne Projektausführung
  repositorySnapshot.ts    Vite-Plugin für den Snapshot bei Start/Build
scripts/analyze.mjs         CLI-Export für beliebige lokale Projektverzeichnisse
```

### Adaptervertrag

Die Adapter liefern einen `RepositorySnapshot` aus `src/domain/repository.ts`:

```ts
const snapshot: RepositorySnapshot = {
  name: 'owner/repository',
  source: 'github',
  districts: [{ id: 'core', name: 'Core', subtitle: 'Kernmodule', color: '#ed9a72' }],
  modules: [
    {
      id: 'src/core/auth',
      name: 'auth',
      path: 'src/core/auth',
      districtId: 'core',
      language: 'TypeScript',
      description: 'Authentifizierung',
      metrics: { lines: 2400, files: 12, dependencies: 4, coverage: 90 },
    },
  ],
}
const city = generateCity(snapshot, { seed: 'hello-world' })
```

Der Adapter ist für Gruppierung, Metriken und stabile Modul-IDs verantwortlich. Stadtgenerator und Renderer benötigen keine API-Kenntnis. Duplikate, unbekannte Viertel und negative bzw. nicht endliche Metriken werden abgewiesen; Testabdeckung muss zwischen 0 und 100 liegen oder `null` sein. Für nicht erfasste Abhängigkeiten ebenfalls `null` verwenden. Die Gebäudehöhe ergibt sich standardmäßig aus Codezeilen (2–13 Geschosse), die Fassadenfarbe aus dem Viertel. GitHub-Snapshots setzen `sizeMetric: 'bytes'` und liefern `metrics.bytes` aus der Dateistruktur; `metrics.lines` bleibt im importierten Snapshot `null`; einzeln gemessene Zeilenzahlen werden im geöffneten Infofenster gehalten. Ihre Höhen bleiben auch nach einer Codezeilenmessung auf derselben Byteskala. Fehlen die für die gewählte Skala nötigen Werte, wird der Snapshot abgewiesen. Die Darstellung ist eine Exploration, keine Qualitätsbewertung von Code. Optionale Felder `url`, `revision` und `notice` ergänzen Herkunft, Commit und Hinweise zur Datengrundlage.

### Rendering und Grenzen

- Fenster, Fassaden, Straßen und Landschaft werden zu **fünf InstancedMesh-Gruppen** zusammengefasst. Die Anzahl der Draw Calls für diese Gruppen wächst nicht mit der Modulanzahl; Schatten und Auswahl ergänzen weitere Renderdurchläufe.
- Eine separate Picking-Instanz pro Gebäude verhindert Raycasts gegen jedes einzelne Fenster. Die vereinfachten Auswahlvolumen umfassen auch Dach- und Terrassenbereiche.
- `frameloop="demand"` rendert nur bei Änderungen und Kamerabewegungen. Die Pixelauflösung ist auf DPR 1,75 begrenzt, Schatten auf 2048².
- Drei Demonstrationsgrößen: **96, 256 und 768 Gebäude**. GitHub-Importe zeigen auch größere Repositories vollständig. Ab 1.501 Gebäuden werden Fassaden mit weniger Details dargestellt; Gebäudezahl, Höhen, Farben und Auswahl bleiben erhalten. Generator- und Browser-Tests prüfen zusätzlich 5.905 Dateien, ohne einen universellen FPS-Wert zu versprechen.
- Schriftarten, Geometrie und Startbeispiel werden mit der Website ausgeliefert; keine externen Texturen, Modelle oder Font-CDNs. Nur ein ausdrücklich gestarteter GitHub-Import lädt Repository-Daten von GitHub.
- Die erste Three.js-Ladung ist relativ groß (~250 KB gzip); sie wird separat nach der Oberfläche geladen. Vite meldet dafür einen Chunkgrößen-Hinweis.
- Für sehr große reale Repositories wären Worker-Generierung, räumlich getrennte Instanzgruppen und entfernungsabhängige Details die nächsten Schritte. Der aktuelle Prototyp generiert auf dem Hauptthread und rendert die gesamte Stadt.
- WebGL ist erforderlich. Falls es nicht verfügbar ist, bleiben Modulauswahl und Informationen in der Seitenleiste nutzbar. Mobil befindet sich die Seitenleiste hinter „Stadt erkunden“.

Die Instanz- und Bedarfsrendering-Strategie folgt den [Performance-Empfehlungen von React Three Fiber](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

## Prüfungen

Vitest prüft reale Zeilenzählung, Ordnerzuordnung, Dateiausschlüsse und Symlinks, stabile IDs, CLI-Export, GitHub-Eingaben, Commitbindung, vollständigen Metadatenimport, Messung einzelner Dateien, Downloadgrenzen pro Messung, Fortschritt, Rate-Limits, Abbruch und Zeitlimit sowie Seed-Reproduzierbarkeit, unveränderte Quelldaten, Unabhängigkeit von der Modulreihenfolge, vollständige Zuordnung, kollisionsfreie und ausgerichtete Gebäude, verbundene Straßen, T-Kreuzungen, Stadtgrenzen, fehlende und ungültige Metriken und gültige Renderprimitive. Playwright prüft den lokalen Snapshot, den GitHub-Import mit kontrollierten HTTP-Antworten, Fehler und Abbruch, Commitlinks, den Wechsel zur Demo und zurück, tatsächliches WebGL-Picking, Formulare, Viertelfilter, Kameratasten, mobile Bedienung sowie Städte mit 768 und 5.905 Gebäuden einschließlich nachgeladener Messwerte, Wiederverwendung und Fehlerwiederholung. Mit `REPOCITY_E2E_PREVIEW=1` läuft dieselbe Suite gegen die statische Produktionsversion. Screenshots für die visuelle Kontrolle entstehen unter `test-results/` und werden nicht eingecheckt.

## Lizenz

[MIT](LICENSE)
