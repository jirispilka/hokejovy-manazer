# M1 — Hratelná kostra: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hratelná kostra hokejového manažera — výběr klubu z 2. ligy, sestava, simulace zápasů (výsledek + textový průběh), tabulky tří lig, celá sezóna s playoff a postupem/sestupem, ukládání.

**Architecture:** Herní jádro je čistá TypeScript knihovna v `src/core/` (žádné importy z UI ani Tauri, jen plain-JSON datové struktury, deterministická simulace se seedovaným RNG). React UI v `src/ui/` jádro pouze volá a zobrazuje `GameState`. Tauri 2 obaluje aplikaci do desktopové binárky; ukládání přes filesystem plugin s localStorage fallbackem pro vývoj v prohlížeči.

**Tech Stack:** Tauri 2, React 18, TypeScript (strict), Vite, Vitest, @tauri-apps/plugin-fs

## Global Constraints

- Veškeré UI texty česky; identifikátory v kódu česky tam, kde jde o herní pojmy (`Hrac`, `sestava`, `goly`), technické pojmy anglicky (`createRng`, `GameState`).
- `src/core/` nesmí importovat nic z `src/ui/`, z Reactu ani z `@tauri-apps/*`.
- Celý `GameState` musí být serializovatelný přes `JSON.stringify` (žádné funkce, třídy, Mapy, Daty).
- Simulace je deterministická: stejný seed → stejné výsledky. Zdroj náhody se do funkcí jádra předává vždy jako parametr `Rng`.
- Atributy hráčů ve stupnici 1–99.
- Bodování: výhra 3 b., výhra v prodloužení/nájezdech 2 b., prohra v prodloužení/nájezdech 1 b., prohra 0 b. Zápas nikdy nekončí remízou.
- Ligy: uroven 0 = Extraliga, 1 = Chance liga, 2 = 2. liga; každá 14 týmů, 26 kol, playoff top 8 na 3 vítězné zápasy.
- Nové závislosti jen ty vyjmenované v Tech Stacku (+ dev tooling z Vite šablony). Žádný router, žádný state-management balík.
- Commity česky, krátké, prefix podle typu (`feat:`, `test:`, `chore:`).

## Struktura souborů

```
hokej-manazer/
├── package.json, vite.config.ts, tsconfig.json   (Vite react-ts šablona + vitest)
├── src-tauri/                                    (Tauri 2 shell, generovaný)
├── src/
│   ├── core/
│   │   ├── rng.ts          seedovaný RNG + pomocné funkce
│   │   ├── types.ts        všechny datové typy jádra
│   │   ├── data/kluby.json 3 ligy × 14 reálných klubů
│   │   ├── jmena.ts        česká jména pro generování hráčů
│   │   ├── generator.ts    generování hráčů, týmů, světa
│   │   ├── sestava.ts      výchozí sestava, síla týmu, overall, výměny
│   │   ├── rozpis.ts       losování 26 kol + mapování na dny
│   │   ├── tabulka.ts      výpočet ligové tabulky
│   │   ├── simulace.ts     simulace zápasu → výsledek + události
│   │   ├── playoff.ts      pavouk, série na 3 výhry
│   │   ├── sezona.ts       newGame, advanceDay, přechod sezón
│   │   └── ulozeni.ts      serializace GameState
│   ├── ui/
│   │   ├── App.tsx         stav hry + přepínání obrazovek
│   │   ├── store.ts        ukládací backend (Tauri FS / localStorage)
│   │   ├── styl.css        globální tmavý styl
│   │   └── obrazovky/
│   │       ├── NovaHra.tsx, Prehled.tsx, Soupiska.tsx,
│   │       ├── Sestava.tsx, Zapas.tsx, Liga.tsx, Ulozeni.tsx
│   └── main.tsx
└── tests/core/*.test.ts    Vitest testy jádra (zrcadlí moduly)
```

---

### Task 1: Scaffold projektu (Vite + Tauri 2 + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `src/main.tsx`, `src-tauri/**` (generované šablonami)
- Create: `tests/core/smoke.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Consumes: —
- Produces: běžící `npm run tauri dev`, zelený `npx vitest run`; adresáře `src/core/`, `src/ui/`, `tests/core/`.

- [ ] **Step 1: Systémové prerekvizity Tauri (Linux)**

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
rustc --version || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- [ ] **Step 2: Vite šablona react-ts do kořene repa**

```bash
cd /home/jirka/dokumenty/honzik/hokej-manazer
npm create vite@latest . -- --template react-ts
# na dotaz „Current directory is not empty" zvol „Ignore files and continue"
npm install
```

- [ ] **Step 3: Přidat závislosti**

```bash
npm install @tauri-apps/api @tauri-apps/plugin-fs
npm install -D vitest @tauri-apps/cli
```

- [ ] **Step 4: Inicializovat Tauri**

```bash
npx tauri init --app-name hokej-manazer --window-title "Hokejový manažer" \
  --frontend-dist ../dist --dev-url http://localhost:5173 \
  --before-dev-command "npm run dev" --before-build-command "npm run build"
cd src-tauri && cargo add tauri-plugin-fs && cd ..
```

V `src-tauri/src/lib.rs` zaregistrovat plugin (řádek s `.plugin(...)`):

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
```

Do `src-tauri/capabilities/default.json` do pole `"permissions"` přidat:

```json
"fs:default",
{ "identifier": "fs:scope", "allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**" }] }
```

- [ ] **Step 5: Vitest + skripty v package.json**

Do `package.json` do `"scripts"` přidat `"test": "vitest run"`. Do `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 6: Kostra adresářů + smoke test**

```bash
mkdir -p src/core/data src/ui/obrazovky tests/core
```

`tests/core/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('vitest běží', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 7: Ověřit, že vše běží**

Run: `npm run test` → Expected: `1 passed`
Run: `npm run tauri dev` → Expected: otevře se desktopové okno s Vite úvodní stránkou; zavři ho.

- [ ] **Step 8: Commit**

```bash
cat > .gitignore <<'EOF'
node_modules
dist
src-tauri/target
EOF
git add -A && git commit -m "chore: scaffold Vite + Tauri 2 + Vitest"
```

---

### Task 2: Seedovaný RNG (`src/core/rng.ts`)

**Files:**
- Create: `src/core/rng.ts`
- Test: `tests/core/rng.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `type Rng = () => number` (rovnoměrně [0,1)); `createRng(seed: number): Rng`; `randInt(rng: Rng, min: number, max: number): number` (včetně obou mezí); `pick<T>(rng: Rng, pole: T[]): T`; `hashSeed(...casti: number[]): number` (deterministický 32bit hash pro odvozování pod-seedů).

- [ ] **Step 1: Napsat failing test** — `tests/core/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, pick, randInt } from '../../src/core/rng'

describe('createRng', () => {
  it('stejný seed dává stejnou sekvenci', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('různé seedy dávají různé sekvence', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })
  it('vrací čísla v [0,1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const x = rng()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('randInt', () => {
  it('drží meze včetně krajů a trefí je', () => {
    const rng = createRng(3)
    const videno = new Set<number>()
    for (let i = 0; i < 1000; i++) videno.add(randInt(rng, 1, 6))
    expect([...videno].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('pick', () => {
  it('vybírá jen prvky pole', () => {
    const rng = createRng(9)
    for (let i = 0; i < 100; i++) expect(['a', 'b']).toContain(pick(rng, ['a', 'b']))
  })
})

describe('hashSeed', () => {
  it('je deterministický a citlivý na pořadí', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3))
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1))
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, `Cannot find module '../../src/core/rng'` (nebo obdoba).

- [ ] **Step 3: Implementace** — `src/core/rng.ts` (mulberry32 + FNV-1a):

```ts
export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, pole: T[]): T {
  return pole[Math.floor(rng() * pole.length)]
}

export function hashSeed(...casti: number[]): number {
  let h = 2166136261 >>> 0
  for (const c of casti) {
    h ^= c >>> 0
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
```

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (rng testy + smoke).

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts tests/core/rng.test.ts
git commit -m "feat: seedovaný RNG pro deterministickou simulaci"
```

---

### Task 3: Datové typy a kluby (`src/core/types.ts`, `src/core/data/kluby.json`)

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/data/kluby.json`
- Test: `tests/core/kluby.test.ts`

**Interfaces:**
- Consumes: —
- Produces: všechny typy jádra (viz kód níže — pozdější tasky je používají přesně takto) a `kluby.json` se 42 kluby `{ id, nazev, liga }`.

- [ ] **Step 1: Typy** — `src/core/types.ts`:

```ts
export type Pozice = 'G' | 'D' | 'U'

export interface Atributy {
  strelba: number
  prihravky: number
  brusleni: number
  obrana: number
  fyzicka: number
  chytani: number // relevantní jen pro brankáře, ostatní mají nízké
}

export interface Hrac {
  id: string
  jmeno: string
  prijmeni: string
  vek: number
  pozice: Pozice
  atributy: Atributy
  potencial: number // strop overall, u hráčů 24+ rovný aktuálnímu overall
  forma: number // 30–70, výchozí 50
  unava: number // 0–100, výchozí 0
  goly: number // statistiky aktuální sezóny
  asistence: number
}

export interface Klub {
  id: string
  nazev: string
  liga: number // 0 = Extraliga, 1 = Chance liga, 2 = 2. liga
}

export interface Sestava {
  utoky: string[][] // 4 lajny × 3 id hráčů
  obrany: string[][] // 3 dvojice × 2 id hráčů
  brankar: string // id brankáře
}

export interface Tym {
  klubId: string
  nazev: string
  hraci: Hrac[]
  sestava: Sestava
  moralka: number // 30–70, výchozí 50
}

export interface Udalost {
  minuta: number
  typ: 'gol' | 'strela' | 'zakrok' | 'vylouceni' | 'info'
  tymId: string
  text: string
  hracId?: string // střelec / vyloučený
  asistentId?: string
}

export interface Vysledek {
  golyDomaci: number
  golyHoste: number
  strelyDomaci: number
  strelyHoste: number
  prodlouzeni: boolean
  najezdy: boolean
  udalosti: Udalost[]
}

export interface Zapas {
  kolo: number
  den: number // herní den sezóny, kdy se hraje
  domaci: string // klubId
  hoste: string
  vysledek: Vysledek | null
}

export interface Serie {
  domaci: string // výše nasazený (má výhodu ledu v zápasech 1, 2, 5)
  hoste: string
  vyhryDomaci: number
  vyhryHoste: number
}

export interface Playoff {
  kola: Serie[][] // [čtvrtfinále(4), semifinále(2), finále(1)]
  vitez: string | null
}

export interface Liga {
  uroven: number
  nazev: string
  tymy: string[] // klubIds
  zapasy: Zapas[]
  playoff: Playoff | null
}

export type Faze = 'zakladniCast' | 'playoff' | 'konecSezony'

export interface PosledniZapas {
  den: number
  domaci: string
  hoste: string
  vysledek: Vysledek
}

export interface GameState {
  seed: number
  sezona: number // 1, 2, 3…
  den: number // herní den od začátku sezóny, začíná 0
  faze: Faze
  mujKlubId: string
  tymy: Record<string, Tym>
  ligy: Liga[] // index = uroven
  zpravy: string[] // nejnovější první
  posledniZapas: PosledniZapas | null // poslední zápas mého klubu (pro obrazovku Zápas)
}
```

- [ ] **Step 2: Failing test na data klubů** — `tests/core/kluby.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import kluby from '../../src/core/data/kluby.json'
import type { Klub } from '../../src/core/types'

describe('kluby.json', () => {
  const vsechny = kluby as Klub[]
  it('má 3 ligy po 14 klubech', () => {
    for (const liga of [0, 1, 2]) {
      expect(vsechny.filter((k) => k.liga === liga)).toHaveLength(14)
    }
  })
  it('má unikátní id', () => {
    expect(new Set(vsechny.map((k) => k.id)).size).toBe(42)
  })
})
```

Pozn.: import JSON vyžaduje v `tsconfig.json` (blok `compilerOptions`) `"resolveJsonModule": true` — přidej, pokud v šabloně chybí.

- [ ] **Step 3: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, kluby.json neexistuje.

- [ ] **Step 4: Data klubů** — `src/core/data/kluby.json` (id = slug bez diakritiky):

```json
[
  { "id": "sparta", "nazev": "HC Sparta Praha", "liga": 0 },
  { "id": "pardubice", "nazev": "HC Dynamo Pardubice", "liga": 0 },
  { "id": "trinec", "nazev": "HC Oceláři Třinec", "liga": 0 },
  { "id": "kometa", "nazev": "HC Kometa Brno", "liga": 0 },
  { "id": "litvinov", "nazev": "HC Verva Litvínov", "liga": 0 },
  { "id": "boleslav", "nazev": "BK Mladá Boleslav", "liga": 0 },
  { "id": "plzen", "nazev": "HC Škoda Plzeň", "liga": 0 },
  { "id": "budejovice", "nazev": "HC Motor České Budějovice", "liga": 0 },
  { "id": "vitkovice", "nazev": "HC Vítkovice Ridera", "liga": 0 },
  { "id": "olomouc", "nazev": "HC Olomouc", "liga": 0 },
  { "id": "hradec", "nazev": "Mountfield HK", "liga": 0 },
  { "id": "vary", "nazev": "HC Energie Karlovy Vary", "liga": 0 },
  { "id": "liberec", "nazev": "Bílí Tygři Liberec", "liga": 0 },
  { "id": "kladno", "nazev": "Rytíři Kladno", "liga": 0 },
  { "id": "zlin", "nazev": "Berani Zlín", "liga": 1 },
  { "id": "vsetin", "nazev": "VHK Robe Vsetín", "liga": 1 },
  { "id": "jihlava", "nazev": "HC Dukla Jihlava", "liga": 1 },
  { "id": "slavia", "nazev": "HC Slavia Praha", "liga": 1 },
  { "id": "poruba", "nazev": "HC RT Torax Poruba", "liga": 1 },
  { "id": "prerov", "nazev": "HC Zubr Přerov", "liga": 1 },
  { "id": "prostejov", "nazev": "LHK Jestřábi Prostějov", "liga": 1 },
  { "id": "litomerice", "nazev": "HC Stadion Litoměřice", "liga": 1 },
  { "id": "kolin", "nazev": "SC Kolín", "liga": 1 },
  { "id": "sokolov", "nazev": "HC Baník Sokolov", "liga": 1 },
  { "id": "frydek", "nazev": "HC Frýdek-Místek", "liga": 1 },
  { "id": "trebic", "nazev": "SK Horácká Slavia Třebíč", "liga": 1 },
  { "id": "znojmo", "nazev": "Orli Znojmo", "liga": 1 },
  { "id": "chomutov", "nazev": "Piráti Chomutov", "liga": 1 },
  { "id": "tabor", "nazev": "HC Tábor", "liga": 2 },
  { "id": "vrchlabi", "nazev": "HC Stadion Vrchlabí", "liga": 2 },
  { "id": "decin", "nazev": "HC Děčín", "liga": 2 },
  { "id": "kobra", "nazev": "HC Kobra Praha", "liga": 2 },
  { "id": "letnany", "nazev": "HC Letci Letňany", "liga": 2 },
  { "id": "pribram", "nazev": "HC Příbram", "liga": 2 },
  { "id": "klatovy", "nazev": "SHC Klatovy", "liga": 2 },
  { "id": "most", "nazev": "HC Most", "liga": 2 },
  { "id": "zdar", "nazev": "SKLH Žďár nad Sázavou", "liga": 2 },
  { "id": "jicin", "nazev": "HC Nový Jičín", "liga": 2 },
  { "id": "opava", "nazev": "HC Slezan Opava", "liga": 2 },
  { "id": "havirov", "nazev": "AZ Havířov", "liga": 2 },
  { "id": "hronov", "nazev": "HC Wikov Hronov", "liga": 2 },
  { "id": "pisek", "nazev": "IHC Písek", "liga": 2 }
]
```

- [ ] **Step 5: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/data/kluby.json tests/core/kluby.test.ts tsconfig.json
git commit -m "feat: datové typy jádra a reálné kluby tří lig"
```

---

### Task 4: Generátor hráčů a týmů (`src/core/jmena.ts`, `src/core/generator.ts`)

**Files:**
- Create: `src/core/jmena.ts`
- Create: `src/core/generator.ts`
- Test: `tests/core/generator.test.ts`

**Interfaces:**
- Consumes: `Rng`, `randInt`, `pick` z `rng.ts`; typy z `types.ts`; `kluby.json`.
- Produces: `generujHrace(rng: Rng, pozice: Pozice, uroven: number, vek?: number): Hrac`; `generujTym(rng: Rng, klub: Klub): Tym` (12 U + 6 D + 2 G, sestava viz Task 5); `generujSvet(seed: number): Record<string, Tym>` (týmy pro všech 42 klubů, klíč = klubId).

- [ ] **Step 1: Jména** — `src/core/jmena.ts`:

```ts
export const JMENA = [
  'Jakub', 'Jan', 'Tomáš', 'Petr', 'Martin', 'Lukáš', 'David', 'Ondřej',
  'Adam', 'Matěj', 'Filip', 'Vojtěch', 'Michal', 'Marek', 'Daniel', 'Šimon',
  'Dominik', 'Patrik', 'Radek', 'Jiří', 'Pavel', 'Roman', 'Aleš', 'Karel',
  'Václav', 'Josef', 'Milan', 'Zdeněk', 'Vladimír', 'Stanislav',
]

export const PRIJMENI = [
  'Novák', 'Svoboda', 'Novotný', 'Dvořák', 'Černý', 'Procházka', 'Kučera',
  'Veselý', 'Horák', 'Němec', 'Marek', 'Pospíšil', 'Pokorný', 'Hájek',
  'Král', 'Jelínek', 'Růžička', 'Beneš', 'Fiala', 'Sedláček', 'Doležal',
  'Zeman', 'Kolář', 'Navrátil', 'Čermák', 'Urban', 'Vaněk', 'Blažek',
  'Kříž', 'Kovář', 'Kratochvíl', 'Bartoš', 'Vlček', 'Polák', 'Musil',
  'Kopecký', 'Šimek', 'Konečný', 'Malý', 'Holub', 'Staněk', 'Kadlec',
  'Štěpánek', 'Dostál', 'Soukup', 'Šťastný', 'Mareš', 'Moravec', 'Tichý', 'Bureš',
]
```

- [ ] **Step 2: Failing test** — `tests/core/generator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generujHrace, generujSvet, generujTym } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import type { Klub } from '../../src/core/types'

const klub: Klub = { id: 'tabor', nazev: 'HC Tábor', liga: 2 }

describe('generujHrace', () => {
  it('drží atributy v 1–99 a věk v 17–38', () => {
    const rng = createRng(1)
    for (let i = 0; i < 200; i++) {
      const h = generujHrace(rng, 'U', 0)
      expect(h.vek).toBeGreaterThanOrEqual(17)
      expect(h.vek).toBeLessThanOrEqual(38)
      for (const v of Object.values(h.atributy)) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(99)
      }
    }
  })
  it('brankář má chytání výrazně lepší než bruslař', () => {
    const rng = createRng(2)
    const golman = generujHrace(rng, 'G', 0)
    const utocnik = generujHrace(rng, 'U', 0)
    expect(golman.atributy.chytani).toBeGreaterThan(utocnik.atributy.chytani)
  })
  it('extraligoví hráči jsou v průměru silnější než druholigoví', () => {
    const rng = createRng(3)
    const prumer = (uroven: number) => {
      let s = 0
      for (let i = 0; i < 100; i++) s += generujHrace(rng, 'U', uroven).atributy.strelba
      return s / 100
    }
    expect(prumer(0)).toBeGreaterThan(prumer(2) + 10)
  })
})

describe('generujTym', () => {
  it('má 12 útočníků, 6 obránců, 2 brankáře a vyplněnou sestavu', () => {
    const t = generujTym(createRng(4), klub)
    expect(t.hraci.filter((h) => h.pozice === 'U')).toHaveLength(12)
    expect(t.hraci.filter((h) => h.pozice === 'D')).toHaveLength(6)
    expect(t.hraci.filter((h) => h.pozice === 'G')).toHaveLength(2)
    expect(t.sestava.utoky).toHaveLength(4)
    expect(t.sestava.obrany).toHaveLength(3)
    expect(t.sestava.brankar).toBeTruthy()
  })
})

describe('generujSvet', () => {
  it('vytvoří 42 týmů a je deterministický', () => {
    const a = generujSvet(42)
    const b = generujSvet(42)
    expect(Object.keys(a)).toHaveLength(42)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
```

- [ ] **Step 3: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, generator.ts neexistuje.

- [ ] **Step 4: Implementace** — `src/core/generator.ts`:

```ts
import kluby from './data/kluby.json'
import { JMENA, PRIJMENI } from './jmena'
import { createRng, pick, randInt, type Rng } from './rng'
import type { Atributy, Hrac, Klub, Pozice, Tym } from './types'
import { vychoziSestava, overall } from './sestava'

// rozsah atributů podle úrovně ligy (0 = extraliga nejsilnější)
const ROZSAHY: [number, number][] = [
  [55, 88],
  [45, 75],
  [35, 65],
]

let dalsiId = 0
const noveId = () => `h${(dalsiId++).toString(36)}`
export const resetIdCitac = (n = 0) => (dalsiId = n)

export function generujHrace(rng: Rng, pozice: Pozice, uroven: number, vek?: number): Hrac {
  const [lo, hi] = ROZSAHY[uroven]
  const attr = () => randInt(rng, lo, hi)
  const slaby = () => randInt(rng, 10, 30)
  const atributy: Atributy =
    pozice === 'G'
      ? { strelba: slaby(), prihravky: slaby(), brusleni: attr(), obrana: attr(), fyzicka: attr(), chytani: attr() }
      : pozice === 'D'
        ? { strelba: randInt(rng, lo - 10, hi - 10), prihravky: attr(), brusleni: attr(), obrana: attr(), fyzicka: attr(), chytani: slaby() }
        : { strelba: attr(), prihravky: attr(), brusleni: attr(), obrana: randInt(rng, lo - 10, hi - 10), fyzicka: attr(), chytani: slaby() }
  const hrac: Hrac = {
    id: noveId(),
    jmeno: pick(rng, JMENA),
    prijmeni: pick(rng, PRIJMENI),
    vek: vek ?? randInt(rng, 17, 38),
    pozice,
    atributy,
    potencial: 0,
    forma: 50,
    unava: 0,
    goly: 0,
    asistence: 0,
  }
  const o = overall(hrac)
  hrac.potencial = hrac.vek < 24 ? Math.min(99, o + randInt(rng, 3, 15)) : o
  return hrac
}

export function generujTym(rng: Rng, klub: Klub): Tym {
  const hraci: Hrac[] = []
  for (let i = 0; i < 12; i++) hraci.push(generujHrace(rng, 'U', klub.liga))
  for (let i = 0; i < 6; i++) hraci.push(generujHrace(rng, 'D', klub.liga))
  for (let i = 0; i < 2; i++) hraci.push(generujHrace(rng, 'G', klub.liga))
  return { klubId: klub.id, nazev: klub.nazev, hraci, sestava: vychoziSestava(hraci), moralka: 50 }
}

export function generujSvet(seed: number): Record<string, Tym> {
  resetIdCitac()
  const rng = createRng(seed)
  const tymy: Record<string, Tym> = {}
  for (const klub of kluby as Klub[]) tymy[klub.id] = generujTym(rng, klub)
  return tymy
}
```

Pozn.: `vychoziSestava` a `overall` vzniknou v Tasku 5 — implementuj Task 5 souběžně, testy obou tasků pak projdou najednou (nebo Task 5 předřaď).

- [ ] **Step 5: Ověřit, že testy projdou** (po dokončení Tasku 5)

Run: `npm run test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/jmena.ts src/core/generator.ts tests/core/generator.test.ts
git commit -m "feat: generátor hráčů a týmů s českými jmény"
```

---

### Task 5: Sestava a síla týmu (`src/core/sestava.ts`)

**Files:**
- Create: `src/core/sestava.ts`
- Test: `tests/core/sestava.test.ts`

**Interfaces:**
- Consumes: typy z `types.ts`.
- Produces: `overall(h: Hrac): number` (1–99); `vychoziSestava(hraci: Hrac[]): Sestava` (nejlepší hráči do prvních lajn); `silaTymu(t: Tym): { utok: number; obrana: number; brankar: number }` (vážený průměr postavených hráčů vč. formy a únavy); `vymenVSestave(s: Sestava, idA: string, idB: string): Sestava` (prohodí dva hráče na pozicích v sestavě; idB smí být hráč mimo sestavu).

- [ ] **Step 1: Failing test** — `tests/core/sestava.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generujTym } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { overall, silaTymu, vychoziSestava, vymenVSestave } from '../../src/core/sestava'
import type { Hrac } from '../../src/core/types'

const tym = () => generujTym(createRng(11), { id: 'tabor', nazev: 'HC Tábor', liga: 2 })

describe('overall', () => {
  it('u brankáře je tažený chytáním', () => {
    const t = tym()
    const g = t.hraci.find((h) => h.pozice === 'G')!
    const silny = { ...g, atributy: { ...g.atributy, chytani: 90 } }
    const slaby = { ...g, atributy: { ...g.atributy, chytani: 20 } }
    expect(overall(silny)).toBeGreaterThan(overall(slaby) + 20)
  })
})

describe('vychoziSestava', () => {
  it('řadí útočníky podle overall do lajn (1. lajna nejsilnější)', () => {
    const t = tym()
    const podleId = new Map(t.hraci.map((h) => [h.id, h]))
    const prumerLajny = (l: string[]) =>
      l.reduce((s, id) => s + overall(podleId.get(id)!), 0) / l.length
    expect(prumerLajny(t.sestava.utoky[0])).toBeGreaterThanOrEqual(prumerLajny(t.sestava.utoky[3]))
  })
  it('nepoužije žádného hráče dvakrát', () => {
    const s = tym().sestava
    const vsichni = [...s.utoky.flat(), ...s.obrany.flat(), s.brankar]
    expect(new Set(vsichni).size).toBe(vsichni.length)
  })
})

describe('silaTymu', () => {
  it('vrací hodnoty v rozumném rozsahu 1–99', () => {
    const s = silaTymu(tym())
    for (const v of [s.utok, s.obrana, s.brankar]) {
      expect(v).toBeGreaterThan(1)
      expect(v).toBeLessThan(99)
    }
  })
  it('vyšší forma zvyšuje sílu', () => {
    const t = tym()
    const silnejsi = structuredClone(t)
    for (const h of silnejsi.hraci) h.forma = 70
    for (const h of t.hraci) h.forma = 30
    expect(silaTymu(silnejsi).utok).toBeGreaterThan(silaTymu(t).utok)
  })
})

describe('vymenVSestave', () => {
  it('prohodí hráče v lajně za náhradníka', () => {
    const t = tym()
    const vSestave = t.sestava.utoky[0][0]
    const mimo = t.hraci.find(
      (h) => h.pozice === 'U' && !t.sestava.utoky.flat().includes(h.id),
    )!
    const nova = vymenVSestave(t.sestava, vSestave, mimo.id)
    expect(nova.utoky[0][0]).toBe(mimo.id)
    expect(nova.utoky.flat()).not.toContain(vSestave)
  })
  it('prohodí dva hráče uvnitř sestavy', () => {
    const s = tym().sestava
    const a = s.utoky[0][0]
    const b = s.utoky[2][1]
    const nova = vymenVSestave(s, a, b)
    expect(nova.utoky[0][0]).toBe(b)
    expect(nova.utoky[2][1]).toBe(a)
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, sestava.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/sestava.ts`:

```ts
import type { Hrac, Sestava, Tym } from './types'

export function overall(h: Hrac): number {
  const a = h.atributy
  const vazeny =
    h.pozice === 'G'
      ? a.chytani * 0.7 + a.brusleni * 0.15 + a.fyzicka * 0.15
      : h.pozice === 'D'
        ? a.obrana * 0.35 + a.brusleni * 0.2 + a.fyzicka * 0.2 + a.prihravky * 0.15 + a.strelba * 0.1
        : a.strelba * 0.3 + a.prihravky * 0.25 + a.brusleni * 0.25 + a.fyzicka * 0.1 + a.obrana * 0.1
  return Math.round(vazeny)
}

export function vychoziSestava(hraci: Hrac[]): Sestava {
  const podleOverall = (poz: string) =>
    hraci.filter((h) => h.pozice === poz).sort((x, y) => overall(y) - overall(x))
  const utocnici = podleOverall('U')
  const obranci = podleOverall('D')
  const brankari = podleOverall('G')
  return {
    utoky: [0, 1, 2, 3].map((i) => utocnici.slice(i * 3, i * 3 + 3).map((h) => h.id)),
    obrany: [0, 1, 2].map((i) => obranci.slice(i * 2, i * 2 + 2).map((h) => h.id)),
    brankar: brankari[0].id,
  }
}

// efektivní síla hráče: overall upravený formou (±20 %) a únavou (až −30 %)
function efektivni(h: Hrac): number {
  return overall(h) * (1 + (h.forma - 50) / 100) * (1 - (h.unava / 100) * 0.3)
}

export function silaTymu(t: Tym): { utok: number; obrana: number; brankar: number } {
  const podleId = new Map(t.hraci.map((h) => [h.id, h]))
  const prumerLajny = (l: string[]) =>
    l.reduce((s, id) => s + efektivni(podleId.get(id)!), 0) / l.length
  // první lajny hrají víc → vyšší váha
  const vahyUtoku = [0.35, 0.28, 0.22, 0.15]
  const vahyObran = [0.4, 0.35, 0.25]
  const utok = t.sestava.utoky.reduce((s, l, i) => s + prumerLajny(l) * vahyUtoku[i], 0)
  const obrana = t.sestava.obrany.reduce((s, l, i) => s + prumerLajny(l) * vahyObran[i], 0)
  const brankar = efektivni(podleId.get(t.sestava.brankar)!)
  return { utok, obrana, brankar }
}

export function vymenVSestave(s: Sestava, idA: string, idB: string): Sestava {
  const nahrad = (id: string) => (id === idA ? idB : id === idB ? idA : id)
  return {
    utoky: s.utoky.map((l) => l.map(nahrad)),
    obrany: s.obrany.map((l) => l.map(nahrad)),
    brankar: nahrad(s.brankar),
  }
}
```

Pozn.: v `silaTymu` ponech jen přesnou variantu (`utokPresne`) — mezikrok `utok`/`void utok` z kódu výše při implementaci rovnou vypusť.

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (sestava + generator + dřívější).

- [ ] **Step 5: Commit**

```bash
git add src/core/sestava.ts tests/core/sestava.test.ts
git commit -m "feat: výchozí sestava, overall a síla týmu"
```

---

### Task 6: Rozpis sezóny (`src/core/rozpis.ts`)

**Files:**
- Create: `src/core/rozpis.ts`
- Test: `tests/core/rozpis.test.ts`

**Interfaces:**
- Consumes: typ `Zapas` z `types.ts`.
- Produces: `vytvorRozpis(tymy: string[]): Zapas[]` (26 kol systémem každý s každým 2×, `vysledek: null`); `denKola(kolo: number): number` (kolo 1 → den 3, dál ob 3–4 dny, tj. 2 zápasy týdně); konstanta `POCET_KOL = 26`.

- [ ] **Step 1: Failing test** — `tests/core/rozpis.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { denKola, POCET_KOL, vytvorRozpis } from '../../src/core/rozpis'

const tymy = Array.from({ length: 14 }, (_, i) => `t${i}`)

describe('vytvorRozpis', () => {
  const rozpis = vytvorRozpis(tymy)
  it('má 26 kol po 7 zápasech', () => {
    expect(rozpis).toHaveLength(26 * 7)
    for (let k = 1; k <= POCET_KOL; k++) {
      expect(rozpis.filter((z) => z.kolo === k)).toHaveLength(7)
    }
  })
  it('každý tým hraje 26 zápasů, 13 doma a 13 venku', () => {
    for (const t of tymy) {
      expect(rozpis.filter((z) => z.domaci === t)).toHaveLength(13)
      expect(rozpis.filter((z) => z.hoste === t)).toHaveLength(13)
    }
  })
  it('každá dvojice se potká právě 2×, jednou doma a jednou venku', () => {
    for (const a of tymy)
      for (const b of tymy) {
        if (a === b) continue
        expect(rozpis.filter((z) => z.domaci === a && z.hoste === b)).toHaveLength(1)
      }
  })
  it('žádný tým nehraje 2 zápasy v jednom kole', () => {
    for (let k = 1; k <= POCET_KOL; k++) {
      const vKole = rozpis.filter((z) => z.kolo === k).flatMap((z) => [z.domaci, z.hoste])
      expect(new Set(vKole).size).toBe(14)
    }
  })
  it('dny kol rostou a odpovídají denKola', () => {
    for (const z of rozpis) expect(z.den).toBe(denKola(z.kolo))
    expect(denKola(1)).toBe(3)
    expect(denKola(2)).toBeGreaterThan(denKola(1))
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, rozpis.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/rozpis.ts` (kruhová metoda / berger tables):

```ts
import type { Zapas } from './types'

export const POCET_KOL = 26

// kolo 1 → den 3; pak střídavě +3 / +4 dny (2 zápasy týdně)
export function denKola(kolo: number): number {
  return 3 + Math.floor((kolo - 1) * 3.5)
}

export function vytvorRozpis(tymy: string[]): Zapas[] {
  const n = tymy.length // sudý počet (14)
  const pevny = tymy[0]
  const rotujici = tymy.slice(1)
  const zapasy: Zapas[] = []
  for (let k = 0; k < n - 1; k++) {
    const poradi = [pevny, ...rotujici]
    const pary: [string, string][] = []
    for (let i = 0; i < n / 2; i++) pary.push([poradi[i], poradi[n - 1 - i]])
    for (const [a, b] of pary) {
      // střídání domácího prostředí, ať nikdo nehraje pořád doma
      const [domaci, hoste] = k % 2 === 0 ? [a, b] : [b, a]
      zapasy.push({ kolo: k + 1, den: denKola(k + 1), domaci, hoste, vysledek: null })
      // odveta ve druhé polovině sezóny s prohozeným pořadatelstvím
      zapasy.push({
        kolo: k + n,
        den: denKola(k + n),
        domaci: hoste,
        hoste: domaci,
        vysledek: null,
      })
    }
    rotujici.unshift(rotujici.pop()!)
  }
  return zapasy.sort((x, y) => x.kolo - y.kolo)
}
```

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/rozpis.ts tests/core/rozpis.test.ts
git commit -m "feat: losování rozpisu 26 kol"
```

---

### Task 7: Ligová tabulka (`src/core/tabulka.ts`)

**Files:**
- Create: `src/core/tabulka.ts`
- Test: `tests/core/tabulka.test.ts`

**Interfaces:**
- Consumes: typy `Zapas`, `Vysledek` z `types.ts`.
- Produces: `interface RadekTabulky { tymId: string; zapasy: number; vyhry: number; vyhryP: number; prohryP: number; prohry: number; vstrelene: number; obdrzene: number; body: number }`; `spocitejTabulku(tymy: string[], zapasy: Zapas[]): RadekTabulky[]` (seřazeno: body ↓, skóre rozdíl ↓, vstřelené ↓).

- [ ] **Step 1: Failing test** — `tests/core/tabulka.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { spocitejTabulku } from '../../src/core/tabulka'
import type { Vysledek, Zapas } from '../../src/core/types'

const vysledek = (gd: number, gh: number, prodlouzeni = false, najezdy = false): Vysledek => ({
  golyDomaci: gd,
  golyHoste: gh,
  strelyDomaci: 30,
  strelyHoste: 30,
  prodlouzeni,
  najezdy,
  udalosti: [],
})

const zapas = (domaci: string, hoste: string, v: Vysledek | null, kolo = 1): Zapas => ({
  kolo,
  den: 3,
  domaci,
  hoste,
  vysledek: v,
})

describe('spocitejTabulku', () => {
  it('rozdává body 3 / 2 / 1 / 0', () => {
    const zapasy = [
      zapas('a', 'b', vysledek(4, 1)), // a: 3 b., b: 0 b.
      zapas('c', 'd', vysledek(2, 3, true)), // d: 2 b. (v prodl.), c: 1 b.
    ]
    const t = spocitejTabulku(['a', 'b', 'c', 'd'], zapasy)
    const body = Object.fromEntries(t.map((r) => [r.tymId, r.body]))
    expect(body).toEqual({ a: 3, b: 0, c: 1, d: 2 })
  })
  it('ignoruje neodehrané zápasy', () => {
    const t = spocitejTabulku(['a', 'b'], [zapas('a', 'b', null)])
    expect(t[0].zapasy).toBe(0)
  })
  it('řadí podle bodů, pak rozdílu skóre, pak vstřelených', () => {
    const zapasy = [
      zapas('a', 'c', vysledek(5, 0)),
      zapas('b', 'c', vysledek(2, 0), 2),
    ]
    const t = spocitejTabulku(['a', 'b', 'c'], zapasy)
    expect(t.map((r) => r.tymId)).toEqual(['a', 'b', 'c'])
  })
  it('počítá výhry v prodloužení zvlášť', () => {
    const t = spocitejTabulku(['a', 'b'], [zapas('a', 'b', vysledek(2, 1, false, true))])
    const a = t.find((r) => r.tymId === 'a')!
    expect(a.vyhryP).toBe(1)
    expect(a.vyhry).toBe(0)
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, tabulka.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/tabulka.ts`:

```ts
import type { Zapas } from './types'

export interface RadekTabulky {
  tymId: string
  zapasy: number
  vyhry: number // v normální hrací době
  vyhryP: number // v prodloužení / nájezdech
  prohryP: number
  prohry: number
  vstrelene: number
  obdrzene: number
  body: number
}

export function spocitejTabulku(tymy: string[], zapasy: Zapas[]): RadekTabulky[] {
  const radky = new Map<string, RadekTabulky>(
    tymy.map((t) => [
      t,
      { tymId: t, zapasy: 0, vyhry: 0, vyhryP: 0, prohryP: 0, prohry: 0, vstrelene: 0, obdrzene: 0, body: 0 },
    ]),
  )
  for (const z of zapasy) {
    const v = z.vysledek
    if (!v) continue
    const d = radky.get(z.domaci)!
    const h = radky.get(z.hoste)!
    const poProdlouzeni = v.prodlouzeni || v.najezdy
    const [vitez, porazeny] = v.golyDomaci > v.golyHoste ? [d, h] : [h, d]
    d.zapasy++, h.zapasy++
    d.vstrelene += v.golyDomaci, d.obdrzene += v.golyHoste
    h.vstrelene += v.golyHoste, h.obdrzene += v.golyDomaci
    if (poProdlouzeni) {
      vitez.vyhryP++, vitez.body += 2
      porazeny.prohryP++, porazeny.body += 1
    } else {
      vitez.vyhry++, vitez.body += 3
      porazeny.prohry++
    }
  }
  return [...radky.values()].sort(
    (a, b) =>
      b.body - a.body ||
      b.vstrelene - b.obdrzene - (a.vstrelene - a.obdrzene) ||
      b.vstrelene - a.vstrelene,
  )
}
```

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/tabulka.ts tests/core/tabulka.test.ts
git commit -m "feat: výpočet ligové tabulky s hokejovým bodováním"
```

---

### Task 8: Simulace zápasu (`src/core/simulace.ts`)

**Files:**
- Create: `src/core/simulace.ts`
- Test: `tests/core/simulace.test.ts`

**Interfaces:**
- Consumes: `Rng`, `pick` z `rng.ts`; `silaTymu` ze `sestava.ts`; typy z `types.ts`.
- Produces: `simulujZapas(domaci: Tym, hoste: Tym, rng: Rng): Vysledek`. Invarianty: nikdy remíza; `udalosti` chronologicky, gólové události mají `hracId` (+ případně `asistentId`); góly v událostech odpovídají skóre; texty česky.

- [ ] **Step 1: Failing test** — `tests/core/simulace.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { simulujZapas } from '../../src/core/simulace'
import type { Klub } from '../../src/core/types'

// resetIdCitac: id hráčů jsou z globálního čítače — bez resetu by opakované
// generování dalo jiná id a determinismus by nešel porovnat; různý základ
// pro domácí/hosty brání kolizi id mezi týmy
const tym = (id: string, liga: number, seed: number, zakladId: number) => {
  resetIdCitac(zakladId)
  return generujTym(createRng(seed), { id, nazev: id, liga } as Klub)
}
const domaci = (liga = 0) => tym('x', liga, 1, 0)
const hoste = (liga = 0) => tym('y', liga, 2, 1000)

describe('simulujZapas', () => {
  it('je deterministická při stejném seedu', () => {
    const a = simulujZapas(domaci(), hoste(), createRng(99))
    const b = simulujZapas(domaci(), hoste(), createRng(99))
    expect(a).toEqual(b)
  })
  it('nikdy nekončí remízou', () => {
    for (let s = 0; s < 100; s++) {
      const v = simulujZapas(domaci(1), hoste(1), createRng(s))
      expect(v.golyDomaci).not.toBe(v.golyHoste)
    }
  })
  it('výrazně silnější tým vyhrává většinu zápasů', () => {
    let vyhrySilnejsiho = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujZapas(domaci(0), hoste(2), createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhrySilnejsiho++
    }
    expect(vyhrySilnejsiho).toBeGreaterThan(140) // > 70 %
  })
  it('dává realistické počty gólů (průměr 3–9 celkem)', () => {
    let goly = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujZapas(domaci(), hoste(), createRng(s))
      goly += v.golyDomaci + v.golyHoste
    }
    const prumer = goly / 200
    expect(prumer).toBeGreaterThan(3)
    expect(prumer).toBeLessThan(9)
  })
  it('gólové události sedí na skóre a mají střelce', () => {
    const v = simulujZapas(domaci(), hoste(), createRng(7))
    const goly = v.udalosti.filter((u) => u.typ === 'gol')
    expect(goly).toHaveLength(v.golyDomaci + v.golyHoste)
    for (const g of goly) expect(g.hracId).toBeTruthy()
  })
  it('střel je víc než gólů', () => {
    const v = simulujZapas(domaci(), hoste(), createRng(8))
    expect(v.strelyDomaci).toBeGreaterThanOrEqual(v.golyDomaci)
    expect(v.strelyHoste).toBeGreaterThanOrEqual(v.golyHoste)
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, simulace.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/simulace.ts`:

```ts
import { pick, type Rng } from './rng'
import { silaTymu } from './sestava'
import type { Hrac, Tym, Udalost, Vysledek } from './types'

interface Strana {
  tym: Tym
  utok: number
  obrana: number
  brankar: number
  goly: number
  strely: number
  presilaDo: number // minuta, do které hraje přesilovku (0 = ne)
}

const jmeno = (h: Hrac) => `${h.jmeno} ${h.prijmeni}`

function vyberStrelce(rng: Rng, tym: Tym): Hrac {
  // váha podle střelby — hvězdy střílí častěji
  const bruslari = tym.hraci.filter((h) => h.pozice !== 'G')
  const celkem = bruslari.reduce((s, h) => s + h.atributy.strelba, 0)
  let los = rng() * celkem
  for (const h of bruslari) {
    los -= h.atributy.strelba
    if (los <= 0) return h
  }
  return bruslari[bruslari.length - 1]
}

function utocnaAkce(rng: Rng, utocici: Strana, branici: Strana, minuta: number, udalosti: Udalost[]): void {
  utocici.strely++
  const strelec = vyberStrelce(rng, utocici.tym)
  // šance na gól ze střely ~9 % při vyrovnaných silách, škáluje střelbou vs. brankářem
  const sance = 0.09 * (strelec.atributy.strelba / branici.brankar)
  if (rng() < sance) {
    utocici.goly++
    const spoluhraci = utocici.tym.hraci.filter((h) => h.pozice !== 'G' && h.id !== strelec.id)
    const asistent = rng() < 0.8 ? pick(rng, spoluhraci) : null
    udalosti.push({
      minuta,
      typ: 'gol',
      tymId: utocici.tym.klubId,
      hracId: strelec.id,
      asistentId: asistent?.id,
      text: `${minuta}. min — GÓL! ${jmeno(strelec)} (${utocici.tym.nazev})${asistent ? `, asistence ${jmeno(asistent)}` : ''}`,
    })
  } else if (rng() < 0.5) {
    udalosti.push({
      minuta,
      typ: 'zakrok',
      tymId: branici.tym.klubId,
      text: `${minuta}. min: ${jmeno(strelec)} střílí, ale brankář ${branici.tym.nazev} chytá.`,
    })
  } else {
    udalosti.push({
      minuta,
      typ: 'strela',
      tymId: utocici.tym.klubId,
      text: `${minuta}. min: střela ${jmeno(strelec)} vedle.`,
    })
  }
}

function minutaHry(rng: Rng, a: Strana, b: Strana, minuta: number, udalosti: Udalost[]): void {
  for (const [utocici, branici] of [
    [a, b],
    [b, a],
  ] as [Strana, Strana][]) {
    // vyloučení: ~1 za 25 minut na tým
    if (rng() < 0.04 && branici.presilaDo <= minuta) {
      const provinilec = pick(rng, utocici.tym.hraci.filter((h) => h.pozice !== 'G'))
      branici.presilaDo = minuta + 2
      udalosti.push({
        minuta,
        typ: 'vylouceni',
        tymId: utocici.tym.klubId,
        hracId: provinilec.id,
        text: `${minuta}. min: ${jmeno(provinilec)} (${utocici.tym.nazev}) — 2 minuty.`,
      })
    }
    // pravděpodobnost útočné akce podle poměru sil, ~0,4/min; přesilovka +60 %
    const presila = utocici.presilaDo > minuta ? 1.6 : 1
    const pomer = utocici.utok / (utocici.utok + branici.obrana)
    if (rng() < 0.8 * pomer * presila) utocnaAkce(rng, utocici, branici, minuta, udalosti)
  }
}

export function simulujZapas(domaci: Tym, hoste: Tym, rng: Rng): Vysledek {
  const sd = silaTymu(domaci)
  const sh = silaTymu(hoste)
  const a: Strana = { tym: domaci, ...sd, utok: sd.utok * 1.05, goly: 0, strely: 0, presilaDo: 0 } // výhoda domácího ledu +5 %
  const b: Strana = { tym: hoste, ...sh, goly: 0, strely: 0, presilaDo: 0 }
  const udalosti: Udalost[] = []

  for (let minuta = 1; minuta <= 60; minuta++) minutaHry(rng, a, b, minuta, udalosti)

  let prodlouzeni = false
  let najezdy = false
  if (a.goly === b.goly) {
    prodlouzeni = true
    udalosti.push({ minuta: 60, typ: 'info', tymId: '', text: 'Nerozhodně — jde se do prodloužení!' })
    for (let minuta = 61; minuta <= 65 && a.goly === b.goly; minuta++) minutaHry(rng, a, b, minuta, udalosti)
    if (a.goly === b.goly) {
      najezdy = true
      prodlouzeni = false
      // nájezdy: rozhodne poměr útoku a brankářů + náhoda
      const sancaDomacich = 0.5 + (a.utok / b.brankar - b.utok / a.brankar) * 0.1
      const vitez = rng() < sancaDomacich ? a : b
      vitez.goly++
      udalosti.push({
        minuta: 65,
        typ: 'gol',
        tymId: vitez.tym.klubId,
        hracId: vyberStrelce(rng, vitez.tym).id,
        text: `Rozhodující nájezd proměňuje ${vitez.tym.nazev}!`,
      })
    }
  }

  return {
    golyDomaci: a.goly,
    golyHoste: b.goly,
    strelyDomaci: a.strely,
    strelyHoste: b.strely,
    prodlouzeni,
    najezdy,
    udalosti,
  }
}
```

Pozn.: kalibrační konstanty (0.09, 0.8, 0.04, 1.6, 1.05) jsou výchozí odhad — testy „realistické góly" a „silnější vyhrává" je hlídají; když nesedí, uprav 0.09 (víc/míň gólů) nebo 0.8 (víc/míň střel). <!-- ponytail: kalibrace hrubá, doladí se v M4 podle reálných statistik -->
Simulace týmy nemutuje (statistiky hráčům připisuje až `sezona.ts` podle událostí).

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS. Pokud kalibrace nesedí, uprav konstanty dle poznámky a spusť znovu.

- [ ] **Step 5: Commit**

```bash
git add src/core/simulace.ts tests/core/simulace.test.ts
git commit -m "feat: minutová simulace zápasu s událostmi"
```

---

### Task 9: Playoff (`src/core/playoff.ts`)

**Files:**
- Create: `src/core/playoff.ts`
- Test: `tests/core/playoff.test.ts`

**Interfaces:**
- Consumes: typy `Playoff`, `Serie`, `RadekTabulky`.
- Produces: `zalozPlayoff(tabulka: RadekTabulky[]): Playoff` (top 8: 1v8, 2v7, 3v6, 4v5); `cekajiciSerie(p: Playoff): { kolo: number; index: number; serie: Serie }[]` (série aktuálního kola, které ještě nemají 3 výhry); `zapisVysledekSerie(p: Playoff, kolo: number, index: number, vyhralDomaci: boolean): Playoff` (přičte výhru; při dohrání kola založí další kolo / vyplní `vitez`); `domaciLedSerie(s: Serie): string` (kdo hraje další zápas série doma: výše nasazený v zápasech 1, 2 a 5, jinak soupeř).

- [ ] **Step 1: Failing test** — `tests/core/playoff.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cekajiciSerie, domaciLedSerie, zalozPlayoff, zapisVysledekSerie } from '../../src/core/playoff'
import type { RadekTabulky } from '../../src/core/tabulka'

const tabulka = Array.from({ length: 14 }, (_, i) => ({ tymId: `t${i + 1}` })) as RadekTabulky[]

describe('zalozPlayoff', () => {
  it('nasadí top 8 křížem', () => {
    const p = zalozPlayoff(tabulka)
    expect(p.kola[0].map((s) => [s.domaci, s.hoste])).toEqual([
      ['t1', 't8'],
      ['t2', 't7'],
      ['t3', 't6'],
      ['t4', 't5'],
    ])
    expect(p.vitez).toBeNull()
  })
})

describe('průběh série a pavouka', () => {
  it('série končí třetí výhrou a vítězové postupují', () => {
    let p = zalozPlayoff(tabulka)
    // všechna čtvrtfinále vyhrají domácí 3:0 na zápasy
    for (let g = 0; g < 3; g++)
      for (let i = 0; i < 4; i++) p = zapisVysledekSerie(p, 0, i, true)
    expect(p.kola[1]).toHaveLength(2)
    expect(p.kola[1][0]).toMatchObject({ domaci: 't1', hoste: 't4' })
    expect(cekajiciSerie(p).every((s) => s.kolo === 1)).toBe(true)
  })
  it('po finále je znám vítěz', () => {
    let p = zalozPlayoff(tabulka)
    for (let kolo = 0; kolo < 3; kolo++)
      for (let g = 0; g < 3; g++)
        for (const { index } of cekajiciSerie(p).filter((s) => s.kolo === kolo))
          p = zapisVysledekSerie(p, kolo, index, true)
    expect(p.vitez).toBe('t1')
  })
})

describe('domaciLedSerie', () => {
  it('zápasy 1, 2 a 5 hraje doma výše nasazený', () => {
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 0, vyhryHoste: 0 })).toBe('a')
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 1, vyhryHoste: 0 })).toBe('a')
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 1, vyhryHoste: 1 })).toBe('b')
    expect(domaciLedSerie({ domaci: 'a', hoste: 'b', vyhryDomaci: 2, vyhryHoste: 2 })).toBe('a')
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, playoff.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/playoff.ts`:

```ts
import type { Playoff, Serie } from './types'
import type { RadekTabulky } from './tabulka'

export function zalozPlayoff(tabulka: RadekTabulky[]): Playoff {
  const top = tabulka.slice(0, 8).map((r) => r.tymId)
  const serie = (a: number, b: number): Serie => ({
    domaci: top[a],
    hoste: top[b],
    vyhryDomaci: 0,
    vyhryHoste: 0,
  })
  return { kola: [[serie(0, 7), serie(1, 6), serie(2, 5), serie(3, 4)]], vitez: null }
}

const dohrana = (s: Serie) => s.vyhryDomaci === 3 || s.vyhryHoste === 3
export const vitezSerie = (s: Serie) => (s.vyhryDomaci === 3 ? s.domaci : s.hoste)

export function cekajiciSerie(p: Playoff): { kolo: number; index: number; serie: Serie }[] {
  const kolo = p.kola.length - 1
  return p.kola[kolo]
    .map((serie, index) => ({ kolo, index, serie }))
    .filter(({ serie }) => !dohrana(serie))
}

export function domaciLedSerie(s: Serie): string {
  const odehrano = s.vyhryDomaci + s.vyhryHoste // číslo dalšího zápasu − 1
  return [0, 1, 4].includes(odehrano) ? s.domaci : s.hoste
}

export function zapisVysledekSerie(p: Playoff, kolo: number, index: number, vyhralDomaci: boolean): Playoff {
  const novy: Playoff = structuredClone(p)
  const s = novy.kola[kolo][index]
  if (vyhralDomaci) s.vyhryDomaci++
  else s.vyhryHoste++
  const aktualni = novy.kola[novy.kola.length - 1]
  if (aktualni.every(dohrana)) {
    const postupujici = aktualni.map(vitezSerie)
    if (postupujici.length === 1) {
      novy.vitez = postupujici[0]
    } else {
      const dalsi: Serie[] = []
      for (let i = 0; i < postupujici.length / 2; i++) {
        dalsi.push({
          domaci: postupujici[i],
          hoste: postupujici[postupujici.length - 1 - i],
          vyhryDomaci: 0,
          vyhryHoste: 0,
        })
      }
      novy.kola.push(dalsi)
    }
  }
  return novy
}
```

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/playoff.ts tests/core/playoff.test.ts
git commit -m "feat: playoff pavouk na 3 vítězné zápasy"
```

---

### Task 10: Průběh sezóny (`src/core/sezona.ts`)

**Files:**
- Create: `src/core/sezona.ts`
- Test: `tests/core/sezona.test.ts`

**Interfaces:**
- Consumes: vše z předchozích tasků (`generujSvet`, `vytvorRozpis`, `denKola`, `POCET_KOL`, `spocitejTabulku`, `simulujZapas`, `zalozPlayoff`, `cekajiciSerie`, `zapisVysledekSerie`, `domaciLedSerie`, `vychoziSestava`, `overall`, `createRng`, `hashSeed`, `randInt`).
- Produces: `newGame(seed: number, mujKlubId: string): GameState`; `advanceDay(state: GameState): GameState` (čistá funkce, vrací nový stav); `dalsiMujZapas(s: GameState): { den: number; domaci: string; hoste: string } | null`; `mojeLiga(s: GameState): Liga`; `zahajNovouSezonu(state: GameState): GameState`.

- [ ] **Step 1: Failing test** — `tests/core/sezona.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { denKola, POCET_KOL } from '../../src/core/rozpis'
import {
  advanceDay,
  dalsiMujZapas,
  mojeLiga,
  newGame,
  zahajNovouSezonu,
} from '../../src/core/sezona'
import { spocitejTabulku } from '../../src/core/tabulka'
import type { GameState } from '../../src/core/types'

const dohraj = (s: GameState): GameState => {
  let pojistka = 0
  while (s.faze !== 'konecSezony' && pojistka++ < 300) s = advanceDay(s)
  expect(pojistka).toBeLessThan(300)
  return s
}

describe('newGame', () => {
  const s = newGame(7, 'tabor')
  it('založí 42 týmů a 3 ligy po 182 zápasech', () => {
    expect(Object.keys(s.tymy)).toHaveLength(42)
    expect(s.ligy).toHaveLength(3)
    for (const l of s.ligy) expect(l.zapasy).toHaveLength(182)
  })
  it('můj klub je ve 2. lize', () => {
    expect(mojeLiga(s).uroven).toBe(2)
    expect(dalsiMujZapas(s)?.den).toBe(3)
  })
})

describe('advanceDay', () => {
  it('v den 3 odehraje 1. kolo ve všech ligách', () => {
    let s = newGame(7, 'tabor')
    for (let i = 0; i < 3; i++) s = advanceDay(s)
    for (const l of s.ligy) {
      expect(l.zapasy.filter((z) => z.vysledek)).toHaveLength(7)
    }
    expect(s.posledniZapas).not.toBeNull() // můj klub hrál v 1. kole
  })
  it('je deterministický', () => {
    const hraj = () => {
      let s = newGame(11, 'decin')
      for (let i = 0; i < 20; i++) s = advanceDay(s)
      return s
    }
    expect(JSON.stringify(hraj())).toBe(JSON.stringify(hraj()))
  })
  it('po základní části startuje playoff a sezóna doběhne do konce', () => {
    let s = newGame(3, 'kobra')
    while (s.den < denKola(POCET_KOL)) s = advanceDay(s)
    expect(s.faze).toBe('playoff')
    for (const l of s.ligy) expect(l.playoff?.kola[0]).toHaveLength(4)
    s = dohraj(s)
    for (const l of s.ligy) expect(l.playoff?.vitez).toBeTruthy()
  })
})

describe('zahajNovouSezonu', () => {
  const konec = dohraj(newGame(5, 'tabor'))
  const nova = zahajNovouSezonu(konec)
  it('prohodí postupující a sestupující', () => {
    for (const uroven of [1, 2]) {
      const postupujici = konec.ligy[uroven].playoff!.vitez!
      const tabulka = spocitejTabulku(konec.ligy[uroven - 1].tymy, konec.ligy[uroven - 1].zapasy)
      const sestupujici = tabulka[tabulka.length - 1].tymId
      expect(nova.ligy[uroven - 1].tymy).toContain(postupujici)
      expect(nova.ligy[uroven].tymy).toContain(sestupujici)
      expect(nova.ligy[uroven].tymy).toHaveLength(14)
    }
  })
  it('resetuje kalendář a statistiky, hráči stárnou', () => {
    expect(nova.sezona).toBe(2)
    expect(nova.den).toBe(0)
    expect(nova.faze).toBe('zakladniCast')
    for (const l of nova.ligy) expect(l.zapasy.every((z) => !z.vysledek)).toBe(true)
    const stary = konec.tymy.tabor.hraci[0]
    const novy = nova.tymy.tabor.hraci[0]
    expect(novy.vek).toBe(stary.vek + 1)
    expect(novy.goly).toBe(0)
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, sezona.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/sezona.ts`:

```ts
import kluby from './data/kluby.json'
import { generujSvet } from './generator'
import { cekajiciSerie, domaciLedSerie, zalozPlayoff, zapisVysledekSerie } from './playoff'
import { createRng, hashSeed, randInt, type Rng } from './rng'
import { denKola, POCET_KOL, vytvorRozpis } from './rozpis'
import { overall, vychoziSestava } from './sestava'
import { simulujZapas } from './simulace'
import { spocitejTabulku } from './tabulka'
import type { Atributy, GameState, Klub, Liga, Tym, Vysledek } from './types'

const NAZVY_LIG = ['Extraliga', 'Chance liga', '2. liga']
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function newGame(seed: number, mujKlubId: string): GameState {
  const tymy = generujSvet(seed)
  const ligy: Liga[] = [0, 1, 2].map((uroven) => {
    const idKlubu = (kluby as Klub[]).filter((k) => k.liga === uroven).map((k) => k.id)
    return { uroven, nazev: NAZVY_LIG[uroven], tymy: idKlubu, zapasy: vytvorRozpis(idKlubu), playoff: null }
  })
  return {
    seed,
    sezona: 1,
    den: 0,
    faze: 'zakladniCast',
    mujKlubId,
    tymy,
    ligy,
    zpravy: [`Vítej na střídačce klubu ${tymy[mujKlubId].nazev}! Cíl: probojovat se do extraligy.`],
    posledniZapas: null,
  }
}

export const mojeLiga = (s: GameState): Liga => s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!

export function dalsiMujZapas(s: GameState): { den: number; domaci: string; hoste: string } | null {
  if (s.faze === 'zakladniCast') {
    const z = mojeLiga(s)
      .zapasy.filter((z) => !z.vysledek && (z.domaci === s.mujKlubId || z.hoste === s.mujKlubId))
      .sort((a, b) => a.den - b.den)[0]
    return z ? { den: z.den, domaci: z.domaci, hoste: z.hoste } : null
  }
  if (s.faze === 'playoff') {
    const playoff = mojeLiga(s).playoff
    if (!playoff || playoff.vitez) return null
    const moje = cekajiciSerie(playoff).find(
      ({ serie }) => serie.domaci === s.mujKlubId || serie.hoste === s.mujKlubId,
    )
    if (!moje) return null
    const domaci = domaciLedSerie(moje.serie)
    const hoste = domaci === moje.serie.domaci ? moje.serie.hoste : moje.serie.domaci
    return { den: s.den % 2 === 0 ? s.den + 2 : s.den + 1, domaci, hoste }
  }
  return null
}

function aplikujDopadyZapasu(rng: Rng, t: Tym, vyhra: boolean): void {
  t.moralka = clamp(t.moralka + (vyhra ? 3 : -3), 30, 70)
  // morálka ovlivňuje výkon nepřímo: táhne formu hráčů nahoru/dolů
  const bonusMoralky = t.moralka > 60 ? 1 : t.moralka < 40 ? -1 : 0
  const vSestave = new Set([...t.sestava.utoky.flat(), ...t.sestava.obrany.flat(), t.sestava.brankar])
  for (const h of t.hraci) {
    const drift = vyhra ? randInt(rng, -1, 3) : randInt(rng, -3, 1)
    h.forma = clamp(h.forma + drift + bonusMoralky, 30, 70)
    if (vSestave.has(h.id)) h.unava = Math.min(100, h.unava + 15)
  }
}

function odehrajZapas(s: GameState, domaciId: string, hosteId: string, poradi: number): Vysledek {
  const rng = createRng(hashSeed(s.seed, s.sezona, s.den, poradi))
  const domaci = s.tymy[domaciId]
  const hoste = s.tymy[hosteId]
  const v = simulujZapas(domaci, hoste, rng)
  for (const u of v.udalosti) {
    if (u.typ !== 'gol') continue
    for (const t of [domaci, hoste]) {
      const strelec = t.hraci.find((h) => h.id === u.hracId)
      if (strelec) strelec.goly++
      const asistent = t.hraci.find((h) => h.id === u.asistentId)
      if (asistent) asistent.asistence++
    }
  }
  const vyhralDomaci = v.golyDomaci > v.golyHoste
  aplikujDopadyZapasu(rng, domaci, vyhralDomaci)
  aplikujDopadyZapasu(rng, hoste, !vyhralDomaci)
  if (domaciId === s.mujKlubId || hosteId === s.mujKlubId) {
    s.posledniZapas = { den: s.den, domaci: domaciId, hoste: hosteId, vysledek: v }
    const dodatek = v.najezdy ? ' (sn)' : v.prodlouzeni ? ' (pp)' : ''
    s.zpravy.unshift(`${domaci.nazev} – ${hoste.nazev} ${v.golyDomaci}:${v.golyHoste}${dodatek}`)
  }
  return v
}

export function advanceDay(state: GameState): GameState {
  const s = structuredClone(state)
  s.den++
  // den odpočinku regeneruje únavu (před případným zápasem)
  for (const t of Object.values(s.tymy)) for (const h of t.hraci) h.unava = Math.max(0, h.unava - 10)

  if (s.faze === 'zakladniCast') {
    for (const liga of s.ligy) {
      liga.zapasy
        .filter((z) => z.den === s.den && !z.vysledek)
        .forEach((z, i) => {
          z.vysledek = odehrajZapas(s, z.domaci, z.hoste, liga.uroven * 100 + i)
        })
    }
    if (s.den >= denKola(POCET_KOL)) {
      s.faze = 'playoff'
      for (const liga of s.ligy) liga.playoff = zalozPlayoff(spocitejTabulku(liga.tymy, liga.zapasy))
      s.zpravy.unshift('Základní část skončila — začíná playoff!')
    }
  } else if (s.faze === 'playoff' && s.den % 2 === 0) {
    for (const liga of s.ligy) {
      if (!liga.playoff || liga.playoff.vitez) continue
      let playoff = liga.playoff
      for (const { kolo, index, serie } of cekajiciSerie(playoff)) {
        const domaci = domaciLedSerie(serie)
        const hoste = domaci === serie.domaci ? serie.hoste : serie.domaci
        const v = odehrajZapas(s, domaci, hoste, liga.uroven * 100 + kolo * 10 + index)
        const vitezZapasu = v.golyDomaci > v.golyHoste ? domaci : hoste
        playoff = zapisVysledekSerie(playoff, kolo, index, vitezZapasu === serie.domaci)
      }
      liga.playoff = playoff
    }
    if (s.ligy.every((l) => l.playoff?.vitez)) {
      s.faze = 'konecSezony'
      const mistrId = s.ligy[0].playoff!.vitez!
      s.zpravy.unshift(
        mistrId === s.mujKlubId
          ? '🏆 MISTŘI! Vyhráli jste extraligu!'
          : `Mistrem extraligy se stal ${s.tymy[mistrId].nazev}.`,
      )
    }
  }
  return s
}

export function zahajNovouSezonu(state: GameState): GameState {
  const s = structuredClone(state)
  // postup a sestup mezi sousedními úrovněmi
  for (const uroven of [1, 2]) {
    const nizsi = s.ligy[uroven]
    const vyssi = s.ligy[uroven - 1]
    const postupujici = nizsi.playoff!.vitez!
    const tabulka = spocitejTabulku(vyssi.tymy, vyssi.zapasy)
    const sestupujici = tabulka[tabulka.length - 1].tymId
    nizsi.tymy = [...nizsi.tymy.filter((t) => t !== postupujici), sestupujici]
    vyssi.tymy = [...vyssi.tymy.filter((t) => t !== sestupujici), postupujici]
    s.zpravy.unshift(
      `${s.tymy[postupujici].nazev} postupuje do ${vyssi.nazev}, ${s.tymy[sestupujici].nazev} sestupuje.`,
    )
  }
  s.sezona++
  s.den = 0
  s.faze = 'zakladniCast'
  s.posledniZapas = null
  // letní vývoj hráčů
  const rng = createRng(hashSeed(s.seed, s.sezona, 999))
  for (const tym of Object.values(s.tymy)) {
    for (const h of tym.hraci) {
      h.vek++
      let posun =
        h.vek <= 23 ? randInt(rng, 0, 3) : h.vek <= 29 ? randInt(rng, -1, 1) : randInt(rng, -3, -1)
      if (h.vek <= 23 && overall(h) >= h.potencial) posun = 0
      for (const k of Object.keys(h.atributy) as (keyof Atributy)[]) {
        h.atributy[k] = clamp(h.atributy[k] + posun, 1, 99)
      }
      h.forma = 50
      h.unava = 0
      h.goly = 0
      h.asistence = 0
    }
    tym.moralka = 50
    // AI kluby si přeskládají sestavu; hráčova (upravovaná ručně) zůstává
    if (tym.klubId !== s.mujKlubId) tym.sestava = vychoziSestava(tym.hraci)
  }
  for (const liga of s.ligy) {
    liga.zapasy = vytvorRozpis(liga.tymy)
    liga.playoff = null
  }
  return s
}
```

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (celý core zelený). Tento test zároveň slouží jako smoke test celé sezóny.

- [ ] **Step 5: Commit**

```bash
git add src/core/sezona.ts tests/core/sezona.test.ts
git commit -m "feat: průběh sezóny — kalendář, playoff, postup a sestup"
```

---

### Task 11: Serializace uložení (`src/core/ulozeni.ts`)

**Files:**
- Create: `src/core/ulozeni.ts`
- Test: `tests/core/ulozeni.test.ts`

**Interfaces:**
- Consumes: `GameState`.
- Produces: `serializuj(stav: GameState, ulozeno: string): string` (`ulozeno` = ISO čas dodaný volajícím — jádro nesahá na `Date`); `deserializuj(json: string): GameState` (vyhodí `Error` při špatné verzi/tvaru); `popisUlozeni(json: string): { ulozeno: string; sezona: number; den: number; klub: string }`.

- [ ] **Step 1: Failing test** — `tests/core/ulozeni.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { newGame } from '../../src/core/sezona'
import { deserializuj, popisUlozeni, serializuj } from '../../src/core/ulozeni'

describe('serializace', () => {
  const stav = newGame(1, 'tabor')
  const json = serializuj(stav, '2026-07-05T10:00:00.000Z')
  it('round-trip zachová stav', () => {
    expect(deserializuj(json)).toEqual(stav)
  })
  it('popis slotu obsahuje metadata', () => {
    expect(popisUlozeni(json)).toEqual({
      ulozeno: '2026-07-05T10:00:00.000Z',
      sezona: 1,
      den: 0,
      klub: 'HC Tábor',
    })
  })
  it('odmítne cizí/poškozený obsah', () => {
    expect(() => deserializuj('{"foo":1}')).toThrow()
    expect(() => deserializuj(json.replace('"verze":1', '"verze":99'))).toThrow()
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, ulozeni.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/ulozeni.ts`:

```ts
import type { GameState } from './types'

const VERZE = 1

interface UlozenaHra {
  verze: number
  ulozeno: string
  stav: GameState
}

export function serializuj(stav: GameState, ulozeno: string): string {
  const data: UlozenaHra = { verze: VERZE, ulozeno, stav }
  return JSON.stringify(data)
}

function parsuj(json: string): UlozenaHra {
  const data = JSON.parse(json) as UlozenaHra
  if (data.verze !== VERZE || !data.stav?.tymy || !data.stav?.ligy) {
    throw new Error('Nepodporovaný nebo poškozený soubor uložení.')
  }
  return data
}

export function deserializuj(json: string): GameState {
  return parsuj(json).stav
}

export function popisUlozeni(json: string): { ulozeno: string; sezona: number; den: number; klub: string } {
  const { ulozeno, stav } = parsuj(json)
  return { ulozeno, sezona: stav.sezona, den: stav.den, klub: stav.tymy[stav.mujKlubId].nazev }
}
```

- [ ] **Step 4: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ulozeni.ts tests/core/ulozeni.test.ts
git commit -m "feat: serializace uložené hry s verzí"
```

---

### Task 12: UI kostra — shell, ukládací backend, Nová hra, Přehled

**Files:**
- Create: `src/ui/styl.css`, `src/ui/store.ts`, `src/ui/App.tsx`
- Create: `src/ui/obrazovky/NovaHra.tsx`, `src/ui/obrazovky/Prehled.tsx`
- Create: stuby `src/ui/obrazovky/{Soupiska,Sestava,Zapas,Liga,Ulozeni}.tsx` (nahradí Tasky 13–15)
- Modify: `src/main.tsx`, `index.html`
- Delete: `src/App.tsx`, `src/App.css`, `src/index.css`, `src/assets/` (zbytky Vite šablony)

**Interfaces:**
- Consumes: celé jádro (`newGame`, `advanceDay`, `zahajNovouSezonu`, `dalsiMujZapas`, `mojeLiga`, `spocitejTabulku`, `serializuj`/`deserializuj`/`popisUlozeni`).
- Produces: `type Obrazovka = 'prehled' | 'soupiska' | 'sestava' | 'zapas' | 'liga' | 'ulozeni'` (export z `App.tsx`); store API: `ulozHru(slot: number, stav: GameState): Promise<void>`, `nactiHru(slot: number): Promise<GameState | null>`, `seznamSlotu(): Promise<InfoSlotu[]>`, `interface InfoSlotu { slot: number; ulozeno: string; sezona: number; den: number; klub: string }` (slot 0 = autosave). Každá obrazovka je komponenta s props `{ hra: GameState }` + případně `setHra`, `setObrazovka`.

- [ ] **Step 1: Ukládací backend** — `src/ui/store.ts` (Tauri FS, v prohlížeči localStorage):

```ts
import type { GameState } from '../core/types'
import { deserializuj, popisUlozeni, serializuj } from '../core/ulozeni'

export interface InfoSlotu {
  slot: number
  ulozeno: string
  sezona: number
  den: number
  klub: string
}

const SLOTY = [0, 1, 2, 3] // 0 = autosave
const jeTauri = '__TAURI_INTERNALS__' in window
const cesta = (slot: number) => `sloty/slot-${slot}.json`

async function zapis(slot: number, obsah: string): Promise<void> {
  if (jeTauri) {
    const { BaseDirectory, exists, mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
    if (!(await exists('sloty', { baseDir: BaseDirectory.AppData }))) {
      await mkdir('sloty', { baseDir: BaseDirectory.AppData, recursive: true })
    }
    await writeTextFile(cesta(slot), obsah, { baseDir: BaseDirectory.AppData })
  } else {
    localStorage.setItem(`hokej-slot-${slot}`, obsah)
  }
}

async function precti(slot: number): Promise<string | null> {
  if (jeTauri) {
    const { BaseDirectory, exists, readTextFile } = await import('@tauri-apps/plugin-fs')
    if (!(await exists(cesta(slot), { baseDir: BaseDirectory.AppData }))) return null
    return readTextFile(cesta(slot), { baseDir: BaseDirectory.AppData })
  }
  return localStorage.getItem(`hokej-slot-${slot}`)
}

export async function ulozHru(slot: number, stav: GameState): Promise<void> {
  await zapis(slot, serializuj(stav, new Date().toISOString()))
}

export async function nactiHru(slot: number): Promise<GameState | null> {
  const json = await precti(slot)
  return json ? deserializuj(json) : null
}

export async function seznamSlotu(): Promise<InfoSlotu[]> {
  const vysledek: InfoSlotu[] = []
  for (const slot of SLOTY) {
    const json = await precti(slot)
    if (json) vysledek.push({ slot, ...popisUlozeni(json) })
  }
  return vysledek
}
```

- [ ] **Step 2: Globální styl** — `src/ui/styl.css`:

```css
:root {
  --pozadi: #0f1419;
  --panel: #1a2129;
  --okraj: #2b3542;
  --text: #e6edf3;
  --tlumeny: #8b98a5;
  --akcent: #4da3ff;
  --gol: #3fb950;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--pozadi);
  color: var(--text);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 15px;
}
#root { display: flex; min-height: 100vh; }
nav { width: 210px; background: var(--panel); border-right: 1px solid var(--okraj); padding: 16px 0; }
nav h1 { font-size: 18px; padding: 0 16px 12px; margin: 0; border-bottom: 1px solid var(--okraj); }
nav button {
  display: block; width: 100%; padding: 10px 16px; background: none; border: none;
  color: var(--tlumeny); text-align: left; font-size: 15px; cursor: pointer;
}
nav button:hover { color: var(--text); background: #212b36; }
nav button.aktivni { color: var(--akcent); border-left: 3px solid var(--akcent); font-weight: 600; }
main { flex: 1; padding: 24px; max-width: 1100px; }
h2 { margin-top: 0; }
table { border-collapse: collapse; width: 100%; background: var(--panel); border-radius: 8px; overflow: hidden; }
th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--okraj); }
th { color: var(--tlumeny); font-size: 13px; text-transform: uppercase; }
tr.muj { background: #1c2f45; }
.klik { cursor: pointer; }
.tlacitko {
  background: var(--akcent); color: #08111c; border: none; border-radius: 6px;
  padding: 10px 20px; font-size: 16px; font-weight: 700; cursor: pointer;
}
.tlacitko:hover { filter: brightness(1.15); }
.tlacitko.sekundarni { background: var(--panel); color: var(--text); border: 1px solid var(--okraj); }
.karta { background: var(--panel); border: 1px solid var(--okraj); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.mrizka { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.udalost-gol { color: var(--gol); font-weight: 700; }
.vybrany { outline: 2px solid var(--akcent); }
.zprava { padding: 6px 0; border-bottom: 1px solid var(--okraj); color: var(--tlumeny); }
```

- [ ] **Step 3: Vstupní bod** — `index.html`: nastav `<html lang="cs">` a `<title>Hokejový manažer</title>`. `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App'
import './ui/styl.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Smaž `src/App.tsx`, `src/App.css`, `src/index.css` a `src/assets/`.

- [ ] **Step 4: App shell** — `src/ui/App.tsx`:

```tsx
import { useState } from 'react'
import type { GameState } from '../core/types'
import { LigaObrazovka } from './obrazovky/Liga'
import { NovaHra } from './obrazovky/NovaHra'
import { Prehled } from './obrazovky/Prehled'
import { SestavaObrazovka } from './obrazovky/Sestava'
import { Soupiska } from './obrazovky/Soupiska'
import { Ulozeni } from './obrazovky/Ulozeni'
import { Zapas } from './obrazovky/Zapas'

export type Obrazovka = 'prehled' | 'soupiska' | 'sestava' | 'zapas' | 'liga' | 'ulozeni'

const ZALOZKY: [Obrazovka, string][] = [
  ['prehled', 'Přehled'],
  ['soupiska', 'Soupiska'],
  ['sestava', 'Sestava'],
  ['zapas', 'Poslední zápas'],
  ['liga', 'Soutěže'],
  ['ulozeni', 'Uložení'],
]

export default function App() {
  const [hra, setHra] = useState<GameState | null>(null)
  const [obrazovka, setObrazovka] = useState<Obrazovka>('prehled')

  if (!hra) {
    return (
      <NovaHra
        onStart={(s) => {
          setHra(s)
          setObrazovka('prehled')
        }}
      />
    )
  }

  const obsah = {
    prehled: <Prehled hra={hra} setHra={setHra} setObrazovka={setObrazovka} />,
    soupiska: <Soupiska hra={hra} />,
    sestava: <SestavaObrazovka hra={hra} setHra={setHra} />,
    zapas: <Zapas hra={hra} />,
    liga: <LigaObrazovka hra={hra} />,
    ulozeni: <Ulozeni hra={hra} setHra={setHra} />,
  }[obrazovka]

  return (
    <>
      <nav>
        <h1>🏒 Hokejový manažer</h1>
        {ZALOZKY.map(([id, popisek]) => (
          <button key={id} className={obrazovka === id ? 'aktivni' : ''} onClick={() => setObrazovka(id)}>
            {popisek}
          </button>
        ))}
      </nav>
      <main>{obsah}</main>
    </>
  )
}
```

Stuby obrazovek, které dodají Tasky 13–15 (každý soubor zatím jen takto, se správným jménem komponenty a props podle App.tsx — např. `src/ui/obrazovky/Soupiska.tsx`):

```tsx
import type { GameState } from '../../core/types'

export function Soupiska(_props: { hra: GameState }) {
  return <p>Připravuje se v dalším tasku.</p>
}
```

(Obdobně `SestavaObrazovka` a `Ulozeni` s props `{ hra: GameState; setHra: (s: GameState) => void }`, `Zapas` a `LigaObrazovka` s `{ hra: GameState }`.)

- [ ] **Step 5: Nová hra** — `src/ui/obrazovky/NovaHra.tsx`:

```tsx
import { useEffect, useState } from 'react'
import kluby from '../../core/data/kluby.json'
import { newGame } from '../../core/sezona'
import type { GameState, Klub } from '../../core/types'
import { nactiHru, seznamSlotu, type InfoSlotu } from '../store'

export function NovaHra({ onStart }: { onStart: (s: GameState) => void }) {
  const [sloty, setSloty] = useState<InfoSlotu[]>([])
  useEffect(() => {
    void seznamSlotu().then(setSloty)
  }, [])
  const druhaLiga = (kluby as Klub[]).filter((k) => k.liga === 2)
  return (
    <main>
      <h2>🏒 Hokejový manažer — nová hra</h2>
      <p>Vyber klub 2. ligy, který povedeš do extraligy:</p>
      <div className="mrizka">
        {druhaLiga.map((k) => (
          <button key={k.id} className="karta klik" onClick={() => onStart(newGame(Date.now() % 2 ** 31, k.id))}>
            {k.nazev}
          </button>
        ))}
      </div>
      {sloty.length > 0 && (
        <>
          <h2>Pokračovat v rozehrané hře</h2>
          {sloty.map((s) => (
            <button
              key={s.slot}
              className="karta klik"
              onClick={async () => {
                const hra = await nactiHru(s.slot)
                if (hra) onStart(hra)
              }}
            >
              {s.slot === 0 ? 'Autosave' : `Slot ${s.slot}`}: {s.klub}, sezóna {s.sezona}, den {s.den}
            </button>
          ))}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Přehled s tlačítkem Pokračovat** — `src/ui/obrazovky/Prehled.tsx`:

```tsx
import { advanceDay, dalsiMujZapas, mojeLiga, zahajNovouSezonu } from '../../core/sezona'
import { spocitejTabulku } from '../../core/tabulka'
import type { GameState } from '../../core/types'
import type { Obrazovka } from '../App'
import { ulozHru } from '../store'

export function Prehled({
  hra,
  setHra,
  setObrazovka,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  setObrazovka: (o: Obrazovka) => void
}) {
  const liga = mojeLiga(hra)
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const dalsi = dalsiMujZapas(hra)

  // posouvá dny, dokud nenarazí na můj zápas nebo změnu fáze (max 10 dní na klik)
  function pokracuj() {
    let s = hra
    let pojistka = 0
    do {
      s = advanceDay(s)
    } while (pojistka++ < 10 && s.faze === hra.faze && s.posledniZapas?.den !== s.den)
    setHra(s)
    void ulozHru(0, s)
    if (s.posledniZapas?.den === s.den) setObrazovka('zapas')
  }

  function novaSezona() {
    const s = zahajNovouSezonu(hra)
    setHra(s)
    void ulozHru(0, s)
  }

  return (
    <>
      <h2>
        {hra.tymy[hra.mujKlubId].nazev} — sezóna {hra.sezona}, den {hra.den}
      </h2>
      <div className="mrizka">
        <div className="karta">
          <h3>Další zápas</h3>
          {dalsi ? (
            <p>
              Den {dalsi.den}: {hra.tymy[dalsi.domaci].nazev} – {hra.tymy[dalsi.hoste].nazev}
            </p>
          ) : hra.faze === 'konecSezony' ? (
            <p>Sezóna skončila.</p>
          ) : (
            <p>Nečeká vás zápas — sezóna běží dál.</p>
          )}
          {hra.faze === 'konecSezony' ? (
            <button className="tlacitko" onClick={novaSezona}>
              Zahájit novou sezónu
            </button>
          ) : (
            <button className="tlacitko" onClick={pokracuj}>
              Pokračovat ▶
            </button>
          )}
        </div>
        <div className="karta">
          <h3>{liga.nazev}</h3>
          <table>
            <tbody>
              {tabulka.map((r, i) => (
                <tr key={r.tymId} className={r.tymId === hra.mujKlubId ? 'muj' : ''}>
                  <td>{i + 1}.</td>
                  <td>{hra.tymy[r.tymId].nazev}</td>
                  <td>{r.body} b.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="karta">
        <h3>Zprávy</h3>
        {hra.zpravy.slice(0, 10).map((z, i) => (
          <div key={i} className="zprava">
            {z}
          </div>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 7: Ověřit v prohlížeči**

Run: `npm run dev` a otevři http://localhost:5173. Expected: výběr 14 klubů 2. ligy → po kliknutí Přehled s tabulkou a zprávou „Vítej…" → „Pokračovat ▶" posune na den 3 a přepne na (zatím stubovou) obrazovku zápasu → Přehled ukazuje výsledek ve zprávách a body v tabulce. Reload stránky → na úvodu se objeví „Autosave" a jde načíst.

Run: `npm run test` → Expected: PASS (jádro nedotčeno).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: UI kostra — nová hra, přehled, pokračování dnem, autosave"
```

---

### Task 13: Obrazovky Soupiska a Sestava

**Files:**
- Modify: `src/ui/obrazovky/Soupiska.tsx` (nahradit stub)
- Modify: `src/ui/obrazovky/Sestava.tsx` (nahradit stub)

**Interfaces:**
- Consumes: `overall`, `vymenVSestave` ze `sestava.ts`; props z App.tsx (Task 12).
- Produces: `Soupiska({ hra })`, `SestavaObrazovka({ hra, setHra })`.

- [ ] **Step 1: Soupiska** — `src/ui/obrazovky/Soupiska.tsx`:

```tsx
import { overall } from '../../core/sestava'
import type { GameState } from '../../core/types'

const POZICE = { G: 'Brankář', D: 'Obránce', U: 'Útočník' } as const

export function Soupiska({ hra }: { hra: GameState }) {
  const hraci = [...hra.tymy[hra.mujKlubId].hraci].sort((a, b) => overall(b) - overall(a))
  return (
    <>
      <h2>Soupiska</h2>
      <table>
        <thead>
          <tr>
            <th>Hráč</th><th>Pozice</th><th>Věk</th><th>Celkem</th><th>Stř</th><th>Při</th>
            <th>Bru</th><th>Obr</th><th>Fyz</th><th>Chy</th><th>Forma</th><th>Únava</th><th>G</th><th>A</th>
          </tr>
        </thead>
        <tbody>
          {hraci.map((h) => (
            <tr key={h.id}>
              <td>{h.jmeno} {h.prijmeni}</td>
              <td>{POZICE[h.pozice]}</td>
              <td>{h.vek}</td>
              <td><b>{overall(h)}</b></td>
              <td>{h.atributy.strelba}</td>
              <td>{h.atributy.prihravky}</td>
              <td>{h.atributy.brusleni}</td>
              <td>{h.atributy.obrana}</td>
              <td>{h.atributy.fyzicka}</td>
              <td>{h.atributy.chytani}</td>
              <td>{h.forma}</td>
              <td>{h.unava}</td>
              <td>{h.goly}</td>
              <td>{h.asistence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
```

- [ ] **Step 2: Sestava (výměna kliknutím)** — `src/ui/obrazovky/Sestava.tsx`:

```tsx
import { useState } from 'react'
import { overall, vymenVSestave } from '../../core/sestava'
import type { GameState } from '../../core/types'

export function SestavaObrazovka({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [vybrany, setVybrany] = useState<string | null>(null)
  const tym = hra.tymy[hra.mujKlubId]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))

  function klik(id: string) {
    if (!vybrany) return setVybrany(id)
    if (vybrany === id) return setVybrany(null)
    if (podleId.get(vybrany)!.pozice !== podleId.get(id)!.pozice) return setVybrany(id) // jen stejná pozice
    const novaSestava = vymenVSestave(tym.sestava, vybrany, id)
    setHra({ ...hra, tymy: { ...hra.tymy, [hra.mujKlubId]: { ...tym, sestava: novaSestava } } })
    setVybrany(null)
  }

  const Karta = ({ id }: { id: string }) => {
    const h = podleId.get(id)!
    return (
      <button className={`tlacitko sekundarni klik ${vybrany === id ? 'vybrany' : ''}`} onClick={() => klik(id)}>
        {h.jmeno} {h.prijmeni} ({overall(h)})
      </button>
    )
  }

  const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar])
  const nahradnici = tym.hraci.filter((h) => !vSestave.has(h.id))

  return (
    <>
      <h2>Sestava</h2>
      <p>Klikni na dva hráče stejné pozice a prohodí se (i s náhradníkem).</p>
      {tym.sestava.utoky.map((lajna, i) => (
        <div key={i} className="karta">
          <b>{i + 1}. útok:</b> {lajna.map((id) => <Karta key={id} id={id} />)}
        </div>
      ))}
      {tym.sestava.obrany.map((dvojice, i) => (
        <div key={i} className="karta">
          <b>{i + 1}. obrana:</b> {dvojice.map((id) => <Karta key={id} id={id} />)}
        </div>
      ))}
      <div className="karta">
        <b>Brankář:</b> <Karta id={tym.sestava.brankar} />
      </div>
      <div className="karta">
        <b>Náhradníci:</b> {nahradnici.map((h) => <Karta key={h.id} id={h.id} />)}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Ověřit v prohlížeči**

Run: `npm run dev`. Expected: Soupiska ukazuje 20 hráčů seřazených podle Celkem; Sestava ukazuje 4 útoky / 3 obrany / brankáře / náhradníky; kliknutí na dva útočníky je prohodí (vidět okamžitě), výměna útočníka s obráncem se neprovede; po výměně a odehrání zápasu hra drží novou sestavu.

- [ ] **Step 4: Commit**

```bash
git add src/ui/obrazovky/Soupiska.tsx src/ui/obrazovky/Sestava.tsx
git commit -m "feat: obrazovky soupisky a sestavy s výměnou hráčů"
```

---

### Task 14: Obrazovky Poslední zápas a Soutěže

**Files:**
- Modify: `src/ui/obrazovky/Zapas.tsx` (nahradit stub)
- Modify: `src/ui/obrazovky/Liga.tsx` (nahradit stub)

**Interfaces:**
- Consumes: `spocitejTabulku`, typy; `hra.posledniZapas`; `liga.playoff`.
- Produces: `Zapas({ hra })`, `LigaObrazovka({ hra })`.

- [ ] **Step 1: Poslední zápas** — `src/ui/obrazovky/Zapas.tsx`:

```tsx
import type { GameState } from '../../core/types'

export function Zapas({ hra }: { hra: GameState }) {
  const z = hra.posledniZapas
  if (!z) {
    return (
      <>
        <h2>Poslední zápas</h2>
        <p>Zatím jste neodehráli žádný zápas.</p>
      </>
    )
  }
  const v = z.vysledek
  const dodatek = v.najezdy ? ' po nájezdech' : v.prodlouzeni ? ' po prodloužení' : ''
  return (
    <>
      <h2>
        {hra.tymy[z.domaci].nazev} {v.golyDomaci} : {v.golyHoste} {hra.tymy[z.hoste].nazev}
        {dodatek}
      </h2>
      <p>
        Střely na branku: {v.strelyDomaci} : {v.strelyHoste} · hráno den {z.den}
      </p>
      <div className="karta">
        {v.udalosti.map((u, i) => (
          <div key={i} className={u.typ === 'gol' ? 'udalost-gol zprava' : 'zprava'}>
            {u.text}
          </div>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Soutěže (tabulky + playoff)** — `src/ui/obrazovky/Liga.tsx`:

```tsx
import { useState } from 'react'
import { spocitejTabulku } from '../../core/tabulka'
import type { GameState } from '../../core/types'

const NAZVY_KOL = ['Čtvrtfinále', 'Semifinále', 'Finále']

export function LigaObrazovka({ hra }: { hra: GameState }) {
  const [uroven, setUroven] = useState(hra.ligy.findIndex((l) => l.tymy.includes(hra.mujKlubId)))
  const liga = hra.ligy[uroven]
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  return (
    <>
      <h2>Soutěže</h2>
      <p>
        {hra.ligy.map((l) => (
          <button
            key={l.uroven}
            className={`tlacitko ${l.uroven === uroven ? '' : 'sekundarni'}`}
            style={{ marginRight: 8 }}
            onClick={() => setUroven(l.uroven)}
          >
            {l.nazev}
          </button>
        ))}
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Tým</th><th>Z</th><th>V</th><th>VP</th><th>PP</th><th>P</th><th>Skóre</th><th>B</th>
          </tr>
        </thead>
        <tbody>
          {tabulka.map((r, i) => (
            <tr key={r.tymId} className={r.tymId === hra.mujKlubId ? 'muj' : ''}>
              <td>{i + 1}.</td>
              <td>{hra.tymy[r.tymId].nazev}</td>
              <td>{r.zapasy}</td>
              <td>{r.vyhry}</td>
              <td>{r.vyhryP}</td>
              <td>{r.prohryP}</td>
              <td>{r.prohry}</td>
              <td>{r.vstrelene}:{r.obdrzene}</td>
              <td><b>{r.body}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      {liga.playoff && (
        <div className="karta">
          <h3>Playoff{liga.playoff.vitez ? ` — vítěz: ${hra.tymy[liga.playoff.vitez].nazev} 🏆` : ''}</h3>
          {liga.playoff.kola.map((kolo, i) => (
            <div key={i}>
              <b>{NAZVY_KOL[i]}</b>
              {kolo.map((serie, j) => (
                <div key={j} className="zprava">
                  {hra.tymy[serie.domaci].nazev} {serie.vyhryDomaci} : {serie.vyhryHoste}{' '}
                  {hra.tymy[serie.hoste].nazev}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Ověřit v prohlížeči**

Run: `npm run dev`. Expected: po odehrání zápasu ukazuje „Poslední zápas" skóre, střely a chronologii s zeleně zvýrazněnými góly; „Soutěže" přepíná tři ligy, můj klub je podbarvený; poklikáním „Pokračovat" až za den 90 se objeví playoff pavouk a série postupně rostou.

- [ ] **Step 4: Commit**

```bash
git add src/ui/obrazovky/Zapas.tsx src/ui/obrazovky/Liga.tsx
git commit -m "feat: obrazovky posledního zápasu a soutěží s playoff"
```

---

### Task 15: Uložení hry, dohrání sezóny a Linux build

**Files:**
- Modify: `src/ui/obrazovky/Ulozeni.tsx` (nahradit stub)
- Modify: `src-tauri/tauri.conf.json` (název okna, identifikátor)

**Interfaces:**
- Consumes: store API z Tasku 12.
- Produces: hotové M1 — hratelná hra v Tauri okně + AppImage/deb balíček.

- [ ] **Step 1: Obrazovka Uložení** — `src/ui/obrazovky/Ulozeni.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { GameState } from '../../core/types'
import { nactiHru, seznamSlotu, ulozHru, type InfoSlotu } from '../store'

export function Ulozeni({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [sloty, setSloty] = useState<InfoSlotu[]>([])
  const [zprava, setZprava] = useState('')
  const obnov = () => void seznamSlotu().then(setSloty)
  useEffect(obnov, [])
  const info = (n: number) => sloty.find((s) => s.slot === n)
  const popis = (s: InfoSlotu) =>
    `${s.klub}, sezóna ${s.sezona}, den ${s.den} (${new Date(s.ulozeno).toLocaleString('cs')})`
  return (
    <>
      <h2>Uložení hry</h2>
      {[1, 2, 3].map((n) => (
        <div key={n} className="karta">
          <p>
            <b>Slot {n}:</b> {info(n) ? popis(info(n)!) : 'prázdný'}
          </p>
          <button
            className="tlacitko"
            onClick={async () => {
              await ulozHru(n, hra)
              obnov()
              setZprava(`Uloženo do slotu ${n}.`)
            }}
          >
            Uložit
          </button>{' '}
          {info(n) && (
            <button
              className="tlacitko sekundarni"
              onClick={async () => {
                const s = await nactiHru(n)
                if (s) {
                  setHra(s)
                  setZprava(`Načteno ze slotu ${n}.`)
                }
              }}
            >
              Načíst
            </button>
          )}
        </div>
      ))}
      <div className="karta">
        <b>Autosave:</b> {info(0) ? popis(info(0)!) : 'zatím nic'} — ukládá se automaticky po každém tahu.
      </div>
      {zprava && <p>{zprava}</p>}
    </>
  )
}
```

- [ ] **Step 2: Ověřit ukládání v prohlížeči**

Run: `npm run dev`. Expected: Uložit do slotu 1 → popis slotu se objeví; Pokračovat o pár dní → Načíst slot 1 → hra se vrátí ke staršímu dni; autosave řádek ukazuje poslední tah.

- [ ] **Step 3: Dohrát celou sezónu (ruční E2E)**

V Tauri okně (`npm run tauri dev`): odklikat celou sezónu až do konce playoff, zahájit novou sezónu. Expected: žádná chyba v konzoli, postup/sestup vidět v tabulkách (jiné složení lig), soupiska má hráče o rok starší, autosave funguje po restartu aplikace.

- [ ] **Step 4: Build pro Linux**

V `src-tauri/tauri.conf.json` zkontroluj `productName: "Hokejový manažer"`, `identifier: "cz.honzik.hokejmanazer"`.

Run: `npm run tauri build` → Expected: vznikne `src-tauri/target/release/bundle/appimage/*.AppImage` (a .deb); AppImage jde spustit a hra funguje.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ukládání do slotů a Linux build — M1 hotovo"
git tag m1
```

---

## Self-review plánu

- **Pokrytí M1 ze specu:** výběr klubu (T12), sestava (T5+T13), simulace s textovým průběhem (T8+T14), tabulky (T7+T14), celá sezóna s playoff a postupem/sestupem (T9+T10), ukládání (T11+T12+T15), generovaní hráči (T4), 3 ligy × 14 reálných klubů (T3). Morálka a únava zapojené zjednodušeně (T10) — plná verze s tréninkem patří do M3. Mimo M1 (dle specu): vizualizace/momentum (M2), přestupy/finance/sponzoři/média (M3), reálná jména hráčů (M4).
- **Typy:** názvy a signatury napříč tasky sjednocené (`vytvorRozpis`, `spocitejTabulku`, `zapisVysledekSerie`, `vymenVSestave`, store API).
- **Kalibrace simulace (T8):** konstanty jsou odhad; testy vynucují realistické rozsahy a určují, kterým směrem ladit.

## Poznámka k výchozí sestavě AI

AI týmy nerotují sestavu podle únavy — hraje se symetricky (všichni hrají stejně často), takže to nikoho neznevýhodňuje. <!-- ponytail: AI rotace sestavy až když bude únava reálně bolet, tj. s tréninkem v M3 -->







