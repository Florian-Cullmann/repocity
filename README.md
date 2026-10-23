# RepoCity

Eine interaktive Low-Poly-Modellstadt für Software-Repositories. RepoCity zeigt standardmäßig **die eigene, lokal analysierte Codebasis**. Jede Quelldatei wird ein Gebäude, Ordner bilden die Viertel. Eine Demo mit fiktiven Daten bleibt auswählbar. Es gibt weder eine GitHub-API-Anbindung noch Authentifizierung oder einen Backenddienst.

React · TypeScript · Vite · Three.js · React Three Fiber

![RepoCity-Demo mit sechs Vierteln, 96 Gebäuden und einem zentralen Park](docs/preview.png)

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
```

## Entdecken

- **Drehen:** linke Maustaste ziehen; auf Touchscreens mit einem Finger.
- **Verschieben:** rechte Maustaste ziehen; auf Touchscreens mit zwei Fingern.
- **Zoomen:** Scrollrad, Pinch-Geste oder die Plus-/Minus-Tasten.
- **Zurück zur Übersicht:** die Taste „Ansicht zurücksetzen“ rechts unten.
- **Module erkunden:** Gebäude oder Miniatur-Stadtplan anklicken. Alternativ das barrierearm per Tastatur bedienbare Modul-Auswahlfeld verwenden.
- **Viertel hervorheben:** ein Viertel links auswählen; erneut klicken, um die Hervorhebung zu entfernen.
- **Datenquelle:** Zwischen lokalem Repository und Demo wählen, dann „Stadt generieren“. Der aktive Datenstand wird in der Stadtüberschrift und den Gebäudeinformationen angezeigt.
- **Neue Stadt:** Seed wählen, in der Demo außerdem Repository-Demoname und Stadtgröße, dann „Stadt generieren“. Der Würfel setzt nur das Seed-Eingabefeld; erzeugt wird erst beim Absenden.

Die Startkonfiguration ist der lokale RepoCity-Snapshot mit Seed `hello-world`. In der Demo sind `owner/repository` und GitHub-Repository-URLs als **Demoname** möglich. Die Eingabe wird niemals von GitHub abgerufen und bestimmt nur die fiktiven Modulmetriken; die Demo startet mit `acme/atlas` und 96 Modulen. Derselbe Snapshot und Seed erzeugen dieselbe Stadt – einschließlich Pflanzen, Autos und Gebäudedetails. Ein anderer Seed ändert Architektur und Dekoration, nicht die Modulidentität oder Metriken.

## Lokale Repository-Daten

Beim Start des Entwicklungsservers und beim Produktionsbuild analysiert ein Vite-Plugin das Projektverzeichnis. Der Browser erhält einen Snapshot aus relativen Dateipfaden und gemessenen Metriken; der Analyzer übernimmt keine Quelltextinhalte in den Snapshot und führt keinen Projektcode aus. Ein Produktionsbuild enthält diesen festen Datenstand. Nach Änderungen am analysierten Projekt den Entwicklungsserver neu starten bzw. neu bauen.

Andere lokale Projekte lassen sich ohne Änderung am Code anzeigen:

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
- **Fehler:** Leere Projekte oder nicht lesbare Verzeichnisse liefern einen Fehler statt fiktiver Ersatzdaten.

## Architektur

```text
src/
  domain/repository.ts       Anbieterunabhängiger RepositorySnapshot
  data/mockRepository.ts     Optionaler Mock-Datenadapter
  data/localRepository.d.ts  Typisierung des lokal erzeugten Snapshots
  city/
    types.ts                Serialisierbares Stadtmodell
    random.ts               Seed-Hash und lokaler Zufallsgenerator
    generateCity.ts         Reine Funktion: Snapshot + Seed → CityLayout
  scene/
    primitives.ts           Renderprimitive und Instanzdaten
    buildings.ts            Vier Architekturstile und Gebäudedetails
    environment.ts          Straßen, Park, Funkturm, Bäume und Dekoration
    compileCity.ts          CityLayout → gebündelte Renderprimitive
    CityScene.tsx           R3F-Renderer, Beleuchtung, Picking und Kamera
  ui/                       Gebäudeinformationen und Miniatur-Stadtplan
  App.tsx                   Formularzustand und Verknüpfung der Schichten
tooling/
  analyzeRepository.mjs     Lokale Dateianalyse ohne Projektausführung
  repositorySnapshot.ts    Vite-Plugin für den Snapshot bei Start/Build
scripts/analyze.mjs         CLI-Export für beliebige lokale Projektverzeichnisse
```

### Später GitHub-Daten

Ein neuer Adapter liefert einen `RepositorySnapshot` aus `src/domain/repository.ts`:

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

Der Adapter ist für Gruppierung, Metriken und stabile Modul-IDs verantwortlich. Stadtgenerator und Renderer benötigen keine API-Kenntnis. Duplikate, unbekannte Viertel und negative bzw. nicht endliche Metriken werden abgewiesen; Testabdeckung muss zwischen 0 und 100 liegen oder `null` sein. Für nicht erfasste Abhängigkeiten ebenfalls `null` verwenden. Die Gebäudehöhe ergibt sich aus Codezeilen (2–13 Geschosse), die Fassadenfarbe aus dem Viertel. Die Darstellung ist eine Exploration, keine Qualitätsbewertung von Code. Die Oberfläche unterscheidet lokale Quelldaten und Mockdaten; eine spätere Live-Anbindung benötigt eigene Lade- und Fehlerzustände.

### Rendering und Grenzen

- Fenster, Fassaden, Straßen und Landschaft werden zu **fünf InstancedMesh-Gruppen** zusammengefasst. Die Anzahl der Draw Calls für diese Gruppen wächst nicht mit der Modulanzahl; Schatten und Auswahl ergänzen weitere Renderdurchläufe.
- Eine separate Picking-Instanz pro Gebäude verhindert Raycasts gegen jedes einzelne Fenster. Die vereinfachten Auswahlvolumen umfassen auch Dach- und Terrassenbereiche.
- `frameloop="demand"` rendert nur bei Änderungen und Kamerabewegungen. Die Pixelauflösung ist auf DPR 1,75 begrenzt, Schatten auf 2048².
- Drei Demonstrationsgrößen: **96, 256 und 768 Gebäude**. Generator-Tests prüfen zusätzlich 2.000 Module. Browser-Tests prüfen 768 Gebäude, ohne einen universellen FPS-Wert zu versprechen.
- Schriftarten, Geometrie und Repository-Snapshot werden lokal ausgeliefert; keine externen Texturen, Modelle, Font-CDNs oder API-Aufrufe. Der Open-Source-Link führt auf Wunsch zu GitHub.
- Die erste Three.js-Ladung ist relativ groß (~250 KB gzip); sie wird separat nach der Oberfläche geladen. Vite meldet dafür einen Chunkgrößen-Hinweis.
- Für sehr große reale Repositories wären Worker-Generierung, räumlich getrennte Instanzgruppen und entfernungsabhängige Details die nächsten Schritte. Der aktuelle Prototyp generiert auf dem Hauptthread und rendert die gesamte Stadt.
- WebGL ist erforderlich. Falls es nicht verfügbar ist, bleiben Modulauswahl und Informationen in der Seitenleiste nutzbar. Mobil befindet sich die Seitenleiste hinter „Stadt erkunden“.

Die Instanz- und Bedarfsrendering-Strategie folgt den [Performance-Empfehlungen von React Three Fiber](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

## Prüfungen

Vitest prüft reale Zeilenzählung, Ordnerzuordnung, Dateiausschlüsse und Symlinks, stabile IDs, CLI-Export und Fehlerfälle sowie Seed-Reproduzierbarkeit, unveränderte Quelldaten, Unabhängigkeit von der Modulreihenfolge, vollständige Zuordnung, Straßenabstände, Stadtgrenzen, fehlende und ungültige Metriken und gültige Renderprimitive. Playwright prüft den echten lokalen Snapshot einschließlich gemessener Werte, fehlende Metriken, den Wechsel zur Demo und zurück, tatsächliches WebGL-Picking, Formulare, Viertelfilter, Kameratasten, mobile Bedienung und die 768-Modul-Stadt. Screenshots für die visuelle Kontrolle entstehen unter `test-results/` und werden nicht eingecheckt.

## Lizenz

[MIT](LICENSE)
