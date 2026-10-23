# RepoCity

Eine interaktive Low-Poly-Modellstadt für Software-Repositories. Der erste Prototyp verwendet **ausschließlich lokale, fiktive Mockdaten** – es gibt weder eine GitHub-API-Anbindung noch Authentifizierung oder einen Backenddienst.

React · TypeScript · Vite · Three.js · React Three Fiber

![RepoCity mit sechs Vierteln, 96 Gebäuden und einem zentralen Park](docs/preview.png)

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
npm test            # Generator- und Geometrie-Tests
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
- **Neue Stadt:** Repository-Demoname, Seed und Stadtgröße wählen, dann „Stadt generieren“. Der Würfel setzt nur das Seed-Eingabefeld; erzeugt wird erst beim Absenden.

`owner/repository` und GitHub-Repository-URLs sind als **Demoname** möglich. Die Eingabe wird niemals von GitHub abgerufen. Sie bestimmt die fiktiven Modulmetriken. Die Startkonfiguration ist `acme/atlas`, Seed `hello-world`, 96 Module. Derselbe Snapshot und Seed erzeugen dieselbe Stadt – einschließlich Pflanzen, Autos und Gebäudedetails. Ein anderer Seed ändert Architektur und Dekoration, nicht die Modulidentität oder Metriken.

## Architektur

```text
src/
  domain/repository.ts       Anbieterunabhängiger RepositorySnapshot
  data/mockRepository.ts     Austauschbarer Mock-Datenadapter
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
```

### Später echte Repository-Daten

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

Der Adapter ist für Gruppierung, Metriken und stabile Modul-IDs verantwortlich. Stadtgenerator und Renderer benötigen keine API-Kenntnis. Duplikate, unbekannte Viertel und negative bzw. nicht endliche Metriken werden abgewiesen. Die Gebäudehöhe ergibt sich aus Codezeilen (2–13 Geschosse), die Fassadenfarbe aus dem Viertel. Die Darstellung ist eine Exploration, keine Qualitätsbewertung von Code. Die derzeitige Oberfläche kennzeichnet alles ausdrücklich als Mockdaten und muss bei einer späteren Live-Anbindung entsprechend erweitert werden.

### Rendering und Grenzen

- Fenster, Fassaden, Straßen und Landschaft werden zu **fünf InstancedMesh-Gruppen** zusammengefasst. Die Anzahl der Draw Calls für diese Gruppen wächst nicht mit der Modulanzahl; Schatten und Auswahl ergänzen weitere Renderdurchläufe.
- Eine separate Picking-Instanz pro Gebäude verhindert Raycasts gegen jedes einzelne Fenster. Die vereinfachten Auswahlvolumen umfassen auch Dach- und Terrassenbereiche.
- `frameloop="demand"` rendert nur bei Änderungen und Kamerabewegungen. Die Pixelauflösung ist auf DPR 1,75 begrenzt, Schatten auf 2048².
- Drei Demonstrationsgrößen: **96, 256 und 768 Gebäude**. Generator-Tests prüfen zusätzlich 2.000 Module. Browser-Tests prüfen 768 Gebäude, ohne einen universellen FPS-Wert zu versprechen.
- Schriftarten und Geometrie werden lokal ausgeliefert; keine externen Texturen, Modelle, Font-CDNs oder API-Aufrufe. Der Open-Source-Link führt auf Wunsch zu GitHub.
- Die erste Three.js-Ladung ist relativ groß (~250 KB gzip); sie wird separat nach der Oberfläche geladen. Vite meldet dafür einen Chunkgrößen-Hinweis.
- Für sehr große reale Repositories wären Worker-Generierung, räumlich getrennte Instanzgruppen und entfernungsabhängige Details die nächsten Schritte. Der aktuelle Prototyp generiert auf dem Hauptthread und rendert die gesamte Stadt.
- WebGL ist erforderlich. Falls es nicht verfügbar ist, bleiben Modulauswahl und Informationen in der Seitenleiste nutzbar. Mobil befindet sich die Seitenleiste hinter „Stadt erkunden“.

Die Instanz- und Bedarfsrendering-Strategie folgt den [Performance-Empfehlungen von React Three Fiber](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

## Prüfungen

Vitest prüft Seed-Reproduzierbarkeit, unveränderte Quelldaten, Unabhängigkeit von der Modulreihenfolge, vollständige Zuordnung, Straßenabstände, Stadtgrenzen, Eingabefehler und gültige Renderprimitive. Playwright prüft tatsächliches WebGL-Picking, Formulare, Viertelfilter, Kameratasten, mobile Bedienung und die 768-Modul-Stadt. Screenshots für die visuelle Kontrolle entstehen unter `test-results/` und werden nicht eingecheckt.

## Lizenz

[MIT](LICENSE)
