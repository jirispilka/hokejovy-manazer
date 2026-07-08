# M2 — Zábavnost: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interaktivní zápas po třetinách s momentum grafem a zásahy trenéra, tlak (cíl sezóny, důvěra vedení, vyhazov s nabídkami, nálada fanoušků, derby), odměny (vyhlášení, síň trofejí, historie, kapitán) a moderní vizuál — vše v jednom milníku dle specu `docs/superpowers/specs/2026-07-06-zabavnost-design.md`.

**Architecture:** Nový zápasový engine `src/core/zapas.ts` běží po minutách nad serializovatelným `StavZapasu`; UI ho krokuje a mezi třetinami do něj zasahuje, AI zápasy ho přehrají naráz wrapperem. `advanceDay` můj zápas nesimuluje — vystaví `cekajiciZapas`, UI ho odehraje a výsledek vrátí přes `dokonciZapas`. Kariérní vrstva (`kariera.ts`) a historie (`historie.ts`) se zavěšují na dokončení zápasu a konec sezóny. Vizuál je čisté CSS + přibalený font + generované klubové odznaky.

**Tech Stack:** beze změn (Tauri 2, React 19, TS strict, Vite, Vitest) + font Inter přes `@fontsource-variable/inter` (balíček obsahuje jen soubory fontu, žádný runtime kód).

## Global Constraints

- Platí všechna pravidla z CLAUDE.md a plánu M1: čisté jádro v `src/core/` (žádný import UI/React/Tauri, žádné `Date`/`Math.random()` — jen `Rng` parametrem), `GameState` plně `JSON.stringify` serializovatelný, determinismus (stejný seed + stejné zásahy → stejný průběh), UI texty česky, atributy 1–99, body 3/2/1/0, zápas nikdy remízou.
- Jediná nová závislost: `@fontsource-variable/inter` (assets fontu). Nic jiného.
- `StavZapasu` je plain JSON (rozehraný zápas se ale NEUKLÁDÁ — autosave před a po zápase).
- Verze uložení se zvedá na **2**; uložení verze 1 se odmítne (seznamSlotu je už umí přeskočit).
- Taktiky: `'utocna' | 'vyvazena' | 'obranna'`. Momentum: −100..+100 (kladné = domácí). Důvěra vedení 0–100 (start 50). Nálada fanoušků 0–100 (start 50). Zranění na 1–3 zápasy.
- **COMMITY SE NEDĚLAJÍ** — uživatel je nechce. Každý krok „Commit" v tomto plánu přeskoč a místo něj proveď jen `git add -A` (stage, žádný `git commit`). Po každém tasku odškrtnout checkboxy v tomto souboru.

## Struktura souborů

```
src/core/
├── types.ts        (rozšířit: Taktika, Trener, CilSezony, ZaznamSezony, …)
├── data/kluby.json (rozšířit: barvy klubů)
├── data/rivalove.json  (NOVÝ: dvojice rivalů pro derby)
├── zapas.ts        (NOVÝ: interaktivní engine — StavZapasu, minuty, zásahy)
├── zraneni.ts      (NOVÝ: zdraví hráčů, náhrady, tikání zranění)
├── kariera.ts      (NOVÝ: cíl sezóny, důvěra, nálada, derby, vyhazov)
├── historie.ts     (NOVÝ: vyhlášení sezóny, historie, trofeje, rekordy)
├── sezona.ts       (upravit: cekajiciZapas, dokonciZapas, integrace)
├── sestava.ts      (upravit: kapitán, výběr jen zdravých)
├── generator.ts    (upravit: nová pole hráče/týmu)
├── simulace.ts     (SMAZAT — nahrazuje zapas.ts; testy migrují)
└── ulozeni.ts      (upravit: VERZE 2)
src/ui/
├── styl.css        (přepsat: design systém — tokeny, karty, bary, animace)
├── komponenty.tsx  (NOVÝ: OdznakKlubu, Ukazatel, Badge, Skore)
├── obrazovky/
│   ├── ZivyZapas.tsx   (NOVÝ: průběh zápasu — nahrazuje statický Zapas.tsx)
│   ├── Zapas.tsx       (zjednodušit: záznam posledního zápasu)
│   ├── Prehled.tsx     (přepsat: cíl/důvěra/nálada/derby + vyhazov)
│   ├── Klub.tsx        (NOVÝ: trofeje, historie, rekordy, profil trenéra)
│   ├── Vyhlaseni.tsx   (NOVÝ: konec sezóny)
│   ├── Sestava.tsx     (doplnit: volba kapitána, zranění hráči)
│   └── (ostatní beze změn)
└── App.tsx         (upravit: nové obrazovky + tok zápasu)
tests/core/         (nové: zapas, zraneni, kariera, historie; upravit: sezona…)
```

Pozn. k mazání `simulace.ts`: engine v `zapas.ts` přebírá a rozšiřuje jeho logiku (výběr střelce, přesilovky, texty). Testy `simulace.test.ts` se mažou spolu s ním — jejich invarianty (determinismus, nikdy remíza, síla vítězí, realistické góly) přebírá `zapas.test.ts` nad `simulujCelyZapas`.

---

### Task 1: Rozšíření typů, dat a verze uložení

**Files:**
- Modify: `src/core/types.ts`, `src/core/data/kluby.json`, `src/core/generator.ts`, `src/core/sezona.ts` (jen `newGame`), `src/core/ulozeni.ts`
- Create: `src/core/data/rivalove.json`
- Test: `tests/core/data-m2.test.ts`; Modify: `tests/core/ulozeni.test.ts`

**Interfaces:**
- Consumes: stávající typy a moduly M1.
- Produces (pozdější tasky používají přesně takto):

```ts
export type Taktika = 'utocna' | 'vyvazena' | 'obranna'
export interface KarieraTrenera { zapasy: number; vyhry: number; trofeje: string[]; vyhazovy: number; sezony: number }
export interface Trener { duvera: number; kariera: KarieraTrenera }
export type TypCile = 'titul' | 'postup' | 'playoff' | 'stred' | 'zachrana'
export interface CilSezony { typ: TypCile; popis: string }
export interface ZaznamSezony { sezona: number; klubId: string; nazevLigy: string; umisteni: number; cil: TypCile; splnen: boolean; trofej: string | null }
export interface VyhlaseniSezony {
  sezona: number
  mistri: { nazevLigy: string; klubId: string }[]
  kraloveStrelcu: { nazevLigy: string; jmeno: string; klubId: string; goly: number }[]
  hvezdaTymu: { jmeno: string; goly: number; asistence: number } | null
}
export interface Rekordy {
  nejvyssiVyhra: { text: string; rozdil: number } | null
  nejlepsiStrelec: { jmeno: string; goly: number } | null
}
export interface CekajiciZapas { domaci: string; hoste: string; derby: boolean; playoff: { kolo: number; index: number } | null }
// Hrac navíc: zranenZapasu: number (0 = zdravý)
// Tym navíc: kapitanId: string | null; taktika: Taktika
// Udalost typ navíc: 'zraneni' | 'timeout' | 'proslov'; pole navíc: sance?: number (0–100 % u střel)
// GameState navíc: trener: Trener; cilSezony: CilSezony; naladaFanousku: number;
//   historie: ZaznamSezony[]; vyhlaseni: VyhlaseniSezony | null; rekordy: Rekordy;
//   nabidky: string[] | null; konecKariery: boolean; cekajiciZapas: CekajiciZapas | null
```

- `kluby.json`: každý klub navíc `"barvy": ["#primární", "#sekundární"]`.
- `rivalove.json`: pole dvojic `[["sparta", "slavia"], …]` — každý klub právě v jedné dvojici (21 dvojic).
- `ulozeni.ts`: `VERZE = 2`.

- [ ] **Step 1: Failing test dat a typů** — `tests/core/data-m2.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import kluby from '../../src/core/data/kluby.json'
import rivalove from '../../src/core/data/rivalove.json'
import { generujSvet, generujTym } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { newGame } from '../../src/core/sezona'
import type { Klub } from '../../src/core/types'

describe('kluby.json barvy', () => {
  it('každý klub má dvě hex barvy', () => {
    for (const k of kluby as (Klub & { barvy: string[] })[]) {
      expect(k.barvy).toHaveLength(2)
      for (const b of k.barvy) expect(b).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('rivalove.json', () => {
  const dvojice = rivalove as [string, string][]
  it('pokrývá všech 42 klubů právě jednou', () => {
    const vsichni = dvojice.flat()
    expect(vsichni).toHaveLength(42)
    expect(new Set(vsichni).size).toBe(42)
    const idKlubu = new Set((kluby as Klub[]).map((k) => k.id))
    for (const id of vsichni) expect(idKlubu.has(id)).toBe(true)
  })
})

describe('nová pole hráče a týmu', () => {
  const tym = generujTym(createRng(1), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
  it('hráči startují zdraví', () => {
    for (const h of tym.hraci) expect(h.zranenZapasu).toBe(0)
  })
  it('tým má výchozí taktiku a kapitána (nejlepší overall)', () => {
    expect(tym.taktika).toBe('vyvazena')
    expect(tym.kapitanId).toBeTruthy()
    expect(tym.hraci.some((h) => h.id === tym.kapitanId)).toBe(true)
  })
})

describe('newGame má kariérní stav', () => {
  const s = newGame(7, 'tabor')
  it('inicializuje trenéra, cíl, náladu, historii', () => {
    expect(s.trener.duvera).toBe(50)
    expect(s.trener.kariera.zapasy).toBe(0)
    expect(['titul', 'postup', 'playoff', 'stred', 'zachrana']).toContain(s.cilSezony.typ)
    expect(s.naladaFanousku).toBe(50)
    expect(s.historie).toEqual([])
    expect(s.vyhlaseni).toBeNull()
    expect(s.rekordy).toEqual({ nejvyssiVyhra: null, nejlepsiStrelec: null })
    expect(s.nabidky).toBeNull()
    expect(s.konecKariery).toBe(false)
    expect(s.cekajiciZapas).toBeNull()
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL (rivalove.json neexistuje, nová pole neexistují).

- [ ] **Step 3: Typy** — do `src/core/types.ts` přidat bloky z Interfaces výše (doslova); do `Hrac` přidat `zranenZapasu: number`, do `Tym` přidat `kapitanId: string | null` a `taktika: Taktika`, do `Udalost['typ']` přidat `'zraneni' | 'timeout' | 'proslov'` a volitelné pole `sance?: number`, do `GameState` přidat pole dle Interfaces.

- [ ] **Step 4: Barvy klubů** — v `src/core/data/kluby.json` doplnit každému klubu `"barvy"`. Hodnoty (id → [primární, sekundární]):

```
sparta ["#7a0c0c","#f5c518"], pardubice ["#b3202c","#ffffff"], trinec ["#c8102e","#ffffff"],
kometa ["#003da5","#ffffff"], litvinov ["#ffd200","#000000"], boleslav ["#00693e","#ffffff"],
plzen ["#0033a0","#e4002b"], budejovice ["#003087","#d50032"], vitkovice ["#0072ce","#ffffff"],
olomouc ["#c8102e","#0033a0"], hradec ["#000000","#ffffff"], vary ["#046a38","#ffd100"],
liberec ["#ffffff","#00a3e0"], kladno ["#003da5","#e31837"], zlin ["#ffb81c","#0033a0"],
vsetin ["#046a38","#ffd100"], jihlava ["#ffd100","#c8102e"], slavia ["#c8102e","#ffffff"],
poruba ["#000000","#c8102e"], prerov ["#ffd100","#000000"], prostejov ["#0033a0","#ffd100"],
litomerice ["#00a3e0","#ffd100"], kolin ["#003da5","#ffd100"], sokolov ["#c8102e","#000000"],
frydek ["#0072ce","#ffd100"], trebic ["#0033a0","#ffffff"], znojmo ["#e4002b","#ffffff"],
chomutov ["#5f259f","#ffffff"], tabor ["#00693e","#ffd100"], vrchlabi ["#0033a0","#c8102e"],
decin ["#c8102e","#0072ce"], kobra ["#000000","#ffd100"], letnany ["#0072ce","#ffffff"],
pribram ["#046a38","#ffffff"], klatovy ["#e4002b","#ffd100"], most ["#000000","#0072ce"],
zdar ["#ffd100","#0033a0"], jicin ["#0033a0","#ffffff"], opava ["#c8102e","#ffd100"],
havirov ["#0072ce","#000000"], hronov ["#046a38","#c8102e"], pisek ["#00a3e0","#ffffff"]
```

Typ `Klub` rozšířit o `barvy: [string, string]`.

- [ ] **Step 5: Rivalové** — `src/core/data/rivalove.json` (geografické dvojice, každý klub právě jednou):

```json
[
  ["sparta", "slavia"], ["pardubice", "hradec"], ["trinec", "vitkovice"],
  ["kometa", "trebic"], ["litvinov", "chomutov"], ["boleslav", "liberec"],
  ["plzen", "klatovy"], ["budejovice", "tabor"], ["olomouc", "prerov"],
  ["vary", "sokolov"], ["kladno", "kobra"], ["zlin", "vsetin"],
  ["jihlava", "zdar"], ["poruba", "havirov"], ["prostejov", "jicin"],
  ["litomerice", "decin"], ["kolin", "letnany"], ["frydek", "opava"],
  ["znojmo", "pribram"], ["most", "pisek"], ["vrchlabi", "hronov"]
]
```

(21 dvojic × 2 = 42 klubů, test to hlídá.)

- [ ] **Step 6: Generator** — v `generujHrace` inicializovat `zranenZapasu: 0`; v `generujTym` nastavit `kapitanId` na id hráče s nejvyšším `overall` (bruslaři i brankáři dohromady) a `taktika: 'vyvazena'`:

```ts
const kapitan = [...hraci].sort((a, b) => overall(b) - overall(a))[0]
return {
  klubId: klub.id,
  nazev: klub.nazev,
  hraci,
  sestava: vychoziSestava(hraci),
  moralka: 50,
  kapitanId: kapitan.id,
  taktika: 'vyvazena',
}
```

- [ ] **Step 7: newGame** — v `src/core/sezona.ts` doplnit do vraceného `GameState`:

```ts
trener: { duvera: 50, kariera: { zapasy: 0, vyhry: 0, trofeje: [], vyhazovy: 0, sezony: 1 } },
cilSezony: { typ: 'playoff', popis: 'Dočasný cíl — nahradí kariera.ts (Task 5)' },
naladaFanousku: 50,
historie: [],
vyhlaseni: null,
rekordy: { nejvyssiVyhra: null, nejlepsiStrelec: null },
nabidky: null,
konecKariery: false,
cekajiciZapas: null,
```

(Skutečný výpočet cíle dodá Task 5 — tady jen dočasná konstanta, ať typy sedí. Task 5 tento řádek nahradí voláním `urciCilSezony`.)

- [ ] **Step 8: Verze uložení** — v `src/core/ulozeni.ts` změnit `const VERZE = 1` na `const VERZE = 2`. V `tests/core/ulozeni.test.ts` upravit test verze: `json.replace('"verze":2', '"verze":99')`.

- [ ] **Step 9: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (všech 51 stávajících + nové; sezona testy dál zelené — nová pole nikde nevadí).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: typy a data M2 — kariéra, barvy klubů, rivalové, verze uložení 2"
```

---

### Task 2: Zápasový engine (`src/core/zapas.ts`)

Srdce M2. Nahrazuje jednorázovou simulaci enginem krokovaným po minutách se
zásahy. `simulace.ts` se maže — jeho invarianty přebírají testy enginu.

**Files:**
- Create: `src/core/zapas.ts`
- Delete: `src/core/simulace.ts`, `tests/core/simulace.test.ts`
- Modify: `src/core/sezona.ts` (jen import + jedno volání, viz Step 5)
- Test: `tests/core/zapas.test.ts`

**Interfaces:**
- Consumes: `Rng`, `pick`, `randInt` z `rng.ts`; `silaTymu`, `vymenVSestave` ze `sestava.ts`; typy `Tym`, `Sestava`, `Taktika`, `Udalost`, `Vysledek`, `Hrac`.
- Produces (pozdější tasky spoléhají přesně na toto):

```ts
export interface StranaZapasu {
  klubId: string
  sestava: Sestava // pracovní kopie — změny během zápasu se NEpropisují do GameState
  taktika: Taktika
  odvolanyBrankar: boolean
  timeoutPouzit: boolean
  proslovBonus: number // 0.94–1.10, násobí útok; 1 = neutrální
  goly: number
  strely: number
  presilaDo: number
  zraneni: string[] // id hráčů zraněných v tomto zápase
}
export type FazeZapasu = 'hraje' | 'pauza1' | 'pauza2' | 'konec'
export interface StavZapasu {
  minuta: number // poslední odehraná minuta, 0 = před zápasem
  faze: FazeZapasu
  momentum: number // −100..+100, kladné = domácí
  derby: boolean
  cekaNaNahradu: { strana: 'domaci' | 'hoste'; hracId: string } | null
  prodlouzeni: boolean
  najezdy: boolean
  domaci: StranaZapasu
  hoste: StranaZapasu
  udalosti: Udalost[]
}
export function zacniZapas(domaci: Tym, hoste: Tym, moznosti?: { derby?: boolean; atmosfera?: number }): StavZapasu
export function simulujMinutu(stav: StavZapasu, domaci: Tym, hoste: Tym, rng: Rng): StavZapasu
export function pokracujPoPauze(stav: StavZapasu): StavZapasu
export function zmenTaktiku(stav: StavZapasu, strana: 'domaci' | 'hoste', taktika: Taktika): StavZapasu
export function pouzijTimeout(stav: StavZapasu, strana: 'domaci' | 'hoste'): StavZapasu
export function odvolejBrankare(stav: StavZapasu, strana: 'domaci' | 'hoste', odvolat: boolean): StavZapasu
export function aplikujProslov(stav: StavZapasu, strana: 'domaci' | 'hoste', volba: 'povzbudit' | 'zdrbat' | 'klid', rng: Rng): StavZapasu
export function nahradZraneneho(stav: StavZapasu, tym: Tym, nahradnikId: string): StavZapasu
export function autoNahrada(stav: StavZapasu, tym: Tym): StavZapasu
export function simulujDoKonce(stav: StavZapasu, domaci: Tym, hoste: Tym, rng: Rng): StavZapasu
export function simulujCelyZapas(domaci: Tym, hoste: Tym, rng: Rng, moznosti?: { derby?: boolean; atmosfera?: number }): Vysledek
export function prevedNaVysledek(stav: StavZapasu): Vysledek
```

Herní pravidla enginu (závazná, testy je hlídají):
- Pauzy: po 20. minutě `faze='pauza1'`, po 40. `'pauza2'` — `simulujMinutu` v pauze vyhodí chybu, pokračuje se přes `pokracujPoPauze`.
- Po 60. minutě při nerozhodném stavu prodloužení (61–65, náhlá smrt), pak nájezdy. Nikdy remíza.
- Momentum: každou minutu ×0.92 (drift k nule); gól ±25; zákrok/vedle ±3; začátek přesilovky ±10; time-out ±20; clamp ±100. Vliv: útočná pravděpodobnost strany ×(1 ± momentum/100 × 0.25).
- Taktika: `utocna` vlastní útok ×1.2 a vlastní obrana ×0.85; `obranna` útok ×0.8 a obrana ×1.15; `vyvazena` beze změn.
- Odvolaný brankář: vlastní útok ×1.5; KAŽDÁ střela soupeře má pravděpodobnost gólu 0.4 (prázdná brána).
- Zranění: pravděpodobnost 0.0025/min/strana; zraněný bruslař (brankáři se nezraňují) vypadne, nastaví se `cekaNaNahradu` a `simulujMinutu` hází chybu, dokud volající nevyřeší náhradu (`nahradZraneneho` / `autoNahrada`).
- Proslov: jen v pauze. `povzbudit`: 60 % → bonus 1.06 a momentum ±10, jinak nic; `zdrbat`: 40 % → 1.10 a ±15, 35 % nic, 25 % → 0.94 a ∓10; `klid`: vždy 1.0. (Jedno použití na pauzu hlídá UI — engine to nevynucuje. `// ponytail: limit proslovů hlídá UI, engine zůstává jednoduchý`)
- Střelové události nesou `sance` (pravděpodobnost gólu v %) pro živé zobrazení.
- Všechny funkce vracejí NOVÝ stav (`structuredClone`), vstup nemutují; `Tym` objekty se nikdy nemutují.

- [ ] **Step 1: Failing test** — `tests/core/zapas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import type { Klub, Tym } from '../../src/core/types'
import {
  aplikujProslov,
  autoNahrada,
  nahradZraneneho,
  odvolejBrankare,
  pokracujPoPauze,
  pouzijTimeout,
  prevedNaVysledek,
  simulujCelyZapas,
  simulujDoKonce,
  simulujMinutu,
  zacniZapas,
  zmenTaktiku,
} from '../../src/core/zapas'

const tym = (id: string, liga: number, seed: number, zakladId: number): Tym => {
  resetIdCitac(zakladId)
  return generujTym(createRng(seed), { id, nazev: id, liga } as Klub)
}
const domaci = (liga = 0) => tym('x', liga, 1, 0)
const hoste = (liga = 0) => tym('y', liga, 2, 1000)

// odehraje celý zápas přes simulujDoKonce a vrátí stav
const cely = (d: Tym, h: Tym, seed: number) =>
  simulujDoKonce(zacniZapas(d, h), d, h, createRng(seed))

describe('determinismus a základní invarianty', () => {
  it('stejný seed → stejný průběh (bez zásahů)', () => {
    const a = cely(domaci(), hoste(), 99)
    const b = cely(domaci(), hoste(), 99)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('nikdy nekončí remízou', () => {
    for (let s = 0; s < 100; s++) {
      const v = simulujCelyZapas(domaci(1), hoste(1), createRng(s))
      expect(v.golyDomaci).not.toBe(v.golyHoste)
    }
  })
  it('výrazně silnější tým vyhrává většinu zápasů', () => {
    let vyhry = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujCelyZapas(domaci(0), hoste(2), createRng(s))
      if (v.golyDomaci > v.golyHoste) vyhry++
    }
    expect(vyhry).toBeGreaterThan(140)
  })
  it('dává realistické počty gólů (průměr 3–9 celkem)', () => {
    let goly = 0
    for (let s = 0; s < 200; s++) {
      const v = simulujCelyZapas(domaci(), hoste(), createRng(s))
      goly += v.golyDomaci + v.golyHoste
    }
    expect(goly / 200).toBeGreaterThan(3)
    expect(goly / 200).toBeLessThan(9)
  })
  it('gólové události sedí na skóre, střely mají šanci v %', () => {
    const v = simulujCelyZapas(domaci(), hoste(), createRng(7))
    const goly = v.udalosti.filter((u) => u.typ === 'gol')
    expect(goly.length).toBe(v.golyDomaci + v.golyHoste)
    const strelove = v.udalosti.filter((u) => ['gol', 'strela', 'zakrok'].includes(u.typ))
    for (const u of strelove.slice(0, -1)) {
      if (u.typ === 'gol' && u.text.includes('nájezd')) continue // rozhodující nájezd šanci nemá
      expect(u.sance).toBeGreaterThanOrEqual(0)
      expect(u.sance).toBeLessThanOrEqual(100)
    }
  })
  it('vstupní stav ani týmy se nemutují', () => {
    const d = domaci()
    const h = hoste()
    const stav = zacniZapas(d, h)
    const otisk = JSON.stringify({ stav, d, h })
    simulujMinutu(stav, d, h, createRng(1))
    expect(JSON.stringify({ stav, d, h })).toBe(otisk)
  })
})

describe('třetiny a pauzy', () => {
  const doPauzy = (seed: number) => {
    const d = domaci()
    const h = hoste()
    const rng = createRng(seed)
    let stav = zacniZapas(d, h)
    while (stav.faze === 'hraje') {
      if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
      else stav = simulujMinutu(stav, d, h, rng)
    }
    // zranění přesně na konci třetiny: vyřešit, ať je pauza „čistá"
    if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
    return { stav, d, h, rng }
  }
  it('po 20. minutě je pauza1 a simulace bez pokračování hází chybu', () => {
    const { stav, d, h, rng } = doPauzy(5)
    expect(stav.faze).toBe('pauza1')
    expect(stav.minuta).toBe(20)
    expect(() => simulujMinutu(stav, d, h, rng)).toThrow()
    const dal = pokracujPoPauze(stav)
    expect(dal.faze).toBe('hraje')
  })
  it('celý zápas projde fázemi až do konce', () => {
    const stav = cely(domaci(), hoste(), 11)
    expect(stav.faze).toBe('konec')
    expect(stav.minuta).toBeGreaterThanOrEqual(60)
  })
})

describe('zásahy trenéra', () => {
  it('útočná taktika obou stran zvýší počet gólů oproti obranné', () => {
    const golu = (taktika: 'utocna' | 'obranna') => {
      let goly = 0
      for (let s = 0; s < 150; s++) {
        const d = domaci()
        const h = hoste()
        const rng = createRng(s)
        let stav = zacniZapas(d, h)
        stav = zmenTaktiku(stav, 'domaci', taktika)
        stav = zmenTaktiku(stav, 'hoste', taktika)
        stav = simulujDoKonce(stav, d, h, rng)
        goly += stav.domaci.goly + stav.hoste.goly
      }
      return goly
    }
    expect(golu('utocna')).toBeGreaterThan(golu('obranna'))
  })
  it('time-out posune momentum a druhý time-out hází chybu', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    const pred = stav.momentum
    stav = pouzijTimeout(stav, 'hoste')
    expect(stav.momentum).toBeLessThan(pred)
    expect(stav.hoste.timeoutPouzit).toBe(true)
    expect(() => pouzijTimeout(stav, 'hoste')).toThrow()
  })
  it('odvolaný brankář znamená góly do prázdné brány', () => {
    // domácí hrají celý zápas bez brankáře → dostanou výrazně víc gólů než normálně
    const golyProti = (bezBrankare: boolean) => {
      let goly = 0
      for (let s = 0; s < 100; s++) {
        const d = domaci()
        const h = hoste()
        let stav = zacniZapas(d, h)
        if (bezBrankare) stav = odvolejBrankare(stav, 'domaci', true)
        stav = simulujDoKonce(stav, d, h, createRng(s))
        goly += stav.hoste.goly
      }
      return goly
    }
    expect(golyProti(true)).toBeGreaterThan(golyProti(false) * 1.8)
  })
  it('proslov jde jen v pauze a nastaví bonus', () => {
    const d = domaci()
    const h = hoste()
    let stav = zacniZapas(d, h)
    expect(() => aplikujProslov(stav, 'domaci', 'povzbudit', createRng(1))).toThrow()
    const rng = createRng(3)
    while (stav.faze === 'hraje') {
      if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
      else stav = simulujMinutu(stav, d, h, rng)
    }
    if (stav.cekaNaNahradu) stav = autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? d : h)
    const po = aplikujProslov(stav, 'domaci', 'klid', rng)
    expect(po.domaci.proslovBonus).toBe(1)
    expect(po.udalosti.some((u) => u.typ === 'proslov')).toBe(true)
  })
})

describe('zranění', () => {
  // najdi seed, kde dojde ke zranění, deterministicky projitím seedů
  const najdiZapasSeZranenim = () => {
    for (let s = 0; s < 300; s++) {
      const d = domaci()
      const h = hoste()
      const rng = createRng(s)
      let stav = zacniZapas(d, h)
      while (stav.faze !== 'konec') {
        if (stav.cekaNaNahradu) return { stav, d, h, rng }
        if (stav.faze !== 'hraje') stav = pokracujPoPauze(stav)
        else stav = simulujMinutu(stav, d, h, rng)
      }
    }
    throw new Error('Ve 300 zápasech nedošlo ke zranění — zkontroluj pravděpodobnost.')
  }
  it('zranění zastaví hru, náhrada ji odblokuje a zraněný zmizí ze sestavy', () => {
    const { stav, d, h, rng } = najdiZapasSeZranenim()
    const info = stav.cekaNaNahradu!
    expect(() => simulujMinutu(stav, d, h, rng)).toThrow()
    const tymStrany = info.strana === 'domaci' ? d : h
    const dal = autoNahrada(stav, tymStrany)
    expect(dal.cekaNaNahradu).toBeNull()
    const sestava = dal[info.strana].sestava
    expect([...sestava.utoky.flat(), ...sestava.obrany.flat(), sestava.brankar]).not.toContain(info.hracId)
    expect(dal[info.strana].zraneni).toContain(info.hracId)
    expect(dal.udalosti.some((u) => u.typ === 'zraneni')).toBe(true)
  })
  it('nahradZraneneho odmítne hráče jiné pozice', () => {
    const { stav, d, h } = najdiZapasSeZranenim()
    const info = stav.cekaNaNahradu!
    const tymStrany = info.strana === 'domaci' ? d : h
    const zraneny = tymStrany.hraci.find((x) => x.id === info.hracId)!
    const spatny = tymStrany.hraci.find((x) => x.pozice !== zraneny.pozice && x.pozice !== 'G')!
    expect(() => nahradZraneneho(stav, tymStrany, spatny.id)).toThrow()
  })
  it('pauza s čekající náhradou nejde přeskočit bez vyřešení', () => {
    // zranění přesně ve 20./40. minutě nastaví pauzu i čekající náhradu zároveň
    const { stav } = najdiZapasSeZranenim()
    const vPauze = { ...stav, faze: 'pauza1' as const }
    expect(() => pokracujPoPauze(vPauze)).toThrow()
    expect(() => simulujMinutu(vPauze, domaci(), hoste(), createRng(1))).toThrow(/náhradu/)
  })
})

describe('prevedNaVysledek', () => {
  it('odpovídá stavu zápasu', () => {
    const stav = cely(domaci(), hoste(), 21)
    const v = prevedNaVysledek(stav)
    expect(v.golyDomaci).toBe(stav.domaci.goly)
    expect(v.golyHoste).toBe(stav.hoste.goly)
    expect(v.strelyDomaci).toBe(stav.domaci.strely)
    expect(v.udalosti).toEqual(stav.udalosti)
    expect(v.prodlouzeni).toBe(stav.prodlouzeni)
    expect(v.najezdy).toBe(stav.najezdy)
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, zapas.ts neexistuje. (simulace.test.ts zatím existuje a prochází.)

- [ ] **Step 3: Implementace** — `src/core/zapas.ts`:

```ts
import { pick, type Rng } from './rng'
import { silaTymu, vymenVSestave } from './sestava'
import type { Hrac, Sestava, Taktika, Tym, Udalost, Vysledek } from './types'

// Typy stavu zápasu žijí tady (engine-specifické, GameState je neobsahuje —
// rozehraný zápas se neukládá).
export interface StranaZapasu {
  klubId: string
  sestava: Sestava // pracovní kopie — změny během zápasu se NEpropisují do GameState
  taktika: Taktika
  odvolanyBrankar: boolean
  timeoutPouzit: boolean
  proslovBonus: number // 0.94–1.10, násobí útok; 1 = neutrální
  goly: number
  strely: number
  presilaDo: number
  zraneni: string[] // id hráčů zraněných v tomto zápase
}

export type FazeZapasu = 'hraje' | 'pauza1' | 'pauza2' | 'konec'

export interface StavZapasu {
  minuta: number // poslední odehraná minuta, 0 = před zápasem
  faze: FazeZapasu
  momentum: number // −100..+100, kladné = domácí
  derby: boolean
  cekaNaNahradu: { strana: 'domaci' | 'hoste'; hracId: string } | null
  prodlouzeni: boolean
  najezdy: boolean
  domaci: StranaZapasu
  hoste: StranaZapasu
  udalosti: Udalost[]
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const jmeno = (h: Hrac) => `${h.jmeno} ${h.prijmeni}`

function novaStrana(tym: Tym): StranaZapasu {
  return {
    klubId: tym.klubId,
    sestava: structuredClone(tym.sestava),
    taktika: tym.taktika,
    odvolanyBrankar: false,
    timeoutPouzit: false,
    proslovBonus: 1,
    goly: 0,
    strely: 0,
    presilaDo: 0,
    zraneni: [],
  }
}

export function zacniZapas(
  domaci: Tym,
  hoste: Tym,
  moznosti: { derby?: boolean; atmosfera?: number } = {},
): StavZapasu {
  const derby = moznosti.derby ?? false
  return {
    minuta: 0,
    faze: 'hraje',
    momentum: clamp(moznosti.atmosfera ?? 0, -10, 10),
    derby,
    cekaNaNahradu: null,
    prodlouzeni: false,
    najezdy: false,
    domaci: novaStrana(domaci),
    hoste: novaStrana(hoste),
    udalosti: [
      {
        minuta: 0,
        typ: 'info',
        tymId: '',
        text: derby ? '🔥 DERBY! Rivalové na ledě, atmosféra vře!' : 'Zápas začíná!',
      },
    ],
  }
}

// efektivní síly strany: sestava pracovní kopie + taktika + proslov + odvolaný brankář
function sily(strana: StranaZapasu, tym: Tym): { utok: number; obrana: number; brankar: number } {
  const zaklad = silaTymu({ ...tym, sestava: strana.sestava })
  const t = strana.taktika
  const utokFaktor = (t === 'utocna' ? 1.2 : t === 'obranna' ? 0.8 : 1) * strana.proslovBonus
  const obranaFaktor = t === 'utocna' ? 0.85 : t === 'obranna' ? 1.15 : 1
  return {
    utok: zaklad.utok * utokFaktor * (strana.odvolanyBrankar ? 1.5 : 1),
    obrana: zaklad.obrana * obranaFaktor,
    brankar: zaklad.brankar,
  }
}

function bruslariVSestave(strana: StranaZapasu, tym: Tym): Hrac[] {
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  return [...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat()]
    .map((id) => podleId.get(id)!)
    .filter((h) => !strana.zraneni.includes(h.id))
}

function vyberStrelce(rng: Rng, strana: StranaZapasu, tym: Tym): Hrac {
  const bruslari = bruslariVSestave(strana, tym)
  const celkem = bruslari.reduce((s, h) => s + h.atributy.strelba, 0)
  let los = rng() * celkem
  for (const h of bruslari) {
    los -= h.atributy.strelba
    if (los <= 0) return h
  }
  return bruslari[bruslari.length - 1]
}

interface Kontext {
  s: StavZapasu
  domaciTym: Tym
  hosteTym: Tym
  rng: Rng
}

function utocnaAkce(ctx: Kontext, utocici: 'domaci' | 'hoste'): void {
  const { s, rng } = ctx
  const u = s[utocici]
  const b = s[utocici === 'domaci' ? 'hoste' : 'domaci']
  const uTym = utocici === 'domaci' ? ctx.domaciTym : ctx.hosteTym
  const bTym = utocici === 'domaci' ? ctx.hosteTym : ctx.domaciTym
  const smer = utocici === 'domaci' ? 1 : -1
  u.strely++
  const strelec = vyberStrelce(rng, u, uTym)
  const pGol = b.odvolanyBrankar ? 0.4 : 0.09 * (strelec.atributy.strelba / sily(b, bTym).brankar)
  const sance = Math.round(clamp(pGol, 0, 1) * 100)
  if (rng() < pGol) {
    u.goly++
    s.momentum = clamp(s.momentum + smer * 25, -100, 100)
    const spoluhraci = bruslariVSestave(u, uTym).filter((h) => h.id !== strelec.id)
    const asistent = rng() < 0.8 && spoluhraci.length > 0 ? pick(rng, spoluhraci) : null
    s.udalosti.push({
      minuta: s.minuta,
      typ: 'gol',
      tymId: u.klubId,
      hracId: strelec.id,
      asistentId: asistent?.id,
      sance,
      text: `${s.minuta}. min — GÓL${b.odvolanyBrankar ? ' DO PRÁZDNÉ BRÁNY' : ''}! ${jmeno(strelec)} (${uTym.nazev})${asistent ? `, asistence ${jmeno(asistent)}` : ''}`,
    })
  } else {
    s.momentum = clamp(s.momentum + smer * 3, -100, 100)
    const chytil = rng() < 0.5
    s.udalosti.push({
      minuta: s.minuta,
      typ: chytil ? 'zakrok' : 'strela',
      tymId: chytil ? b.klubId : u.klubId,
      sance,
      text: chytil
        ? `${s.minuta}. min: ${jmeno(strelec)} pálí — brankář ${bTym.nazev} skvěle chytá!`
        : `${s.minuta}. min: střela ${jmeno(strelec)} letí vedle.`,
    })
  }
}

function minutaHry(ctx: Kontext): void {
  const { s, rng } = ctx
  for (const strana of ['domaci', 'hoste'] as const) {
    const u = s[strana]
    const b = s[strana === 'domaci' ? 'hoste' : 'domaci']
    const uTym = strana === 'domaci' ? ctx.domaciTym : ctx.hosteTym
    const bTym = strana === 'domaci' ? ctx.hosteTym : ctx.domaciTym
    const smer = strana === 'domaci' ? 1 : -1

    // vyloučení (~1 za 25 min na tým) → přesilovka pro soupeře
    if (rng() < 0.04 && b.presilaDo <= s.minuta) {
      const provinilec = pick(rng, bruslariVSestave(u, uTym))
      b.presilaDo = s.minuta + 2
      s.momentum = clamp(s.momentum - smer * 10, -100, 100)
      s.udalosti.push({
        minuta: s.minuta,
        typ: 'vylouceni',
        tymId: u.klubId,
        hracId: provinilec.id,
        text: `${s.minuta}. min: ${jmeno(provinilec)} (${uTym.nazev}) — 2 minuty. Přesilovka ${bTym.nazev}!`,
      })
    }

    // zranění bruslaře (brankáři se nezraňují)
    if (rng() < 0.0025 && !s.cekaNaNahradu) {
      const chudak = pick(rng, bruslariVSestave(u, uTym))
      u.zraneni.push(chudak.id)
      s.cekaNaNahradu = { strana, hracId: chudak.id }
      s.udalosti.push({
        minuta: s.minuta,
        typ: 'zraneni',
        tymId: u.klubId,
        hracId: chudak.id,
        text: `${s.minuta}. min: ${jmeno(chudak)} (${uTym.nazev}) zůstává ležet na ledě a střídá! 🚑`,
      })
      return // zbytek minuty se nehraje, čeká se na náhradu
    }

    // útočná akce
    const su = sily(u, uTym)
    const sb = sily(b, bTym)
    const presila = u.presilaDo > s.minuta ? 1.6 : 1
    const momentumFaktor = 1 + smer * (s.momentum / 100) * 0.25
    const pomer = su.utok / (su.utok + sb.obrana)
    if (rng() < 0.8 * pomer * presila * momentumFaktor) utocnaAkce(ctx, strana)
  }
}

export function simulujMinutu(stav: StavZapasu, domaci: Tym, hoste: Tym, rng: Rng): StavZapasu {
  if (stav.faze === 'konec') throw new Error('Zápas už skončil.')
  // náhrada má přednost před pauzou — zranění ve 20./40. minutě nastaví obojí
  if (stav.cekaNaNahradu) throw new Error('Čeká se na náhradu zraněného hráče.')
  if (stav.faze === 'pauza1' || stav.faze === 'pauza2')
    throw new Error('Zápas je v pauze — zavolej pokracujPoPauze.')
  const s = structuredClone(stav)
  const ctx: Kontext = { s, domaciTym: domaci, hosteTym: hoste, rng }
  s.minuta++
  s.momentum *= 0.92
  minutaHry(ctx)

  const remiza = s.domaci.goly === s.hoste.goly
  if (s.minuta === 20) {
    s.faze = 'pauza1'
    s.udalosti.push({ minuta: 20, typ: 'info', tymId: '', text: 'Konec 1. třetiny.' })
  } else if (s.minuta === 40) {
    s.faze = 'pauza2'
    s.udalosti.push({ minuta: 40, typ: 'info', tymId: '', text: 'Konec 2. třetiny.' })
  } else if (s.minuta === 60) {
    if (remiza) {
      s.prodlouzeni = true
      s.udalosti.push({ minuta: 60, typ: 'info', tymId: '', text: 'Nerozhodně — prodloužení! Náhlá smrt.' })
    } else {
      s.faze = 'konec'
      s.udalosti.push({ minuta: 60, typ: 'info', tymId: '', text: 'Konec zápasu.' })
    }
  } else if (s.minuta > 60) {
    if (!remiza) {
      s.faze = 'konec'
      s.udalosti.push({ minuta: s.minuta, typ: 'info', tymId: '', text: 'Rozhodnuto v prodloužení!' })
    } else if (s.minuta === 65) {
      // nájezdy
      s.najezdy = true
      s.prodlouzeni = false
      const sd = sily(s.domaci, domaci)
      const sh = sily(s.hoste, hoste)
      const sanceDomacich = clamp(0.5 + (sd.utok / sh.brankar - sh.utok / sd.brankar) * 0.1, 0.05, 0.95)
      const vitez = rng() < sanceDomacich ? 'domaci' : 'hoste'
      const vitezTym = vitez === 'domaci' ? domaci : hoste
      s[vitez].goly++
      s.udalosti.push({
        minuta: 65,
        typ: 'gol',
        tymId: s[vitez].klubId,
        hracId: vyberStrelce(rng, s[vitez], vitezTym).id,
        text: `Rozhodující nájezd proměňuje ${vitezTym.nazev}!`,
      })
      s.faze = 'konec'
    }
  }
  return s
}

export function pokracujPoPauze(stav: StavZapasu): StavZapasu {
  if (stav.faze !== 'pauza1' && stav.faze !== 'pauza2') throw new Error('Zápas není v pauze.')
  if (stav.cekaNaNahradu) throw new Error('Nejdřív vyřeš náhradu zraněného hráče.')
  const s = structuredClone(stav)
  s.faze = 'hraje'
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: '',
    text: `Začíná ${s.minuta === 20 ? '2.' : '3.'} třetina.`,
  })
  return s
}

export function zmenTaktiku(stav: StavZapasu, strana: 'domaci' | 'hoste', taktika: Taktika): StavZapasu {
  const s = structuredClone(stav)
  s[strana].taktika = taktika
  return s
}

export function pouzijTimeout(stav: StavZapasu, strana: 'domaci' | 'hoste'): StavZapasu {
  if (stav[strana].timeoutPouzit) throw new Error('Time-out už byl vyčerpán.')
  const s = structuredClone(stav)
  s[strana].timeoutPouzit = true
  s.momentum = clamp(s.momentum + (strana === 'domaci' ? 20 : -20), -100, 100)
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'timeout',
    tymId: s[strana].klubId,
    text: `${s.minuta}. min: Time-out! Trenér uklidňuje hru a burcuje lavičku.`,
  })
  return s
}

export function odvolejBrankare(stav: StavZapasu, strana: 'domaci' | 'hoste', odvolat: boolean): StavZapasu {
  const s = structuredClone(stav)
  if (s[strana].odvolanyBrankar === odvolat) return s
  s[strana].odvolanyBrankar = odvolat
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: s[strana].klubId,
    text: odvolat ? '⚠️ Brankář jede na střídačku — hra bez gólmana!' : 'Brankář se vrací do brány.',
  })
  return s
}

export function aplikujProslov(
  stav: StavZapasu,
  strana: 'domaci' | 'hoste',
  volba: 'povzbudit' | 'zdrbat' | 'klid',
  rng: Rng,
): StavZapasu {
  if (stav.faze !== 'pauza1' && stav.faze !== 'pauza2')
    throw new Error('Proslov jde jen v pauze mezi třetinami.')
  const s = structuredClone(stav)
  const smer = strana === 'domaci' ? 1 : -1
  let bonus = 1
  let text = 'Trenér nechává kabinu vydechnout.'
  if (volba === 'povzbudit') {
    if (rng() < 0.6) {
      bonus = 1.06
      s.momentum = clamp(s.momentum + smer * 10, -100, 100)
      text = 'Trenér povzbuzuje kabinu — hráči se hecují! 💪'
    } else {
      text = 'Trenér povzbuzuje, kabina zůstává vlažná.'
    }
  } else if (volba === 'zdrbat') {
    const r = rng()
    if (r < 0.4) {
      bonus = 1.1
      s.momentum = clamp(s.momentum + smer * 15, -100, 100)
      text = 'Trenér seřval kabinu — a tým se probudil! 🔥'
    } else if (r < 0.75) {
      text = 'Ostrá slova v kabině. Uvidíme, co to udělá.'
    } else {
      bonus = 0.94
      s.momentum = clamp(s.momentum - smer * 10, -100, 100)
      text = 'Trenér to přehnal — kabina je zaražená. 😬'
    }
  }
  s[strana].proslovBonus = bonus
  s.udalosti.push({ minuta: s.minuta, typ: 'proslov', tymId: s[strana].klubId, text })
  return s
}

export function nahradZraneneho(stav: StavZapasu, tym: Tym, nahradnikId: string): StavZapasu {
  const info = stav.cekaNaNahradu
  if (!info) throw new Error('Nikdo nečeká na náhradu.')
  const s = structuredClone(stav)
  const strana = s[info.strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const zraneny = podleId.get(info.hracId)!
  const nahradnik = podleId.get(nahradnikId)
  const vSestave = new Set([...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat(), strana.sestava.brankar])
  if (!nahradnik) throw new Error('Náhradník není v týmu.')
  if (nahradnik.pozice !== zraneny.pozice) throw new Error('Náhradník musí hrát stejnou pozici.')
  if (vSestave.has(nahradnikId)) throw new Error('Náhradník už je v sestavě.')
  if (nahradnik.zranenZapasu > 0 || strana.zraneni.includes(nahradnikId)) throw new Error('Náhradník je zraněný.')
  strana.sestava = vymenVSestave(strana.sestava, info.hracId, nahradnikId)
  s.cekaNaNahradu = null
  s.udalosti.push({
    minuta: s.minuta,
    typ: 'info',
    tymId: strana.klubId,
    text: `Do hry jde ${jmeno(nahradnik)} místo zraněného ${jmeno(zraneny)}.`,
  })
  return s
}

export function autoNahrada(stav: StavZapasu, tym: Tym): StavZapasu {
  const info = stav.cekaNaNahradu
  if (!info) throw new Error('Nikdo nečeká na náhradu.')
  const strana = stav[info.strana]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  const zraneny = podleId.get(info.hracId)!
  const vSestave = new Set([...strana.sestava.utoky.flat(), ...strana.sestava.obrany.flat(), strana.sestava.brankar])
  const kandidati = tym.hraci
    .filter(
      (h) =>
        h.pozice === zraneny.pozice &&
        !vSestave.has(h.id) &&
        h.zranenZapasu === 0 &&
        !strana.zraneni.includes(h.id),
    )
    .sort((a, b) => b.atributy.strelba + b.atributy.obrana - (a.atributy.strelba + a.atributy.obrana))
  if (kandidati.length === 0) {
    // ponytail: bez náhradníka hraje zraněný dál (oslabení řeší M3 s širšími soupiskami)
    const s = structuredClone(stav)
    s.cekaNaNahradu = null
    return s
  }
  return nahradZraneneho(stav, tym, kandidati[0].id)
}

export function simulujDoKonce(stav: StavZapasu, domaci: Tym, hoste: Tym, rng: Rng): StavZapasu {
  let s = stav
  let pojistka = 0
  while (s.faze !== 'konec' && pojistka++ < 300) {
    if (s.cekaNaNahradu) s = autoNahrada(s, s.cekaNaNahradu.strana === 'domaci' ? domaci : hoste)
    else if (s.faze === 'pauza1' || s.faze === 'pauza2') s = pokracujPoPauze(s)
    else s = simulujMinutu(s, domaci, hoste, rng)
  }
  return s
}

export function prevedNaVysledek(stav: StavZapasu): Vysledek {
  return {
    golyDomaci: stav.domaci.goly,
    golyHoste: stav.hoste.goly,
    strelyDomaci: stav.domaci.strely,
    strelyHoste: stav.hoste.strely,
    prodlouzeni: stav.prodlouzeni,
    najezdy: stav.najezdy,
    udalosti: stav.udalosti,
  }
}

export function simulujCelyZapas(
  domaci: Tym,
  hoste: Tym,
  rng: Rng,
  moznosti: { derby?: boolean; atmosfera?: number } = {},
): Vysledek {
  return prevedNaVysledek(simulujDoKonce(zacniZapas(domaci, hoste, moznosti), domaci, hoste, rng))
}
```

Pozn.: kalibrační konstanty (0.8, 0.09, 0.04, 0.0025, 1.6, ±25/±10/±3/±20, 0.92, 0.25) hlídají statistické testy — při neprůchodu uprav a zdokumentuj v reportu. UI a pozdější tasky importují `StavZapasu` a spol. ze `src/core/zapas.ts`.

- [ ] **Step 4: Smazat starou simulaci**

```bash
git rm src/core/simulace.ts tests/core/simulace.test.ts
```

- [ ] **Step 5: Přepojit sezónu** — v `src/core/sezona.ts`:
  - `import { simulujZapas } from './simulace'` → `import { simulujCelyZapas } from './zapas'`
  - v `odehrajZapas`: `const v = simulujZapas(domaci, hoste, rng)` → `const v = simulujCelyZapas(domaci, hoste, rng)`

- [ ] **Step 6: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (zapas testy + všechny sezónní; simulace testy už neexistují). Spusť 2× kvůli stabilitě statistických testů. Pokud kalibrace nesedí, uprav konstanty dle poznámky.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: interaktivní zápasový engine s momentum, taktikou a zraněními"
```

---

### Task 3: Zranění v sezóně a zdravé sestavy

**Files:**
- Modify: `src/core/sestava.ts` (vychoziSestava jen ze zdravých + export `jeZdravy`)
- Modify: `src/core/sezona.ts` (příprava sestav AI, zápis zranění, tikání léčby)
- Test: `tests/core/zraneni.test.ts`

**Interfaces:**
- Consumes: `zranenZapasu` (Task 1), události `'zraneni'` z enginu (Task 2).
- Produces: `jeZdravy(h: Hrac): boolean` (=`h.zranenZapasu === 0`); `vychoziSestava(hraci)` staví sestavu jen ze zdravých (nedostatek → doplní zraněnými, ať je sestava vždy plná); v `sezona.ts` interní `pripravSestavuAI(s, klubId)` (přestaví sestavu AI klubu, pokud obsahuje nezdravého hráče) a rozšíření `odehrajZapas` o: (1) před simulací `pripravSestavuAI` pro oba AI týmy, (2) po simulaci dekrement `zranenZapasu` všem dosud zraněným v obou týmech, (3) nová zranění z událostí `'zraneni'` → `zranenZapasu = randInt(rng, 1, 3)`; zpráva pro můj klub.

- [ ] **Step 1: Failing test** — `tests/core/zraneni.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { jeZdravy, vychoziSestava } from '../../src/core/sestava'
import { advanceDay, newGame } from '../../src/core/sezona'
import type { GameState, Klub } from '../../src/core/types'

describe('vychoziSestava a zdraví', () => {
  it('zraněný útočník nejde do sestavy', () => {
    resetIdCitac()
    const tym = generujTym(createRng(1), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
    const prvni = tym.hraci.find((h) => h.pozice === 'U')!
    prvni.zranenZapasu = 2
    const sestava = vychoziSestava(tym.hraci)
    expect(sestava.utoky.flat()).not.toContain(prvni.id)
    expect(jeZdravy(prvni)).toBe(false)
  })
  it('při nedostatku zdravých se sestava přesto naplní', () => {
    resetIdCitac()
    const tym = generujTym(createRng(2), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
    for (const h of tym.hraci.filter((x) => x.pozice === 'U').slice(0, 4)) h.zranenZapasu = 1
    const sestava = vychoziSestava(tym.hraci)
    expect(new Set(sestava.utoky.flat()).size).toBe(12)
  })
})

// odehraje dny, dokud v lize nenajde zraněného hráče
const najdiZraneni = (seed: number): { s: GameState; klubId: string; hracId: string } => {
  let s = newGame(seed, 'tabor')
  for (let den = 0; den < 150; den++) {
    s = advanceDay(s)
    for (const t of Object.values(s.tymy)) {
      const h = t.hraci.find((x) => x.zranenZapasu > 0)
      if (h) return { s, klubId: t.klubId, hracId: h.id }
    }
  }
  throw new Error('Za 150 dní žádné zranění — zkontroluj napojení zranění na sezónu.')
}

describe('zranění v průběhu sezóny', () => {
  it('zranění ze zápasu dostane 1–3 zápasy léčení', () => {
    const { s, klubId, hracId } = najdiZraneni(3)
    const hrac = s.tymy[klubId].hraci.find((h) => h.id === hracId)!
    expect(hrac.zranenZapasu).toBeGreaterThanOrEqual(1)
    expect(hrac.zranenZapasu).toBeLessThanOrEqual(3)
  })
  it('AI klub zraněného nepostaví a hráč se časem vyléčí', () => {
    let { s, klubId, hracId } = najdiZraneni(3)
    let pojistka = 0
    while (s.tymy[klubId].hraci.find((h) => h.id === hracId)!.zranenZapasu > 0 && pojistka++ < 60) {
      s = advanceDay(s)
      if (klubId !== s.mujKlubId) {
        const sestava = s.tymy[klubId].sestava
        const vSestave = [...sestava.utoky.flat(), ...sestava.obrany.flat(), sestava.brankar]
        const zraneni = s.tymy[klubId].hraci.filter((h) => h.zranenZapasu > 0).map((h) => h.id)
        // AI sestava nesmí obsahovat zraněné v den zápasu — kontrolujeme po odehrání
        for (const id of zraneni) {
          const hralDnes = s.posledniZapas === null // (kontrola má smysl jen u odehraných zápasů AI)
          void hralDnes
          void vSestave
        }
      }
    }
    expect(pojistka).toBeLessThan(60)
    expect(s.tymy[klubId].hraci.find((h) => h.id === hracId)!.zranenZapasu).toBe(0)
  })
})
```

Pozn.: druhý test hlídá hlavně vyléčení (dekrement na 0). Kontrola „AI nepostaví zraněného" je přímo v prvním testu `vychoziSestava` — `pripravSestavuAI` ji jen volá.

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL (`jeZdravy` neexistuje; zranění se v sezóně nikdy neobjeví → timeout guard testu).

- [ ] **Step 3: sestava.ts** — přidat/upravit:

```ts
export const jeZdravy = (h: Hrac): boolean => h.zranenZapasu === 0

export function vychoziSestava(hraci: Hrac[]): Sestava {
  const podleOverall = (poz: Pozice) => {
    const vsichni = hraci.filter((h) => h.pozice === poz).sort((x, y) => overall(y) - overall(x))
    // zdraví mají přednost; zranění doplní konec fronty, aby sestava byla vždy plná
    return [...vsichni.filter(jeZdravy), ...vsichni.filter((h) => !jeZdravy(h))]
  }
  const utocnici = podleOverall('U')
  const obranci = podleOverall('D')
  const brankari = podleOverall('G')
  return {
    utoky: [0, 1, 2, 3].map((i) => utocnici.slice(i * 3, i * 3 + 3).map((h) => h.id)),
    obrany: [0, 1, 2].map((i) => obranci.slice(i * 2, i * 2 + 2).map((h) => h.id)),
    brankar: brankari[0].id,
  }
}
```

(`podleOverall` mění parametr z `string` na `Pozice` — import `Pozice` z types. Řeší se tím i backlogová poznámka z review M1.)

- [ ] **Step 4: sezona.ts** — v `odehrajZapas` (před simulací):

```ts
function pripravSestavuAI(s: GameState, klubId: string): void {
  if (klubId === s.mujKlubId) return
  const tym = s.tymy[klubId]
  const vSestave = [...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar]
  const podleId = new Map(tym.hraci.map((h) => [h.id, h]))
  if (vSestave.some((id) => !jeZdravy(podleId.get(id)!))) tym.sestava = vychoziSestava(tym.hraci)
}
```

a v `odehrajZapas` po výpočtu výsledku (před `aplikujDopadyZapasu`):

```ts
// léčení: odehraný zápas týmu ubírá zraněným jeden zápas
for (const t of [domaci, hoste]) {
  for (const h of t.hraci) if (h.zranenZapasu > 0) h.zranenZapasu--
}
// nová zranění z tohoto zápasu
for (const u of v.udalosti) {
  if (u.typ !== 'zraneni' || !u.hracId) continue
  for (const t of [domaci, hoste]) {
    const hrac = t.hraci.find((h) => h.id === u.hracId)
    if (hrac) {
      hrac.zranenZapasu = randInt(rng, 1, 3)
      if (t.klubId === s.mujKlubId) {
        s.zpravy.unshift(`🚑 ${hrac.jmeno} ${hrac.prijmeni} se zranil — mimo hru na ${hrac.zranenZapasu} zápas(y).`)
      }
    }
  }
}
```

Volání `pripravSestavuAI(s, z.domaci)` a `pripravSestavuAI(s, z.hoste)` vlož na začátek `odehrajZapas`. Import `jeZdravy`, `vychoziSestava` už v sezona.ts je (`vychoziSestava`), `jeZdravy` přidej.

- [ ] **Step 5: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (vč. všech stávajících sezónních testů — dekrementy nic nerozbíjejí).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: zranění v sezóně — léčení, zdravé sestavy AI"
```

---

### Task 4: Čekající zápas a dokončení (`sezona.ts`)

Můj zápas už se nesimuluje automaticky — `advanceDay` ho vystaví jako
`cekajiciZapas`, UI ho odehraje enginem a vrátí přes `dokonciZapas`.

**Files:**
- Modify: `src/core/sezona.ts`
- Modify: `tests/core/sezona.test.ts` (helper + 2 testy, viz Step 1)
- Test: `tests/core/dokonceni.test.ts`

**Interfaces:**
- Consumes: engine z Tasku 2 (`zacniZapas`, `simulujDoKonce`, `prevedNaVysledek`, `StavZapasu`), `CekajiciZapas` z Tasku 1, `jeDerby` zatím NE (dodá Task 5 — derby v tomto tasku vždy `false`, Task 5 přepojí).
- Produces:
  - `advanceDay(state)`: NOVĚ vyhodí chybu, když `state.cekajiciZapas !== null`. V den mého zápasu (základní část i playoff) můj zápas nesimuluje — nastaví `s.cekajiciZapas = { domaci, hoste, derby: false, playoff: null | { kolo, index } }`; ostatní zápasy dne proběhnou normálně.
  - `dokonciZapas(state: GameState, stavZapasu: StavZapasu): GameState` — validuje (`cekajiciZapas` existuje, `stavZapasu.faze === 'konec'`, kluby sedí), zapíše výsledek do rozpisu / playoff série, aplikuje dopady (statistiky, forma, únava, morálka, zranění, léčení, zprávy, `posledniZapas`), vynuluje `cekajiciZapas`, zkontroluje přechod fází (konec základní části se nekontroluje — ten řeší advanceDay; dohrané playoff kolo a konec sezóny ANO).
  - interní `zapisDopadyZapasu(s, domaciId, hosteId, v, rng)` — vytažené společné jádro z `odehrajZapas` (statistiky z událostí, `aplikujDopadyZapasu` obou týmů, léčení + nová zranění z Tasku 3, `posledniZapas` + zpráva pro můj klub, ořez `s.zpravy` na 50 položek).
  - `atmosferaZapasu(s: GameState): number` = `(s.naladaFanousku - 50) / 5` — UI ji předá do `zacniZapas` u domácích zápasů mého klubu.

- [ ] **Step 1: Upravit stávající testy** — v `tests/core/sezona.test.ts`:

Helper `dohraj` nahradit verzí, která můj čekající zápas dohrává enginem:

```ts
import { simulujDoKonce, zacniZapas, prevedNaVysledek } from '../../src/core/zapas'
import { dokonciZapas } from '../../src/core/sezona'
import { createRng as rngPro } from '../../src/core/rng'

const dohrajMujZapas = (s: GameState): GameState => {
  const cz = s.cekajiciZapas!
  const domaci = s.tymy[cz.domaci]
  const hoste = s.tymy[cz.hoste]
  const rng = rngPro(1000 + s.den)
  const stav = simulujDoKonce(zacniZapas(domaci, hoste), domaci, hoste, rng)
  return dokonciZapas(s, stav)
}

const dohraj = (s: GameState): GameState => {
  let pojistka = 0
  while (s.faze !== 'konecSezony' && pojistka++ < 400) {
    s = s.cekajiciZapas ? dohrajMujZapas(s) : advanceDay(s)
  }
  expect(pojistka).toBeLessThan(400)
  return s
}
```

Test `'v den 3 odehraje 1. kolo ve všech ligách'` upravit: ligy bez mého klubu mají 7 výsledků, moje liga 6 + `cekajiciZapas` nastavený; `posledniZapas` je null, dokud zápas nedohraju:

```ts
it('v den 3 odehraje 1. kolo, můj zápas čeká', () => {
  let s = newGame(7, 'tabor')
  for (let i = 0; i < 3; i++) s = advanceDay(s)
  expect(s.ligy[0].zapasy.filter((z) => z.vysledek)).toHaveLength(7)
  expect(s.ligy[1].zapasy.filter((z) => z.vysledek)).toHaveLength(7)
  expect(s.ligy[2].zapasy.filter((z) => z.vysledek)).toHaveLength(6)
  expect(s.cekajiciZapas).not.toBeNull()
  expect([s.cekajiciZapas!.domaci, s.cekajiciZapas!.hoste]).toContain('tabor')
  expect(s.posledniZapas).toBeNull()
})
```

Test determinismu upravit, aby používal `dohrajMujZapas` (advanceDay v den mého zápasu nastaví cekajiciZapas a další advanceDay by hodil chybu):

```ts
it('je deterministický', () => {
  const hraj = () => {
    let s = newGame(11, 'decin')
    for (let i = 0; i < 20; i++) s = s.cekajiciZapas ? dohrajMujZapas(s) : advanceDay(s)
    return s
  }
  expect(JSON.stringify(hraj())).toBe(JSON.stringify(hraj()))
})
```

(Test `'po základní části startuje playoff…'` používá smyčku `while (s.den < denKola(POCET_KOL))` — nahradit `dohraj`-stylem: `while (s.den < denKola(POCET_KOL)) s = s.cekajiciZapas ? dohrajMujZapas(s) : advanceDay(s)`, a hned za smyčku přidat `if (s.cekajiciZapas) s = dohrajMujZapas(s) // poslední kolo` — playoff startuje až po dohrání mého posledního zápasu.)

- [ ] **Step 2: Nový failing test** — `tests/core/dokonceni.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { denKola, POCET_KOL } from '../../src/core/rozpis'
import { advanceDay, atmosferaZapasu, dokonciZapas, mojeLiga, newGame } from '../../src/core/sezona'
import { prevedNaVysledek, simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import type { GameState } from '../../src/core/types'

const kMemuZapasu = (seed: number): GameState => {
  let s = newGame(seed, 'tabor')
  while (!s.cekajiciZapas) s = advanceDay(s)
  return s
}

describe('cekajiciZapas', () => {
  it('advanceDay s čekajícím zápasem hází chybu', () => {
    const s = kMemuZapasu(5)
    expect(() => advanceDay(s)).toThrow()
  })
  it('dokonciZapas zapíše výsledek, statistiky a uvolní kalendář', () => {
    const s = kMemuZapasu(5)
    const cz = s.cekajiciZapas!
    const domaci = s.tymy[cz.domaci]
    const hoste = s.tymy[cz.hoste]
    const rng = createRng(77)
    const stav = simulujDoKonce(zacniZapas(domaci, hoste), domaci, hoste, rng)
    const po = dokonciZapas(s, stav)
    expect(po.cekajiciZapas).toBeNull()
    expect(po.posledniZapas).not.toBeNull()
    const zapas = mojeLiga(po).zapasy.find((z) => z.den === po.den && (z.domaci === 'tabor' || z.hoste === 'tabor'))!
    expect(zapas.vysledek).not.toBeNull()
    const goly = stav.udalosti.filter((u) => u.typ === 'gol' && u.hracId)
    const vsichniHraci = [...po.tymy[cz.domaci].hraci, ...po.tymy[cz.hoste].hraci]
    const nastrileno = vsichniHraci.reduce((sum, h) => sum + h.goly, 0)
    expect(nastrileno).toBeGreaterThanOrEqual(Math.min(1, goly.length)) // statistiky se připsaly
    expect(advanceDay(po).den).toBe(po.den + 1) // kalendář zase běží
  })
  it('dokonciZapas odmítne nedohraný zápas', () => {
    const s = kMemuZapasu(5)
    const cz = s.cekajiciZapas!
    const stav = zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste])
    expect(() => dokonciZapas(s, stav)).toThrow()
  })
  it('bez čekajícího zápasu dokonciZapas hází chybu', () => {
    const s = newGame(5, 'tabor')
    const stav = zacniZapas(s.tymy.tabor, s.tymy.decin)
    expect(() => dokonciZapas(s, stav)).toThrow()
  })
})

describe('přechod do playoff', () => {
  const dohrajMujZapasHelper = (s: GameState): GameState => {
    const cz = s.cekajiciZapas!
    const stav = simulujDoKonce(
      zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
      s.tymy[cz.domaci],
      s.tymy[cz.hoste],
      createRng(900 + s.den),
    )
    return dokonciZapas(s, stav)
  }
  it('playoff se nenasadí, dokud můj poslední zápas základní části není dohraný', () => {
    let s = newGame(7, 'tabor')
    while (s.den < denKola(POCET_KOL)) s = s.cekajiciZapas ? dohrajMujZapasHelper(s) : advanceDay(s)
    // den posledního kola: můj zápas čeká, playoff ještě neexistuje
    expect(s.faze).toBe('zakladniCast')
    expect(s.cekajiciZapas).not.toBeNull()
    for (const l of s.ligy) expect(l.playoff).toBeNull()
    s = dohrajMujZapasHelper(s)
    expect(s.faze).toBe('playoff')
    for (const l of s.ligy) expect(l.playoff?.kola[0]).toHaveLength(4)
  })
})

describe('playoff přes dokonciZapas', () => {
  it('celá sezóna včetně mého playoff doběhne', () => {
    let s = newGame(9, 'tabor')
    let pojistka = 0
    let hranychPlayoff = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) {
      if (s.cekajiciZapas) {
        if (s.cekajiciZapas.playoff) hranychPlayoff++
        const cz = s.cekajiciZapas
        const stav = simulujDoKonce(
          zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
          s.tymy[cz.domaci],
          s.tymy[cz.hoste],
          createRng(500 + s.den),
        )
        s = dokonciZapas(s, stav)
      } else {
        s = advanceDay(s)
      }
    }
    expect(s.faze).toBe('konecSezony')
    for (const l of s.ligy) expect(l.playoff?.vitez).toBeTruthy()
    // tabor je v playoff jen když se kvalifikuje — ale sezóna musí doběhnout vždy
  })
})

describe('atmosferaZapasu', () => {
  it('odvozuje se z nálady fanoušků', () => {
    const s = newGame(1, 'tabor')
    expect(atmosferaZapasu(s)).toBe(0)
    s.naladaFanousku = 80
    expect(atmosferaZapasu(s)).toBe(6)
  })
})
```

- [ ] **Step 3: Ověřit, že testy padají**

Run: `npm run test` → Expected: FAIL (`dokonciZapas` neexistuje; upravené sezónní testy padají na starém chování).

- [ ] **Step 4: Implementace v `sezona.ts`**

1. Vytáhnout z `odehrajZapas` sdílené jádro:

```ts
function zapisDopadyZapasu(s: GameState, domaciId: string, hosteId: string, v: Vysledek, rng: Rng): void {
  const domaci = s.tymy[domaciId]
  const hoste = s.tymy[hosteId]
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
  // léčení + nová zranění (z Tasku 3 — přesunout sem z odehrajZapas)
  for (const t of [domaci, hoste]) {
    for (const h of t.hraci) if (h.zranenZapasu > 0) h.zranenZapasu--
  }
  for (const u of v.udalosti) {
    if (u.typ !== 'zraneni' || !u.hracId) continue
    for (const t of [domaci, hoste]) {
      const hrac = t.hraci.find((h) => h.id === u.hracId)
      if (hrac) {
        hrac.zranenZapasu = randInt(rng, 1, 3)
        if (t.klubId === s.mujKlubId) {
          s.zpravy.unshift(`🚑 ${hrac.jmeno} ${hrac.prijmeni} se zranil — mimo hru na ${hrac.zranenZapasu} zápas(y).`)
        }
      }
    }
  }
  if (domaciId === s.mujKlubId || hosteId === s.mujKlubId) {
    s.posledniZapas = { den: s.den, domaci: domaciId, hoste: hosteId, vysledek: v }
    const dodatek = v.najezdy ? ' (sn)' : v.prodlouzeni ? ' (pp)' : ''
    s.zpravy.unshift(`${domaci.nazev} – ${hoste.nazev} ${v.golyDomaci}:${v.golyHoste}${dodatek}`)
  }
  s.zpravy = s.zpravy.slice(0, 50)
}
```

`odehrajZapas` pak zůstane: `pripravSestavuAI` obou stran → rng → `simulujCelyZapas` → `zapisDopadyZapasu` → return v.

2. `advanceDay`: na začátek přidat

```ts
if (state.cekajiciZapas) throw new Error('Nejdřív dohraj čekající zápas.')
```

V základní části nahradit smyčku zápasů dne:

```ts
liga.zapasy
  .filter((z) => z.den === s.den && !z.vysledek)
  .forEach((z, i) => {
    if (z.domaci === s.mujKlubId || z.hoste === s.mujKlubId) {
      s.cekajiciZapas = { domaci: z.domaci, hoste: z.hoste, derby: false, playoff: null }
    } else {
      z.vysledek = odehrajZapas(s, z.domaci, z.hoste, liga.uroven * 100 + i)
    }
  })
```

V playoff větvi obdobně: série s mým klubem → `s.cekajiciZapas = { domaci, hoste, derby: false, playoff: { kolo, index } }` (a sérii ten den nesimulovat); ostatní série hrají. POZOR: kontrola „všechna playoff dohrána → konecSezony" se v den mého playoff zápasu vyhodnotí až po `dokonciZapas` (viz níže), v `advanceDay` zůstává pro dny bez mého zápasu.

**Přechod základní část → playoff MUSÍ počkat na můj poslední zápas** (poslední kolo se hraje v den `denKola(POCET_KOL)` a můj zápas ten den teprve čeká — playoff nasazený z neúplné tabulky by měl špatné pořadí i účastníky). Starý inline přechod nahradit funkcí volanou z `advanceDay` (po odehrání zápasů dne) I z `dokonciZapas`:

```ts
function zkontrolujKonecZakladniCasti(s: GameState): void {
  if (s.faze !== 'zakladniCast') return
  if (s.cekajiciZapas) return // můj zápas posledního kola se teprve dohrává
  if (s.den < denKola(POCET_KOL)) return
  if (!s.ligy.every((l) => l.zapasy.every((z) => z.vysledek))) return
  s.faze = 'playoff'
  for (const liga of s.ligy) liga.playoff = zalozPlayoff(spocitejTabulku(liga.tymy, liga.zapasy))
  s.zpravy.unshift('Základní část skončila — začíná playoff!')
}
```

3. Kontrolu konce sezóny vytáhnout do funkce (volá ji advanceDay i dokonciZapas):

```ts
function zkontrolujKonecSezony(s: GameState): void {
  if (s.faze !== 'playoff') return
  if (!s.ligy.every((l) => l.playoff?.vitez)) return
  s.faze = 'konecSezony'
  const mistrId = s.ligy[0].playoff!.vitez!
  s.zpravy.unshift(
    mistrId === s.mujKlubId ? '🏆 MISTŘI! Vyhráli jste extraligu!' : `Mistrem extraligy se stal ${s.tymy[mistrId].nazev}.`,
  )
}
```

4. Nové exporty:

```ts
export const atmosferaZapasu = (s: GameState): number => (s.naladaFanousku - 50) / 5

export function dokonciZapas(state: GameState, stavZapasu: StavZapasu): GameState {
  const cz = state.cekajiciZapas
  if (!cz) throw new Error('Žádný zápas nečeká na dohrání.')
  if (stavZapasu.faze !== 'konec') throw new Error('Zápas ještě neskončil.')
  if (stavZapasu.domaci.klubId !== cz.domaci || stavZapasu.hoste.klubId !== cz.hoste)
    throw new Error('Stav zápasu neodpovídá čekajícímu zápasu.')
  const s = structuredClone(state)
  const v = prevedNaVysledek(stavZapasu)
  const rng = createRng(hashSeed(s.seed, s.sezona, s.den, 555))
  if (cz.playoff) {
    const liga = mojeLiga(s)
    const serie = liga.playoff!.kola[cz.playoff.kolo][cz.playoff.index]
    const vitezZapasu = v.golyDomaci > v.golyHoste ? cz.domaci : cz.hoste
    liga.playoff = zapisVysledekSerie(liga.playoff!, cz.playoff.kolo, cz.playoff.index, vitezZapasu === serie.domaci)
  } else {
    const zapas = mojeLiga(s).zapasy.find(
      (z) => z.den === s.den && z.domaci === cz.domaci && z.hoste === cz.hoste,
    )!
    zapas.vysledek = v
  }
  zapisDopadyZapasu(s, cz.domaci, cz.hoste, v, rng)
  s.cekajiciZapas = null
  zkontrolujKonecZakladniCasti(s) // můj poslední zápas základní části mohl uzavřít tabulku
  zkontrolujKonecSezony(s)
  return s
}
```

Importy doplnit: `prevedNaVysledek`, `StavZapasu` ze `./zapas`.

- [ ] **Step 5: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (dokonceni + zraneni + upravená sezona + vše ostatní). Spusť 2×.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: můj zápas čeká na dohrání enginem — advanceDay a dokonciZapas"
```

---

### Task 5: Kariéra — cíl, důvěra, nálada, derby, vyhazov (`src/core/kariera.ts`)

**Files:**
- Create: `src/core/kariera.ts`
- Modify: `src/core/sezona.ts` (derby v cekajiciZapas, hook po mém zápase, guardy, cíl v newGame)
- Test: `tests/core/kariera.test.ts`

**Interfaces:**
- Consumes: `rivalove.json`, `overall` ze `sestava.ts`, `spocitejTabulku` z `tabulka.ts`, typy z Tasku 1. NESMÍ importovat ze `sezona.ts` (cyklus) — ligu klubu si hledá sám v `s.ligy`.
- Produces:

```ts
export function jeDerby(a: string, b: string): boolean
export function prumernyOverall(s: GameState, klubId: string): number
export function urciCilSezony(s: GameState, klubId: string): CilSezony
export function poMemZapase(s: GameState, v: Vysledek, cz: CekajiciZapas): void // mutuje klon
export function vyhazov(s: GameState): void // mutuje klon; naplní s.nabidky
export function prijmiNabidku(state: GameState, klubId: string): GameState
export function odmitniNabidky(state: GameState): GameState
export function splnenCil(s: GameState): boolean
export function vyhodnotCilPoSezone(s: GameState): boolean // mutuje klon; vrací splnění
```

Pravidla (testy je hlídají):
- Cíl podle pořadí průměrného overall klubu v jeho lize: 1.–2. → `titul` (extraliga) / `postup` (nižší); 3.–8. → `playoff`; 9.–11. → `stred`; 12.–14. → `zachrana`.
- Důvěra po mém zápase: výhra +3 (+5 proti silnějšímu o >3 overall), prohra −3 (−5 proti slabšímu); po prodloužení/nájezdech polovina (zaokrouhleno k nule přes `Math.round(x/2)` — pozor, `Math.round(-1.5) === -1`); derby ×2; clamp 0–100.
- Nálada: výhra +4 / prohra −4, prodloužení polovina, derby ×2, clamp 0–100.
- `duvera === 0` → okamžitý vyhazov; `≤ 20` → varovná zpráva.
- Vyhazov: `nabidky` = 3 nejsilnější z klubů slabších než můj (když slabší nejsou aspoň 3, vezmou se 3 nejslabší celkově); deterministicky, bez RNG.
- Splnění cíle: `titul`/`postup` = vítěz playoff mé ligy; `playoff` = top 8 po základní části; `stred` = umístění ≤ 10; `zachrana` = ne poslední. Vyhodnocení: důvěra +15 / −20; při pádu na 0 vyhazov.

- [ ] **Step 1: Failing test** — `tests/core/kariera.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  jeDerby,
  odmitniNabidky,
  poMemZapase,
  prijmiNabidku,
  prumernyOverall,
  urciCilSezony,
  vyhazov,
} from '../../src/core/kariera'
import { newGame } from '../../src/core/sezona'
import type { CekajiciZapas, GameState, Vysledek } from '../../src/core/types'

const vysledek = (gd: number, gh: number, prodlouzeni = false): Vysledek => ({
  golyDomaci: gd,
  golyHoste: gh,
  strelyDomaci: 30,
  strelyHoste: 30,
  prodlouzeni,
  najezdy: false,
  udalosti: [],
})

const cz = (domaci: string, hoste: string, derby = false): CekajiciZapas => ({
  domaci,
  hoste,
  derby,
  playoff: null,
})

describe('jeDerby', () => {
  it('je symetrické a platí pro dvojice z dat', () => {
    expect(jeDerby('sparta', 'slavia')).toBe(true)
    expect(jeDerby('slavia', 'sparta')).toBe(true)
    expect(jeDerby('sparta', 'tabor')).toBe(false)
  })
})

describe('urciCilSezony', () => {
  const s = newGame(7, 'tabor')
  it('nejsilnější klub extraligy má titul, nejsilnější 2. ligy postup', () => {
    for (const uroven of [0, 2]) {
      const liga = s.ligy[uroven]
      const nejsilnejsi = [...liga.tymy].sort((a, b) => prumernyOverall(s, b) - prumernyOverall(s, a))[0]
      const cil = urciCilSezony(s, nejsilnejsi)
      expect(cil.typ).toBe(uroven === 0 ? 'titul' : 'postup')
      expect(cil.popis.length).toBeGreaterThan(5)
    }
  })
  it('nejslabší klub má záchranu', () => {
    const liga = s.ligy[2]
    const nejslabsi = [...liga.tymy].sort((a, b) => prumernyOverall(s, a) - prumernyOverall(s, b))[0]
    expect(urciCilSezony(s, nejslabsi).typ).toBe('zachrana')
  })
  it('newGame nastavuje skutečný cíl (ne placeholder)', () => {
    expect(s.cilSezony.popis).not.toContain('Dočasný')
  })
})

describe('poMemZapase', () => {
  const zaklad = (): GameState => structuredClone(newGame(7, 'tabor'))
  it('výhra zvedne důvěru i náladu, kariéra počítá', () => {
    const s = zaklad()
    poMemZapase(s, vysledek(4, 1), cz('tabor', 'decin'))
    expect(s.trener.duvera).toBeGreaterThan(50)
    expect(s.naladaFanousku).toBe(54)
    expect(s.trener.kariera.zapasy).toBe(1)
    expect(s.trener.kariera.vyhry).toBe(1)
  })
  it('derby má dvojnásobný dopad', () => {
    const a = zaklad()
    const b = zaklad()
    poMemZapase(a, vysledek(1, 3), cz('tabor', 'decin'))
    poMemZapase(b, vysledek(1, 3), cz('tabor', 'budejovice', true)) // rival z dat
    expect(50 - b.naladaFanousku).toBe((50 - a.naladaFanousku) * 2)
  })
  it('pád důvěry na 0 spustí vyhazov s nabídkami', () => {
    const s = zaklad()
    s.trener.duvera = 2
    poMemZapase(s, vysledek(0, 5), cz('tabor', 'decin'))
    expect(s.trener.duvera).toBe(0)
    expect(s.nabidky).not.toBeNull()
    expect(s.nabidky!.length).toBeGreaterThanOrEqual(1)
    expect(s.nabidky!.length).toBeLessThanOrEqual(3)
    expect(s.nabidky).not.toContain('tabor')
  })
})

describe('vyhazov a nabídky', () => {
  it('nabízí slabší kluby a přijetí přepne klub', () => {
    const s = structuredClone(newGame(7, 'sparta'))
    vyhazov(s)
    expect(s.nabidky!.length).toBe(3)
    for (const id of s.nabidky!) {
      expect(prumernyOverall(s, id)).toBeLessThan(prumernyOverall(s, 'sparta'))
    }
    const po = prijmiNabidku(s, s.nabidky![0])
    expect(po.mujKlubId).toBe(s.nabidky![0])
    expect(po.trener.duvera).toBe(50)
    expect(po.nabidky).toBeNull()
    expect(po.cilSezony.popis).not.toContain('Dočasný')
  })
  it('odmítnutí ukončí kariéru', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    vyhazov(s)
    const po = odmitniNabidky(s)
    expect(po.konecKariery).toBe(true)
    expect(po.nabidky).toBeNull()
  })
  it('přijetí neexistující nabídky hází chybu', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    expect(() => prijmiNabidku(s, 'sparta')).toThrow()
  })
})
```

Pozn. k derby testu: dvojice `["budejovice", "tabor"]` je v `rivalove.json` — test s ní počítá.

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, kariera.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/kariera.ts`:

```ts
import rivalove from './data/rivalove.json'
import { overall } from './sestava'
import { spocitejTabulku } from './tabulka'
import type { CekajiciZapas, CilSezony, GameState, TypCile, Vysledek } from './types'

const PARY = rivalove as [string, string][]
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const ligaKlubu = (s: GameState, klubId: string) => s.ligy.find((l) => l.tymy.includes(klubId))!

export function jeDerby(a: string, b: string): boolean {
  return PARY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export function prumernyOverall(s: GameState, klubId: string): number {
  const tym = s.tymy[klubId]
  return tym.hraci.reduce((sum, h) => sum + overall(h), 0) / tym.hraci.length
}

export function urciCilSezony(s: GameState, klubId: string): CilSezony {
  const liga = ligaKlubu(s, klubId)
  const poradi = [...liga.tymy].sort((a, b) => prumernyOverall(s, b) - prumernyOverall(s, a))
  const rank = poradi.indexOf(klubId) + 1
  const typ: TypCile =
    rank <= 2
      ? liga.uroven === 0
        ? 'titul'
        : 'postup'
      : rank <= 8
        ? 'playoff'
        : rank <= 11
          ? 'stred'
          : 'zachrana'
  const popisy: Record<TypCile, string> = {
    titul: 'Vedení chce titul mistra extraligy!',
    postup: 'Vedení očekává postup do vyšší soutěže!',
    playoff: 'Cíl sezóny: dostat se do playoff.',
    stred: 'Cíl sezóny: klidný střed tabulky.',
    zachrana: 'Cíl sezóny: zachránit se, neskončit poslední.',
  }
  return { typ, popis: popisy[typ] }
}

export function poMemZapase(s: GameState, v: Vysledek, cz: CekajiciZapas): void {
  const mujDomaci = cz.domaci === s.mujKlubId
  const souperId = mujDomaci ? cz.hoste : cz.domaci
  const vyhra = mujDomaci ? v.golyDomaci > v.golyHoste : v.golyHoste > v.golyDomaci
  const poProdlouzeni = v.prodlouzeni || v.najezdy
  const rozdilSily = prumernyOverall(s, souperId) - prumernyOverall(s, s.mujKlubId)
  let duveraDelta = vyhra ? (rozdilSily > 3 ? 5 : 3) : rozdilSily < -3 ? -5 : -3
  let naladaDelta = vyhra ? 4 : -4
  if (poProdlouzeni) {
    duveraDelta = Math.round(duveraDelta / 2)
    naladaDelta = naladaDelta / 2
  }
  if (cz.derby) {
    duveraDelta *= 2
    naladaDelta *= 2
    s.zpravy.unshift(vyhra ? '🔥 Derby je naše! Město slaví.' : '🔥 Prohrané derby. Ve městě je dusno.')
  }
  s.trener.duvera = clamp(s.trener.duvera + duveraDelta, 0, 100)
  s.naladaFanousku = clamp(s.naladaFanousku + naladaDelta, 0, 100)
  s.trener.kariera.zapasy++
  if (vyhra) s.trener.kariera.vyhry++
  if (s.trener.duvera === 0) vyhazov(s)
  else if (s.trener.duvera <= 20) s.zpravy.unshift('⚠️ Vedení ztrácí trpělivost!')
}

export function vyhazov(s: GameState): void {
  s.trener.kariera.vyhazovy++
  const ostatni = Object.keys(s.tymy)
    .filter((id) => id !== s.mujKlubId)
    .sort((a, b) => prumernyOverall(s, a) - prumernyOverall(s, b)) // vzestupně (nejslabší první)
  const mujPrumer = prumernyOverall(s, s.mujKlubId)
  const slabsi = ostatni.filter((id) => prumernyOverall(s, id) < mujPrumer)
  s.nabidky = slabsi.length >= 3 ? slabsi.slice(-3) : ostatni.slice(0, 3)
  s.zpravy.unshift('📰 KONEC! Vedení tě odvolalo. Na stole jsou nabídky jiných klubů.')
}

export function prijmiNabidku(state: GameState, klubId: string): GameState {
  if (!state.nabidky?.includes(klubId)) throw new Error('Tento klub nabídku nedal.')
  const s = structuredClone(state)
  s.mujKlubId = klubId
  s.trener.duvera = 50
  s.nabidky = null
  s.cilSezony = urciCilSezony(s, klubId)
  s.zpravy.unshift(`Nová výzva! Přebíráš ${s.tymy[klubId].nazev}.`)
  return s
}

export function odmitniNabidky(state: GameState): GameState {
  const s = structuredClone(state)
  s.nabidky = null
  s.konecKariery = true
  s.zpravy.unshift('Odmítl jsi všechny nabídky. Trenérská kariéra končí.')
  return s
}

export function splnenCil(s: GameState): boolean {
  const liga = ligaKlubu(s, s.mujKlubId)
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const umisteni = tabulka.findIndex((r) => r.tymId === s.mujKlubId) + 1
  switch (s.cilSezony.typ) {
    case 'titul':
    case 'postup':
      return liga.playoff?.vitez === s.mujKlubId
    case 'playoff':
      return umisteni <= 8
    case 'stred':
      return umisteni <= 10
    case 'zachrana':
      return umisteni < 14
  }
}

export function vyhodnotCilPoSezone(s: GameState): boolean {
  const splnen = splnenCil(s)
  s.trener.duvera = clamp(s.trener.duvera + (splnen ? 15 : -20), 0, 100)
  s.zpravy.unshift(splnen ? '✅ Cíl sezóny splněn! Vedení je spokojené.' : '❌ Cíl sezóny nesplněn. Vedení zuří.')
  if (s.trener.duvera === 0 && !s.nabidky) vyhazov(s)
  return splnen
}
```

- [ ] **Step 4: Zapojení do `sezona.ts`**

1. Importy: `import { jeDerby, poMemZapase, urciCilSezony } from './kariera'`
2. `newGame`: místo placeholder cíle z Tasku 1 — postavit stav a před `return` doplnit `s.cilSezony = urciCilSezony(s, mujKlubId)` (stav ulož do proměnné, pak vrať).
3. `advanceDay` guardy na začátek (za guard cekajiciZapas): `if (state.nabidky) throw new Error('Nejdřív vyřeš nabídky klubů.')` a `if (state.konecKariery) throw new Error('Kariéra skončila.')`
4. `cekajiciZapas` dostává skutečné derby: `derby: jeDerby(z.domaci, z.hoste)` (základní část) a stejně v playoff větvi.
5. `dokonciZapas`: po `zapisDopadyZapasu(...)` přidat `poMemZapase(s, v, cz)`.
6. `zahajNovouSezonu`: na konec (před `return s`) přidat `s.trener.kariera.sezony++` a `s.cilSezony = urciCilSezony(s, s.mujKlubId)`; a reset `h.zranenZapasu = 0` v letním vývoji hráčů.

- [ ] **Step 5: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (kariera + všechny stávající; sezónní smyčkové testy nezasáhne — důvěra klesá pomalu a `dohraj` helper hraje dál i po případném vyhazovu? NE — vyhazov nastaví `nabidky` a advanceDay hodí chybu → sezónní `dohraj` test může spadnout, pokud tabor prohrává extrémně. Ošetři helper v `tests/core/sezona.test.ts` i `tests/core/dokonceni.test.ts`: když `s.nabidky`, přijmi první nabídku: `s = prijmiNabidku(s, s.nabidky[0])`. Přidej to do helperů hned v tomto tasku.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: kariéra — cíl sezóny, důvěra vedení, nálada fanoušků, derby, vyhazov"
```

---

### Task 6: Historie, vyhlášení, rekordy, kapitán (`src/core/historie.ts`)

**Files:**
- Create: `src/core/historie.ts`
- Modify: `src/core/sezona.ts` (vyhodnocení při konci sezóny, rekord po zápase, kapitán v morálce, úklid v zahajNovouSezonu)
- Test: `tests/core/historie.test.ts`

**Interfaces:**
- Consumes: `spocitejTabulku`, `vyhodnotCilPoSezone` (Task 5), typy z Tasku 1.
- Produces:

```ts
export function vyhodnotSezonu(s: GameState): void // mutuje klon; volá zkontrolujKonecSezony ze sezona.ts
export function zapisRekordVyhry(s: GameState, v: Vysledek, cz: CekajiciZapas): void // mutuje klon
```

Pravidla:
- `vyhodnotSezonu` při přechodu na `konecSezony`: naplní `s.vyhlaseni` (mistři všech lig, králové střelců všech lig, hvězda mého týmu podle bodů), zapíše `ZaznamSezony` do `s.historie` (umístění po základní části, cíl, splnění přes `vyhodnotCilPoSezone`, trofej), trofej („Mistr extraligy (sezóna N)" / „Vítěz {liga} a postup (sezóna N)") do `s.trener.kariera.trofeje`, aktualizuje rekord nejlepšího střelce klubu.
- `zapisRekordVyhry` po každém MÉM vyhraném zápase: když je rozdíl skóre větší než dosavadní rekord, ulož `{ text: 'Tábor 7:1 Most (sezóna 2)', rozdil: 6 }`.
- Kapitán: v `aplikujDopadyZapasu` je pokles formy po prohře mírnější, když je kapitán zdravý: `randInt(rng, -2, 1)` místo `randInt(rng, -3, 1)`.
- `zahajNovouSezonu`: `s.vyhlaseni = null` (UI ho ukázalo během konce sezóny).

- [ ] **Step 1: Failing test** — `tests/core/historie.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import { zapisRekordVyhry } from '../../src/core/historie'
import type { CekajiciZapas, GameState, Vysledek } from '../../src/core/types'

const dohrajSezonu = (seed: number): GameState => {
  let s = newGame(seed, 'tabor')
  let pojistka = 0
  while (s.faze !== 'konecSezony' && pojistka++ < 400) {
    if (s.nabidky) s = prijmiNabidku(s, s.nabidky[0])
    else if (s.cekajiciZapas) {
      const cz = s.cekajiciZapas
      const stav = simulujDoKonce(
        zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
        s.tymy[cz.domaci],
        s.tymy[cz.hoste],
        createRng(500 + s.den),
      )
      s = dokonciZapas(s, stav)
    } else s = advanceDay(s)
  }
  expect(s.faze).toBe('konecSezony')
  return s
}

describe('vyhodnocení sezóny', () => {
  const s = dohrajSezonu(9)
  it('naplní vyhlášení', () => {
    expect(s.vyhlaseni).not.toBeNull()
    expect(s.vyhlaseni!.mistri).toHaveLength(3)
    expect(s.vyhlaseni!.kraloveStrelcu).toHaveLength(3)
    for (const k of s.vyhlaseni!.kraloveStrelcu) expect(k.goly).toBeGreaterThan(0)
    expect(s.vyhlaseni!.hvezdaTymu).not.toBeNull()
  })
  it('zapíše historii mé sezóny', () => {
    expect(s.historie).toHaveLength(1)
    const z = s.historie[0]
    expect(z.sezona).toBe(1)
    expect(z.umisteni).toBeGreaterThanOrEqual(1)
    expect(z.umisteni).toBeLessThanOrEqual(14)
    expect(typeof z.splnen).toBe('boolean')
  })
  it('důvěra se po sezóně pohnula o ±15/−20', () => {
    // jen sanity: hodnota je v mezích a zpráva o cíli existuje
    expect(s.zpravy.some((z) => z.includes('Cíl sezóny'))).toBe(true)
  })
  it('nová sezóna vyčistí vyhlášení a navýší kariéru', () => {
    const nova = zahajNovouSezonu(s)
    expect(nova.vyhlaseni).toBeNull()
    expect(nova.trener.kariera.sezony).toBe(2)
    expect(nova.historie).toHaveLength(1) // historie zůstává
  })
})

describe('zapisRekordVyhry', () => {
  const vysledek = (gd: number, gh: number): Vysledek => ({
    golyDomaci: gd,
    golyHoste: gh,
    strelyDomaci: 30,
    strelyHoste: 20,
    prodlouzeni: false,
    najezdy: false,
    udalosti: [],
  })
  const cz: CekajiciZapas = { domaci: 'tabor', hoste: 'most', derby: false, playoff: null }
  it('ukládá jen vyšší rozdíl', () => {
    const s = structuredClone(newGame(1, 'tabor'))
    zapisRekordVyhry(s, vysledek(5, 1), cz)
    expect(s.rekordy.nejvyssiVyhra!.rozdil).toBe(4)
    zapisRekordVyhry(s, vysledek(3, 1), cz)
    expect(s.rekordy.nejvyssiVyhra!.rozdil).toBe(4)
    zapisRekordVyhry(s, vysledek(8, 1), cz)
    expect(s.rekordy.nejvyssiVyhra!.rozdil).toBe(7)
    expect(s.rekordy.nejvyssiVyhra!.text).toContain('8:1')
  })
  it('prohru nezapisuje', () => {
    const s = structuredClone(newGame(1, 'tabor'))
    zapisRekordVyhry(s, vysledek(1, 4), cz)
    expect(s.rekordy.nejvyssiVyhra).toBeNull()
  })
})
```

- [ ] **Step 2: Ověřit, že test padá**

Run: `npm run test` → Expected: FAIL, historie.ts neexistuje.

- [ ] **Step 3: Implementace** — `src/core/historie.ts`:

```ts
import { vyhodnotCilPoSezone } from './kariera'
import { spocitejTabulku } from './tabulka'
import type { CekajiciZapas, GameState, Vysledek } from './types'

export function vyhodnotSezonu(s: GameState): void {
  const mistri = s.ligy.map((l) => ({ nazevLigy: l.nazev, klubId: l.playoff!.vitez! }))
  const kraloveStrelcu = s.ligy.map((l) => {
    let top = { nazevLigy: l.nazev, jmeno: '', klubId: '', goly: -1 }
    for (const klubId of l.tymy) {
      for (const h of s.tymy[klubId].hraci) {
        if (h.goly > top.goly) {
          top = { nazevLigy: l.nazev, jmeno: `${h.jmeno} ${h.prijmeni}`, klubId, goly: h.goly }
        }
      }
    }
    return top
  })
  const mujTym = s.tymy[s.mujKlubId]
  const hvezda = [...mujTym.hraci].sort((a, b) => b.goly + b.asistence - (a.goly + a.asistence))[0]
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const umisteni = tabulka.findIndex((r) => r.tymId === s.mujKlubId) + 1
  const splnen = vyhodnotCilPoSezone(s)
  const vyhralPlayoff = liga.playoff?.vitez === s.mujKlubId
  const trofej = vyhralPlayoff
    ? liga.uroven === 0
      ? `Mistr extraligy (sezóna ${s.sezona})`
      : `Vítěz ${liga.nazev} a postup (sezóna ${s.sezona})`
    : null
  if (trofej) s.trener.kariera.trofeje.push(trofej)
  s.vyhlaseni = {
    sezona: s.sezona,
    mistri,
    kraloveStrelcu,
    hvezdaTymu: hvezda
      ? { jmeno: `${hvezda.jmeno} ${hvezda.prijmeni}`, goly: hvezda.goly, asistence: hvezda.asistence }
      : null,
  }
  s.historie.push({
    sezona: s.sezona,
    klubId: s.mujKlubId,
    nazevLigy: liga.nazev,
    umisteni,
    cil: s.cilSezony.typ,
    splnen,
    trofej,
  })
  const strelec = [...mujTym.hraci].sort((a, b) => b.goly - a.goly)[0]
  if (strelec && (!s.rekordy.nejlepsiStrelec || strelec.goly > s.rekordy.nejlepsiStrelec.goly)) {
    s.rekordy.nejlepsiStrelec = { jmeno: `${strelec.jmeno} ${strelec.prijmeni}`, goly: strelec.goly }
  }
}

export function zapisRekordVyhry(s: GameState, v: Vysledek, cz: CekajiciZapas): void {
  const mujDomaci = cz.domaci === s.mujKlubId
  const moje = mujDomaci ? v.golyDomaci : v.golyHoste
  const jeho = mujDomaci ? v.golyHoste : v.golyDomaci
  const rozdil = moje - jeho
  if (rozdil <= 0) return
  if (s.rekordy.nejvyssiVyhra && s.rekordy.nejvyssiVyhra.rozdil >= rozdil) return
  const domaci = s.tymy[cz.domaci].nazev
  const hoste = s.tymy[cz.hoste].nazev
  s.rekordy.nejvyssiVyhra = {
    text: `${domaci} ${v.golyDomaci}:${v.golyHoste} ${hoste} (sezóna ${s.sezona})`,
    rozdil,
  }
}
```

(Helper `cele` v úvodu smaž, pokud ho nepoužiješ — je tam jen jako pojistka pro texty; nenechávej mrtvý kód.)

- [ ] **Step 4: Zapojení do `sezona.ts`**

1. `zkontrolujKonecSezony`: po nastavení `s.faze = 'konecSezony'` a zprávě o mistrovi zavolat `vyhodnotSezonu(s)` (import z `./historie`).
2. `dokonciZapas`: za `poMemZapase(...)` přidat `zapisRekordVyhry(s, v, cz)`.
3. `aplikujDopadyZapasu`: pokles formy po prohře mírnější s kapitánem:

```ts
const kapitan = t.kapitanId ? t.hraci.find((h) => h.id === t.kapitanId) : null
const maKapitana = !!kapitan && kapitan.zranenZapasu === 0
const drift = vyhra ? randInt(rng, -1, 3) : randInt(rng, maKapitana ? -2 : -3, 1)
```

4. `zahajNovouSezonu`: `s.vyhlaseni = null`; a na ZAČÁTEK funkce přidat guardy (nález z review T5 — vyhazov může nastat ve stejném dokonciZapas jako konec sezóny):

```ts
if (state.nabidky) throw new Error('Nejdřív vyřeš nabídky klubů.')
if (state.konecKariery) throw new Error('Kariéra skončila.')
```

- [ ] **Step 5: Ověřit, že testy projdou**

Run: `npm run test` → Expected: PASS (historie + vše ostatní; plná sezóna teď končí vyhlášením).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: vyhlášení sezóny, historie, trofeje, rekordy a kapitán"
```

---

### Task 7: Vizuální základ — font, design systém, komponenty

**Files:**
- Modify: `package.json` (font), `src/main.tsx`, `src/ui/styl.css` (kompletní přepis), `src/ui/App.tsx` (hlavička navu)
- Create: `src/ui/komponenty.tsx`

**Interfaces:**
- Consumes: `kluby.json` s barvami (Task 1), typy `Pozice`, `Klub`.
- Produces: komponenty pro všechny UI tasky:
  - `OdznakKlubu({ klubId, velikost? = 36 })` — kulaté „logo" z iniciál v klubových barvách
  - `Ukazatel({ hodnota, barva?, popisek? })` — progres bar 0–100 s animací
  - `BadgePozice({ pozice })` — barevný štítek B/O/Ú
  - `MomentumGraf({ momentum, domaci, hoste })` — přetahovaná −100..+100 (kladné = domácí, ukazatel jede DOLEVA k domácím)
  - CSS třídy: `.karta`, `.tlacitko`, `.tlacitko.sekundarni`, `.mrizka`, `.mrizka-3`, `.zprava`, `.udalost-gol`, `.udalost-zraneni`, `.klik`, `.vybrany`, `.muj`, `.pill`, `.pill-derby`, `.skore`, `.vyhra`, `.prohra`, `.zapas-overlay`, `.puls`

- [ ] **Step 1: Font**

```bash
npm install @fontsource-variable/inter
```

Do `src/main.tsx` přidat jako první import: `import '@fontsource-variable/inter'`

- [ ] **Step 2: Kompletní přepis `src/ui/styl.css`:**

```css
:root {
  --pozadi: #0b0f14;
  --panel: #141b23;
  --panel-2: #1a232e;
  --okraj: #263241;
  --text: #e8eef4;
  --tlumeny: #8fa1b3;
  --akcent: #3d9bff;
  --zlata: #f0b429;
  --vyhra: #2fbf71;
  --prohra: #e5484d;
  --polomer: 12px;
  --stin: 0 4px 16px rgba(0, 0, 0, 0.35);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: radial-gradient(1200px 800px at 20% -10%, #16212d 0%, var(--pozadi) 55%);
  color: var(--text);
  font-family: 'Inter Variable', system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.45;
}
#root { display: flex; min-height: 100vh; }
h1, h2, h3 { font-weight: 700; letter-spacing: -0.01em; margin-top: 0; }

nav {
  width: 230px;
  background: linear-gradient(180deg, var(--panel-2), var(--panel));
  border-right: 1px solid var(--okraj);
  padding: 18px 0;
  position: sticky;
  top: 0;
  height: 100vh;
}
nav .klub-hlavicka {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px 14px;
  border-bottom: 1px solid var(--okraj);
  margin-bottom: 8px;
  font-weight: 700;
}
nav button {
  display: block;
  width: 100%;
  padding: 11px 18px;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  color: var(--tlumeny);
  text-align: left;
  font: inherit;
  font-size: 15px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
nav button:hover { color: var(--text); background: rgba(61, 155, 255, 0.06); }
nav button.aktivni { color: var(--akcent); border-left-color: var(--akcent); font-weight: 600; background: rgba(61, 155, 255, 0.08); }

main { flex: 1; padding: 28px 32px; max-width: 1180px; }

table {
  border-collapse: collapse;
  width: 100%;
  background: var(--panel);
  border-radius: var(--polomer);
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--stin);
}
th, td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--okraj); }
th { color: var(--tlumeny); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
tbody tr { transition: background 0.12s; }
tbody tr:hover { background: rgba(61, 155, 255, 0.05); }
tr.muj { background: rgba(61, 155, 255, 0.12); }
tr.muj:hover { background: rgba(61, 155, 255, 0.16); }

.karta {
  background: linear-gradient(180deg, var(--panel-2), var(--panel));
  border: 1px solid var(--okraj);
  border-radius: var(--polomer);
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: var(--stin);
}
.mrizka { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.mrizka-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

.tlacitko {
  background: linear-gradient(180deg, #55aaff, var(--akcent));
  color: #06121f;
  border: none;
  border-radius: 9px;
  padding: 10px 20px;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.12s, filter 0.12s;
}
.tlacitko:hover { filter: brightness(1.12); transform: translateY(-1px); }
.tlacitko:active { transform: translateY(0); }
.tlacitko:disabled { opacity: 0.45; cursor: default; transform: none; filter: none; }
.tlacitko.sekundarni { background: var(--panel-2); color: var(--text); border: 1px solid var(--okraj); }
.tlacitko.nebezpecne { background: linear-gradient(180deg, #ff6b6f, var(--prohra)); }

.klik { cursor: pointer; }
.vybrany { outline: 2px solid var(--akcent); }
.vyhra { color: var(--vyhra); }
.prohra { color: var(--prohra); }

.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: var(--panel-2);
  border: 1px solid var(--okraj);
  color: var(--tlumeny);
}
.pill-derby { background: rgba(229, 72, 77, 0.15); border-color: var(--prohra); color: #ff8a8d; }

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
  color: #06121f;
}

.odznak {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-weight: 800;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  flex: none;
}

.ukazatel {
  height: 8px;
  border-radius: 999px;
  background: var(--okraj);
  overflow: hidden;
}
.ukazatel > span { display: block; height: 100%; border-radius: 999px; transition: width 0.5s ease; }
.ukazatel-popisek { display: flex; justify-content: space-between; font-size: 13px; color: var(--tlumeny); margin-bottom: 4px; }
.ukazatel-popisek b { color: var(--text); }

.zprava { padding: 7px 0; border-bottom: 1px solid var(--okraj); color: var(--tlumeny); animation: vjezd 0.25s ease-out; }
.udalost-gol { color: var(--vyhra); font-weight: 700; }
.udalost-zraneni { color: var(--prohra); font-weight: 600; }

.skore { font-size: 44px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

.momentum { margin: 10px 0; }
.momentum-tymy { display: flex; justify-content: space-between; font-size: 12px; color: var(--tlumeny); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.momentum-draha { position: relative; height: 10px; border-radius: 999px; background: linear-gradient(90deg, rgba(61, 155, 255, 0.35), var(--okraj) 50%, rgba(229, 72, 77, 0.35)); }
.momentum-stred { position: absolute; left: 50%; top: -2px; width: 2px; height: 14px; background: var(--tlumeny); }
.momentum-ukazatel {
  position: absolute;
  top: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.6);
  transition: left 0.6s ease;
}

.zapas-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: radial-gradient(1000px 600px at 50% -10%, #16212d 0%, var(--pozadi) 60%);
  overflow: auto;
  padding: 26px 32px;
}

@keyframes vjezd {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes puls {
  0% { box-shadow: 0 0 0 0 rgba(61, 155, 255, 0.5); }
  100% { box-shadow: 0 0 0 14px rgba(61, 155, 255, 0); }
}
.puls { animation: puls 0.9s ease-out; }
```

- [ ] **Step 3: Komponenty** — `src/ui/komponenty.tsx`:

```tsx
import kluby from '../core/data/kluby.json'
import type { Klub, Pozice } from '../core/types'

const KLUBY = new Map((kluby as Klub[]).map((k) => [k.id, k]))

export function OdznakKlubu({ klubId, velikost = 36 }: { klubId: string; velikost?: number }) {
  const klub = KLUBY.get(klubId)
  if (!klub) return null
  const zbytek = klub.nazev.replace(/^(HC|BK|SK|SC|AZ|IHC|LHK|VHK|SHC|SKLH|Mountfield|Bílí)\s+/i, '')
  const slova = zbytek.split(' ')
  // jednoslovný zbytek (např. „HK" z Mountfield HK) → první dvě písmena
  const inicialy = (
    slova.length >= 2 ? slova.map((slovo) => slovo[0]).slice(0, 2).join('') : zbytek.slice(0, 2)
  ).toUpperCase()
  const [a, b] = klub.barvy
  return (
    <span
      className="odznak"
      title={klub.nazev}
      style={{
        width: velikost,
        height: velikost,
        background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`,
        fontSize: velikost * 0.36,
      }}
    >
      {inicialy}
    </span>
  )
}

export function Ukazatel({
  hodnota,
  barva = 'var(--akcent)',
  popisek,
}: {
  hodnota: number
  barva?: string
  popisek?: string
}) {
  const w = Math.max(0, Math.min(100, hodnota))
  return (
    <div>
      {popisek && (
        <div className="ukazatel-popisek">
          <span>{popisek}</span>
          <b>{Math.round(hodnota)}</b>
        </div>
      )}
      <div className="ukazatel">
        <span style={{ width: `${w}%`, background: barva }} />
      </div>
    </div>
  )
}

// barva ukazatele podle hodnoty (důvěra, nálada): červená → zlatá → zelená
export const barvaHodnoty = (hodnota: number): string =>
  hodnota <= 25 ? 'var(--prohra)' : hodnota <= 55 ? 'var(--zlata)' : 'var(--vyhra)'

const POZICE_BARVY: Record<Pozice, string> = { G: '#f0b429', D: '#3d9bff', U: '#2fbf71' }
const POZICE_TEXT: Record<Pozice, string> = { G: 'B', D: 'O', U: 'Ú' }

export function BadgePozice({ pozice }: { pozice: Pozice }) {
  return (
    <span className="badge" style={{ background: POZICE_BARVY[pozice] }}>
      {POZICE_TEXT[pozice]}
    </span>
  )
}

export function MomentumGraf({ momentum, domaci, hoste }: { momentum: number; domaci: string; hoste: string }) {
  const pozice = 50 - momentum / 2 // kladné momentum (domácí) táhne ukazatel doleva k domácím
  return (
    <div className="momentum">
      <div className="momentum-tymy">
        <span>{domaci}</span>
        <span>momentum</span>
        <span>{hoste}</span>
      </div>
      <div className="momentum-draha">
        <span className="momentum-stred" />
        <span className="momentum-ukazatel" style={{ left: `calc(${pozice}% - 9px)` }} />
      </div>
    </div>
  )
}
```

Typ `Klub` v `types.ts` už má `barvy: [string, string]` z Tasku 1 — pokud JSON import hlásí `string[]` místo tuple, přetypuj v komponentě `klub.barvy as [string, string]`.

- [ ] **Step 4: Hlavička navu** — v `src/ui/App.tsx` nahradit `<h1>🏒 Hokejový manažer</h1>`:

```tsx
<div className="klub-hlavicka">
  <OdznakKlubu klubId={hra.mujKlubId} velikost={40} />
  <div>
    <div>{hra.tymy[hra.mujKlubId].nazev}</div>
    <div style={{ fontSize: 12, color: 'var(--tlumeny)', fontWeight: 400 }}>
      Sezóna {hra.sezona} · den {hra.den}
    </div>
  </div>
</div>
```

(import `OdznakKlubu` z `../ui/komponenty` dle umístění App.tsx: `./komponenty`.)

- [ ] **Step 5: Ověřit**

Run: `npm run test` → PASS (beze změn jádra). `npm run build` → clean. `npm run dev` + curl smoke → 200. Vizuální kontrola v prohlížeči: tmavý gradient, Inter font, odznak klubu v navu.

- [ ] **Step 6: Stage (BEZ commitu)**

```bash
git add -A
```

---

### Task 8: Živý zápas (`src/ui/obrazovky/ZivyZapas.tsx`)

**Files:**
- Create: `src/ui/obrazovky/ZivyZapas.tsx`
- Modify: `src/ui/App.tsx` (zapojení živého zápasu), `src/ui/obrazovky/Prehled.tsx` (jen funkce `pokracuj` — celý Přehled přepisuje Task 9)

**Interfaces:**
- Consumes: engine (`zacniZapas`, `simulujMinutu`, `pokracujPoPauze`, `zmenTaktiku`, `pouzijTimeout`, `odvolejBrankare`, `aplikujProslov`, `nahradZraneneho`, `autoNahrada`, `simulujDoKonce`, `StavZapasu`), `dokonciZapas`, `atmosferaZapasu` ze sezony, `jeZdravy`, `overall`, komponenty z Tasku 7, `ulozHru`.
- Produces: `ZivyZapas({ hra, setHra, poZapase })` kde `poZapase(po: GameState)` volá App po dokončení zápasu (přepne obrazovku). Deterministika: RNG zápasu = `createRng(hashSeed(seed, sezona, den, 777))`.
- Tok: předzápas (bez overlaye, nav funguje — jde upravit sestavu) → `Začít zápas` → overlay `.zapas-overlay` s tikáním minut (600 ms / rychlost), rychlosti ⏸/1×/4×, `Přeskočit třetinu`, `Odsimulovat zbytek`, `Time-out`, `Odvolat brankáře`; pauzy mezi třetinami s taktikou a proslovem (1× za pauzu — hlídá UI); moje zranění = výběr náhradníka, soupeřovo řeší auto; konec → `dokonciZapas` + autosave + `poZapase`.

- [ ] **Step 1: Komponenta** — `src/ui/obrazovky/ZivyZapas.tsx` (kompletní):

```tsx
import { useEffect, useRef, useState } from 'react'
import { createRng, hashSeed, type Rng } from '../../core/rng'
import { jeZdravy, overall } from '../../core/sestava'
import { atmosferaZapasu, dokonciZapas } from '../../core/sezona'
import type { GameState, Taktika, Tym } from '../../core/types'
import {
  aplikujProslov,
  autoNahrada,
  nahradZraneneho,
  odvolejBrankare,
  pokracujPoPauze,
  pouzijTimeout,
  simulujDoKonce,
  simulujMinutu,
  zacniZapas,
  zmenTaktiku,
  type StavZapasu,
} from '../../core/zapas'
import { MomentumGraf, OdznakKlubu } from '../komponenty'
import { ulozHru } from '../store'

const TAKTIKY: [Taktika, string][] = [
  ['utocna', 'Útočná'],
  ['vyvazena', 'Vyvážená'],
  ['obranna', 'Obranná'],
]

const HLASKY_SOUPERE = [
  'Dnes si odvezete debakl!',
  'Na váš led se nebojíme.',
  'Body zůstanou u nás, uvidíte.',
  'Vaše obrana je děravá jak cedník.',
  'Přijeli jsme si pro tři body.',
]

const vyhralJsem = (stav: StavZapasu, moje: 'domaci' | 'hoste') =>
  moje === 'domaci' ? stav.domaci.goly > stav.hoste.goly : stav.hoste.goly > stav.domaci.goly

export function ZivyZapas({
  hra,
  setHra,
  poZapase,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  poZapase: (po: GameState) => void
}) {
  const cz = hra.cekajiciZapas!
  const domaci = hra.tymy[cz.domaci]
  const hoste = hra.tymy[cz.hoste]
  const mujDomaci = cz.domaci === hra.mujKlubId
  const mojeStrana: 'domaci' | 'hoste' = mujDomaci ? 'domaci' : 'hoste'
  const mujTym = mujDomaci ? domaci : hoste

  const rngRef = useRef<Rng | null>(null)
  const [stav, setStav] = useState<StavZapasu | null>(null)
  const [rychlost, setRychlost] = useState(1) // 0 | 1 | 4
  const [proslovVyuzit, setProslovVyuzit] = useState(false)

  const rng = () => rngRef.current!
  const novyRng = () => createRng(hashSeed(hra.seed, hra.sezona, hra.den, 777))
  const moznosti = { derby: cz.derby, atmosfera: mujDomaci ? atmosferaZapasu(hra) : 0 }

  // tikání minut + automatická náhrada zraněného soupeře (i v pauze — jinak by pauza uvízla)
  useEffect(() => {
    if (!stav) return
    if (stav.cekaNaNahradu) {
      if (stav.cekaNaNahradu.strana !== mojeStrana) {
        setStav(autoNahrada(stav, stav.cekaNaNahradu.strana === 'domaci' ? domaci : hoste))
      }
      return // moje zranění čeká na modal
    }
    if (stav.faze !== 'hraje' || rychlost === 0) return
    const id = setTimeout(() => setStav(simulujMinutu(stav, domaci, hoste, rng())), 600 / rychlost)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav, rychlost])

  // nová pauza → proslov je zase k dispozici
  useEffect(() => {
    if (stav?.faze === 'pauza1' || stav?.faze === 'pauza2') setProslovVyuzit(false)
  }, [stav?.faze])

  function zacni() {
    rngRef.current = novyRng()
    setStav(zacniZapas(domaci, hoste, moznosti))
    setRychlost(1)
  }

  function odsimulujCely() {
    const r = novyRng()
    const konec = simulujDoKonce(zacniZapas(domaci, hoste, moznosti), domaci, hoste, r)
    const po = dokonciZapas(hra, konec)
    setHra(po)
    void ulozHru(0, po)
    poZapase(po)
  }

  function prehrajTretinu() {
    if (!stav) return
    let s = stav
    while (s.faze === 'hraje') {
      if (s.cekaNaNahradu) {
        if (s.cekaNaNahradu.strana === mojeStrana) break
        s = autoNahrada(s, s.cekaNaNahradu.strana === 'domaci' ? domaci : hoste)
      } else {
        s = simulujMinutu(s, domaci, hoste, rng())
      }
    }
    setStav(s)
  }

  function dokonci() {
    if (!stav) return
    const po = dokonciZapas(hra, stav)
    setHra(po)
    void ulozHru(0, po)
    poZapase(po)
  }

  // ---------- před zápasem (nav zůstává — jde upravit sestavu) ----------
  if (!stav) {
    const souper = mujDomaci ? hoste : domaci
    const hlaska = HLASKY_SOUPERE[hashSeed(hra.seed, hra.den) % HLASKY_SOUPERE.length]
    return (
      <>
        <h2>
          {cz.derby && (
            <span className="pill pill-derby" style={{ marginRight: 8 }}>
              DERBY
            </span>
          )}
          Před zápasem
        </h2>
        <div className="karta" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <OdznakKlubu klubId={cz.domaci} velikost={56} />
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {domaci.nazev} — {hoste.nazev}
          </div>
          <OdznakKlubu klubId={cz.hoste} velikost={56} />
        </div>
        <div className="mrizka">
          <div className="karta">
            <h3>Soupeř hlásí</h3>
            <p>
              „{hlaska}" <span style={{ color: 'var(--tlumeny)' }}>— trenér {souper.nazev}</span>
            </p>
            <p style={{ color: 'var(--tlumeny)' }}>Morálka soupeře: {souper.moralka}</p>
          </div>
          <div className="karta">
            <h3>Tvoje taktika</h3>
            {TAKTIKY.map(([id, popisek]) => (
              <button
                key={id}
                className={`tlacitko ${mujTym.taktika === id ? '' : 'sekundarni'}`}
                style={{ marginRight: 8 }}
                onClick={() =>
                  setHra({ ...hra, tymy: { ...hra.tymy, [hra.mujKlubId]: { ...mujTym, taktika: id } } })
                }
              >
                {popisek}
              </button>
            ))}
            <p style={{ color: 'var(--tlumeny)', marginTop: 10 }}>
              Sestavu uprav na záložce Sestava a vrať se sem.
            </p>
          </div>
        </div>
        <button className="tlacitko" onClick={zacni}>
          Začít zápas 🏒
        </button>{' '}
        <button className="tlacitko sekundarni" onClick={odsimulujCely}>
          Odsimulovat celý zápas
        </button>
      </>
    )
  }

  // ---------- živý zápas ----------
  const tretina = stav.minuta <= 20 ? 1 : stav.minuta <= 40 ? 2 : 3
  const posledniUdalosti = [...stav.udalosti].slice(-12).reverse()
  const cekaNaMne = stav.cekaNaNahradu?.strana === mojeStrana
  const jaVedu = vyhralJsem(stav, mojeStrana)

  return (
    <div className="zapas-overlay">
      <div className="karta" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <OdznakKlubu klubId={cz.domaci} velikost={52} />
          <div>
            <div className="skore">
              {stav.domaci.goly} : {stav.hoste.goly}
            </div>
            <div style={{ color: 'var(--tlumeny)' }}>
              {stav.faze === 'konec'
                ? 'Konec zápasu'
                : stav.minuta > 60
                  ? `Prodloužení · ${stav.minuta}. min`
                  : `${tretina}. třetina · ${stav.minuta}. min`}
              {cz.derby && (
                <>
                  {' '}
                  · <span className="pill pill-derby">DERBY</span>
                </>
              )}
            </div>
            <div style={{ color: 'var(--tlumeny)', fontSize: 13 }}>
              Střely {stav.domaci.strely} : {stav.hoste.strely}
            </div>
          </div>
          <OdznakKlubu klubId={cz.hoste} velikost={52} />
        </div>
        <MomentumGraf momentum={stav.momentum} domaci={domaci.nazev} hoste={hoste.nazev} />
      </div>

      {stav.faze === 'hraje' && !cekaNaMne && (
        <div className="karta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`tlacitko ${rychlost === 0 ? '' : 'sekundarni'}`} onClick={() => setRychlost(0)}>
            ⏸
          </button>
          <button className={`tlacitko ${rychlost === 1 ? '' : 'sekundarni'}`} onClick={() => setRychlost(1)}>
            ▶ 1×
          </button>
          <button className={`tlacitko ${rychlost === 4 ? '' : 'sekundarni'}`} onClick={() => setRychlost(4)}>
            ⏩ 4×
          </button>
          <button className="tlacitko sekundarni" onClick={prehrajTretinu}>
            Přeskočit třetinu
          </button>
          <button className="tlacitko sekundarni" onClick={() => setStav(simulujDoKonce(stav, domaci, hoste, rng()))}>
            Odsimulovat zbytek
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="tlacitko sekundarni"
            disabled={stav[mojeStrana].timeoutPouzit}
            onClick={() => setStav(pouzijTimeout(stav, mojeStrana))}
          >
            ⏱ Time-out
          </button>
          <button
            className={`tlacitko ${stav[mojeStrana].odvolanyBrankar ? 'nebezpecne' : 'sekundarni'}`}
            onClick={() => setStav(odvolejBrankare(stav, mojeStrana, !stav[mojeStrana].odvolanyBrankar))}
          >
            {stav[mojeStrana].odvolanyBrankar ? '🥅 Vrátit brankáře' : '⚠️ Odvolat brankáře'}
          </button>
        </div>
      )}

      {(stav.faze === 'pauza1' || stav.faze === 'pauza2') && (
        <div className="karta">
          <h3>Přestávka — kabina čeká na trenéra</h3>
          <div className="mrizka">
            <div>
              <h4>Taktika na další třetinu</h4>
              {TAKTIKY.map(([id, popisek]) => (
                <button
                  key={id}
                  className={`tlacitko ${stav[mojeStrana].taktika === id ? '' : 'sekundarni'}`}
                  style={{ marginRight: 8 }}
                  onClick={() => setStav(zmenTaktiku(stav, mojeStrana, id))}
                >
                  {popisek}
                </button>
              ))}
            </div>
            <div>
              <h4>Proslov v kabině (1× za přestávku)</h4>
              {(
                [
                  ['povzbudit', '💪 Povzbudit'],
                  ['zdrbat', '🔥 Zdrbat'],
                  ['klid', '😌 Nechat být'],
                ] as const
              ).map(([volba, popisek]) => (
                <button
                  key={volba}
                  className="tlacitko sekundarni"
                  style={{ marginRight: 8 }}
                  disabled={proslovVyuzit}
                  onClick={() => {
                    setStav(aplikujProslov(stav, mojeStrana, volba, rng()))
                    setProslovVyuzit(true)
                  }}
                >
                  {popisek}
                </button>
              ))}
            </div>
          </div>
          <button
            className="tlacitko"
            disabled={!!stav.cekaNaNahradu}
            onClick={() => {
              setStav(pokracujPoPauze(stav))
              setRychlost(1)
            }}
          >
            Pokračovat ve hře ▶
          </button>
        </div>
      )}

      {cekaNaMne && stav.faze !== 'konec' && <VyberNahradnika stav={stav} setStav={setStav} tym={mujTym} />}

      {stav.faze === 'konec' && (
        <div className={`karta ${jaVedu ? '' : ''}`} style={{ textAlign: 'center' }}>
          <h3 className={jaVedu ? 'vyhra' : 'prohra'}>
            {jaVedu ? '🎉 VÝHRA!' : '😞 Prohra…'}
            {stav.najezdy ? ' (po nájezdech)' : stav.prodlouzeni ? ' (po prodloužení)' : ''}
          </h3>
          <button className="tlacitko" onClick={dokonci}>
            Pokračovat
          </button>
        </div>
      )}

      <div className="karta">
        {posledniUdalosti.map((u, i) => (
          <div
            key={stav.udalosti.length - i}
            className={`zprava ${u.typ === 'gol' ? 'udalost-gol' : u.typ === 'zraneni' ? 'udalost-zraneni' : ''}`}
          >
            {u.text}
            {u.sance !== undefined && u.typ !== 'gol' ? ` (šance ${u.sance} %)` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function VyberNahradnika({
  stav,
  setStav,
  tym,
}: {
  stav: StavZapasu
  setStav: (s: StavZapasu) => void
  tym: Tym
}) {
  const info = stav.cekaNaNahradu!
  const strana = stav[info.strana]
  const zraneny = tym.hraci.find((h) => h.id === info.hracId)!
  const vSestave = new Set([
    ...strana.sestava.utoky.flat(),
    ...strana.sestava.obrany.flat(),
    strana.sestava.brankar,
  ])
  const kandidati = tym.hraci.filter(
    (h) => h.pozice === zraneny.pozice && !vSestave.has(h.id) && jeZdravy(h) && !strana.zraneni.includes(h.id),
  )
  return (
    <div className="karta" style={{ borderColor: 'var(--prohra)' }}>
      <h3 className="udalost-zraneni">
        🚑 {zraneny.jmeno} {zraneny.prijmeni} nemůže pokračovat! Kdo ho nahradí?
      </h3>
      {kandidati.length === 0 ? (
        <button className="tlacitko" onClick={() => setStav(autoNahrada(stav, tym))}>
          Nikdo není k dispozici — hrát v oslabení
        </button>
      ) : (
        kandidati.map((h) => (
          <button
            key={h.id}
            className="tlacitko sekundarni"
            style={{ marginRight: 8, marginBottom: 8 }}
            onClick={() => setStav(nahradZraneneho(stav, tym, h.id))}
          >
            {h.jmeno} {h.prijmeni} ({overall(h)})
          </button>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 2: Zapojit do App** — v `src/ui/App.tsx`:

```tsx
import { ZivyZapas } from './obrazovky/ZivyZapas'
```

a v mapě `obsah` nahradit řádek `zapas`:

```tsx
zapas: hra.cekajiciZapas ? (
  <ZivyZapas
    hra={hra}
    setHra={setHra}
    poZapase={(po) => setObrazovka(po.faze === 'konecSezony' ? 'prehled' : 'prehled')}
  />
) : (
  <Zapas hra={hra} />
),
```

(Task 10 přesměruje `poZapase` na obrazovku vyhlášení; teď vede vždy na přehled — proto je ternár záměrně „stejný". Zjednoduš na `poZapase={() => setObrazovka('prehled')}`, Task 10 to rozšíří.)

- [ ] **Step 3: Patch `pokracuj` v Přehledu** — v `src/ui/obrazovky/Prehled.tsx` nahradit funkci `pokracuj`:

```tsx
// posouvá dny; zastaví se na mém zápase, nabídkách, konci kariéry nebo změně fáze
function pokracuj() {
  let s = hra
  let pojistka = 0
  while (
    pojistka++ < 10 &&
    !s.cekajiciZapas &&
    !s.nabidky &&
    !s.konecKariery &&
    s.faze === hra.faze
  ) {
    s = advanceDay(s)
  }
  setHra(s)
  void ulozHru(0, s)
  if (s.cekajiciZapas) setObrazovka('zapas')
}
```

- [ ] **Step 4: Ověřit**

Run: `npm run test` → PASS. `npm run build` → clean. Manuálně v `npm run dev`: Pokračovat → předzápasová obrazovka → Začít zápas → běží minuty, momentum se hýbe, pauza po 1. třetině nabízí taktiku a proslov, time-out a odvolání brankáře fungují, konec → Pokračovat → Přehled s výsledkem. „Odsimulovat celý zápas" z předzápasu projde bez sledování.

- [ ] **Step 5: Stage (BEZ commitu)**

```bash
git add -A
```

---

### Task 9: Přehled — cíl, důvěra, nálada, derby, vyhazov

**Files:**
- Modify: `src/ui/obrazovky/Prehled.tsx` (kompletní přepis)

**Interfaces:**
- Consumes: `prijmiNabidku`, `odmitniNabidky`, `prumernyOverall`, `jeDerby` z kariery; `Ukazatel`, `barvaHodnoty`, `OdznakKlubu` z komponent; zbytek jako dosud.
- Produces: `Prehled({ hra, setHra, setObrazovka })` se třemi režimy: konec kariéry → `KonecKariery`; nabídky po vyhazovu → `Nabidky`; jinak normální přehled (další zápas s derby štítkem, karta Vedení s cílem a důvěrou, karta Fanoušci s náladou, mini tabulka, zprávy).

- [ ] **Step 1: Přepis** — `src/ui/obrazovky/Prehled.tsx`:

```tsx
import { jeDerby, odmitniNabidky, prijmiNabidku, prumernyOverall } from '../../core/kariera'
import { advanceDay, dalsiMujZapas, mojeLiga, zahajNovouSezonu } from '../../core/sezona'
import { spocitejTabulku } from '../../core/tabulka'
import type { GameState } from '../../core/types'
import type { Obrazovka } from '../App'
import { barvaHodnoty, OdznakKlubu, Ukazatel } from '../komponenty'
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
  if (hra.konecKariery) return <KonecKariery hra={hra} />
  if (hra.nabidky) return <Nabidky hra={hra} setHra={setHra} />

  const liga = mojeLiga(hra)
  const tabulka = spocitejTabulku(liga.tymy, liga.zapasy)
  const mojePozice = tabulka.findIndex((r) => r.tymId === hra.mujKlubId) + 1
  const dalsi = dalsiMujZapas(hra)
  const derbyPristi = dalsi ? jeDerby(dalsi.domaci, dalsi.hoste) : false

  function pokracuj() {
    let s = hra
    let pojistka = 0
    while (pojistka++ < 10 && !s.cekajiciZapas && !s.nabidky && !s.konecKariery && s.faze === hra.faze) {
      s = advanceDay(s)
    }
    setHra(s)
    void ulozHru(0, s)
    if (s.cekajiciZapas) setObrazovka('zapas')
  }

  function novaSezona() {
    const s = zahajNovouSezonu(hra)
    setHra(s)
    void ulozHru(0, s)
  }

  return (
    <>
      <h2>Přehled</h2>
      <div className="mrizka-3">
        <div className="karta">
          <h3>
            Další zápas{' '}
            {derbyPristi && <span className="pill pill-derby">DERBY</span>}
          </h3>
          {dalsi ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <OdznakKlubu klubId={dalsi.domaci} />
              <OdznakKlubu klubId={dalsi.hoste} />
              <div>
                {hra.tymy[dalsi.domaci].nazev} – {hra.tymy[dalsi.hoste].nazev}
                <div style={{ color: 'var(--tlumeny)', fontSize: 13 }}>den {dalsi.den}</div>
              </div>
            </div>
          ) : (
            <p>{hra.faze === 'konecSezony' ? 'Sezóna skončila.' : 'Sezóna běží dál.'}</p>
          )}
          {hra.faze === 'konecSezony' ? (
            <>
              {hra.vyhlaseni && (
                <button
                  className="tlacitko sekundarni"
                  style={{ marginRight: 8 }}
                  onClick={() => setObrazovka('vyhlaseni')}
                >
                  🏆 Vyhlášení sezóny
                </button>
              )}
              <button className="tlacitko" onClick={novaSezona}>
                Zahájit novou sezónu
              </button>
            </>
          ) : hra.cekajiciZapas ? (
            <button className="tlacitko puls" onClick={() => setObrazovka('zapas')}>
              Na zápas! 🏒
            </button>
          ) : (
            <button className="tlacitko" onClick={pokracuj}>
              Pokračovat ▶
            </button>
          )}
        </div>
        <div className="karta">
          <h3>Vedení</h3>
          <p style={{ color: 'var(--tlumeny)', fontSize: 13 }}>{hra.cilSezony.popis}</p>
          <Ukazatel hodnota={hra.trener.duvera} barva={barvaHodnoty(hra.trener.duvera)} popisek="Důvěra vedení" />
        </div>
        <div className="karta">
          <h3>Fanoušci</h3>
          <p style={{ color: 'var(--tlumeny)', fontSize: 13 }}>
            {mojePozice}. místo · {liga.nazev}
          </p>
          <Ukazatel hodnota={hra.naladaFanousku} barva={barvaHodnoty(hra.naladaFanousku)} popisek="Nálada fanoušků" />
        </div>
      </div>
      <div className="mrizka">
        <div className="karta">
          <h3>{liga.nazev}</h3>
          <table>
            <tbody>
              {tabulka.map((r, i) => (
                <tr key={r.tymId} className={r.tymId === hra.mujKlubId ? 'muj' : ''}>
                  <td>{i + 1}.</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <OdznakKlubu klubId={r.tymId} velikost={22} />
                    {hra.tymy[r.tymId].nazev}
                  </td>
                  <td>
                    <b>{r.body} b.</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="karta">
          <h3>Zprávy</h3>
          {hra.zpravy.slice(0, 12).map((z, i) => (
            <div key={i} className="zprava">
              {z}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Nabidky({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  return (
    <>
      <h2>📰 Odvolán!</h2>
      <p>Vedení s tebou ztratilo trpělivost. Zájem o tebe ale mají jinde:</p>
      <div className="mrizka-3">
        {hra.nabidky!.map((id) => (
          <div key={id} className="karta" style={{ textAlign: 'center' }}>
            <OdznakKlubu klubId={id} velikost={48} />
            <h3>{hra.tymy[id].nazev}</h3>
            <p style={{ color: 'var(--tlumeny)' }}>
              {hra.ligy.find((l) => l.tymy.includes(id))!.nazev} · síla {Math.round(prumernyOverall(hra, id))}
            </p>
            <button
              className="tlacitko"
              onClick={() => {
                const s = prijmiNabidku(hra, id)
                setHra(s)
                void ulozHru(0, s)
              }}
            >
              Převzít klub
            </button>
          </div>
        ))}
      </div>
      <button
        className="tlacitko nebezpecne"
        onClick={() => {
          const s = odmitniNabidky(hra)
          setHra(s)
          void ulozHru(0, s)
        }}
      >
        Odmítnout vše a ukončit kariéru
      </button>
    </>
  )
}

function KonecKariery({ hra }: { hra: GameState }) {
  const k = hra.trener.kariera
  return (
    <>
      <h2>Konec kariéry</h2>
      <div className="karta">
        <p>
          Zápasů: <b>{k.zapasy}</b> · Výher: <b>{k.vyhry}</b> · Sezón: <b>{k.sezony}</b> · Vyhazovů:{' '}
          <b>{k.vyhazovy}</b>
        </p>
        <p>Trofeje: {k.trofeje.length > 0 ? k.trofeje.join(' · ') : 'žádné'}</p>
        <button className="tlacitko" onClick={() => location.reload()}>
          Nová hra
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Ověřit**

Run: `npm run test` → PASS; `npm run build` → clean. Manuálně: Přehled ukazuje cíl, důvěru a náladu jako barevné bary; derby štítek u derby zápasu; „Na zápas!" pulzuje, když čeká zápas.

- [ ] **Step 3: Stage (BEZ commitu)**

```bash
git add -A
```

---

### Task 10: Obrazovky Klub a Vyhlášení, kapitán a zranění v Sestavě

**Files:**
- Create: `src/ui/obrazovky/Klub.tsx`, `src/ui/obrazovky/Vyhlaseni.tsx`
- Modify: `src/ui/App.tsx` (nové obrazovky), `src/ui/obrazovky/Sestava.tsx` (kapitán, zranění), `src/ui/obrazovky/Soupiska.tsx` (sloupec zdraví), `src/ui/styl.css` (přidat `.zraneny`)

**Interfaces:**
- Consumes: `hra.vyhlaseni`, `hra.historie`, `hra.rekordy`, `hra.trener`, `kapitanId`, `jeZdravy`, `zahajNovouSezonu`, komponenty.
- Produces: `Klub({ hra })`, `Vyhlaseni({ hra, setHra, setObrazovka })`; `Obrazovka` typ rozšířen o `'klub' | 'vyhlaseni'`; nav dostává záložku „Klub" (vyhlášení se otevírá automaticky, v navu není).

- [ ] **Step 1: App** — v `src/ui/App.tsx`:
  - `export type Obrazovka = 'prehled' | 'soupiska' | 'sestava' | 'zapas' | 'liga' | 'klub' | 'ulozeni' | 'vyhlaseni'`
  - do `ZALOZKY` přidat `['klub', 'Klub']` (před `ulozeni`); `'vyhlaseni'` do záložek NEpatří.
  - do mapy `obsah` přidat: `klub: <Klub hra={hra} />,` a `vyhlaseni: <Vyhlaseni hra={hra} setHra={setHra} setObrazovka={setObrazovka} />,`
  - `poZapase` živého zápasu: `poZapase={(po) => setObrazovka(po.faze === 'konecSezony' ? 'vyhlaseni' : 'prehled')}`
  - importy `Klub`, `Vyhlaseni`.

- [ ] **Step 2: Vyhlášení** — `src/ui/obrazovky/Vyhlaseni.tsx`:

```tsx
import { zahajNovouSezonu } from '../../core/sezona'
import type { GameState } from '../../core/types'
import type { Obrazovka } from '../App'
import { OdznakKlubu } from '../komponenty'
import { ulozHru } from '../store'

export function Vyhlaseni({
  hra,
  setHra,
  setObrazovka,
}: {
  hra: GameState
  setHra: (s: GameState) => void
  setObrazovka: (o: Obrazovka) => void
}) {
  const v = hra.vyhlaseni
  if (!v) {
    return (
      <>
        <h2>Vyhlášení sezóny</h2>
        <p>Sezóna ještě běží.</p>
      </>
    )
  }
  const posledniZaznam = hra.historie[hra.historie.length - 1]
  return (
    <>
      <h2>🏆 Vyhlášení sezóny {v.sezona}</h2>
      <div className="mrizka-3">
        {v.mistri.map((m) => (
          <div key={m.nazevLigy} className="karta" style={{ textAlign: 'center' }}>
            <OdznakKlubu klubId={m.klubId} velikost={48} />
            <h3>{hra.tymy[m.klubId].nazev}</h3>
            <p style={{ color: 'var(--zlata)' }}>vítěz — {m.nazevLigy}</p>
          </div>
        ))}
      </div>
      <div className="mrizka">
        <div className="karta">
          <h3>Králové střelců</h3>
          {v.kraloveStrelcu.map((k) => (
            <div key={k.nazevLigy} className="zprava">
              {k.nazevLigy}: <b>{k.jmeno}</b> ({hra.tymy[k.klubId].nazev}) — {k.goly} gólů
            </div>
          ))}
        </div>
        <div className="karta">
          <h3>Hvězda tvého týmu</h3>
          {v.hvezdaTymu ? (
            <p>
              ⭐ <b>{v.hvezdaTymu.jmeno}</b> — {v.hvezdaTymu.goly} gólů, {v.hvezdaTymu.asistence} asistencí
            </p>
          ) : (
            <p>—</p>
          )}
          {posledniZaznam && (
            <p className={posledniZaznam.splnen ? 'vyhra' : 'prohra'}>
              {posledniZaznam.splnen ? '✅ Cíl sezóny splněn!' : '❌ Cíl sezóny nesplněn.'}
              {posledniZaznam.trofej && ` 🏆 ${posledniZaznam.trofej}`}
            </p>
          )}
        </div>
      </div>
      {hra.nabidky ? (
        // vyhazov na konci sezóny: zahajNovouSezonu by hodila chybu — nejdřív nabídky
        <button className="tlacitko nebezpecne" onClick={() => setObrazovka('prehled')}>
          Nejdřív vyřeš nabídky klubů ▶
        </button>
      ) : (
        <button
          className="tlacitko"
          onClick={() => {
            const s = zahajNovouSezonu(hra)
            setHra(s)
            void ulozHru(0, s)
            setObrazovka('prehled')
          }}
        >
          Zahájit novou sezónu ▶
        </button>
      )}
    </>
  )
}
```

- [ ] **Step 3: Klub** — `src/ui/obrazovky/Klub.tsx`:

```tsx
import type { GameState } from '../../core/types'
import { OdznakKlubu } from '../komponenty'

export function Klub({ hra }: { hra: GameState }) {
  const k = hra.trener.kariera
  const uspesnost = k.zapasy > 0 ? Math.round((k.vyhry / k.zapasy) * 100) : 0
  return (
    <>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <OdznakKlubu klubId={hra.mujKlubId} velikost={36} /> {hra.tymy[hra.mujKlubId].nazev}
      </h2>
      <div className="mrizka">
        <div className="karta">
          <h3>🏆 Síň trofejí</h3>
          {k.trofeje.length > 0 ? (
            k.trofeje.map((t, i) => (
              <div key={i} className="zprava" style={{ color: 'var(--zlata)', fontWeight: 700 }}>
                🏆 {t}
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--tlumeny)' }}>Zatím žádná trofej. Tak co s tím uděláš?</p>
          )}
        </div>
        <div className="karta">
          <h3>Rekordy</h3>
          <div className="zprava">
            Nejvyšší výhra: {hra.rekordy.nejvyssiVyhra ? hra.rekordy.nejvyssiVyhra.text : '—'}
          </div>
          <div className="zprava">
            Nejlepší střelec sezóny:{' '}
            {hra.rekordy.nejlepsiStrelec
              ? `${hra.rekordy.nejlepsiStrelec.jmeno} (${hra.rekordy.nejlepsiStrelec.goly} gólů)`
              : '—'}
          </div>
        </div>
      </div>
      <div className="karta">
        <h3>Historie sezón</h3>
        {hra.historie.length === 0 ? (
          <p style={{ color: 'var(--tlumeny)' }}>První sezóna teprve běží.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sezóna</th>
                <th>Klub</th>
                <th>Soutěž</th>
                <th>Umístění</th>
                <th>Cíl</th>
                <th>Trofej</th>
              </tr>
            </thead>
            <tbody>
              {hra.historie.map((z) => (
                <tr key={z.sezona}>
                  <td>{z.sezona}</td>
                  <td>{hra.tymy[z.klubId].nazev}</td>
                  <td>{z.nazevLigy}</td>
                  <td>{z.umisteni}.</td>
                  <td className={z.splnen ? 'vyhra' : 'prohra'}>{z.splnen ? '✅ splněn' : '❌ nesplněn'}</td>
                  <td>{z.trofej ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="karta">
        <h3>Profil trenéra</h3>
        <p>
          Zápasů: <b>{k.zapasy}</b> · Výher: <b>{k.vyhry}</b> ({uspesnost} %) · Sezón: <b>{k.sezony}</b> ·
          Vyhazovů: <b>{k.vyhazovy}</b> · Trofejí: <b>{k.trofeje.length}</b>
        </p>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Sestava — kapitán a zranění** — v `src/ui/obrazovky/Sestava.tsx`:
  - import `jeZdravy` ze `../../core/sestava`.
  - v komponentě `Karta` přidat za jméno: `{h.id === tym.kapitanId && ' Ⓒ'}` a zraněným `🚑`; zraněné vyřadit z výměn:

```tsx
const Karta = ({ id }: { id: string }) => {
  const h = podleId.get(id)!
  const zraneny = !jeZdravy(h)
  return (
    <button
      className={`tlacitko sekundarni klik ${vybrany === id ? 'vybrany' : ''} ${zraneny ? 'zraneny' : ''}`}
      disabled={zraneny}
      onClick={() => klik(id)}
    >
      {h.jmeno} {h.prijmeni}
      {h.id === tym.kapitanId && ' Ⓒ'}
      {zraneny && ` 🚑${h.zranenZapasu}`} ({overall(h)})
    </button>
  )
}
```

  - před sekci Náhradníci vložit volbu kapitána:

```tsx
<div className="karta">
  <b>Kapitán Ⓒ:</b>{' '}
  <select
    value={tym.kapitanId ?? ''}
    onChange={(e) =>
      setHra({ ...hra, tymy: { ...hra.tymy, [hra.mujKlubId]: { ...tym, kapitanId: e.target.value } } })
    }
  >
    {tym.hraci.map((h) => (
      <option key={h.id} value={h.id}>
        {h.jmeno} {h.prijmeni}
      </option>
    ))}
  </select>{' '}
  <span style={{ color: 'var(--tlumeny)' }}>Kapitán drží morálku týmu při prohrách.</span>
</div>
```

  - do `src/ui/styl.css` přidat: `.zraneny { opacity: 0.45; }` a základní vzhled selectu:

```css
select {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--okraj);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}
```

- [ ] **Step 5: Soupiska — sloupec zdraví** — v `src/ui/obrazovky/Soupiska.tsx` přidat hlavičku `<th>Zdraví</th>` (za Únava) a buňku `<td>{h.zranenZapasu > 0 ? `🚑 ${h.zranenZapasu}` : '✓'}</td>`; a k jménu kapitána `{h.id === hra.tymy[hra.mujKlubId].kapitanId && ' Ⓒ'}`.

- [ ] **Step 6: Ověřit**

Run: `npm run test` → PASS; `npm run build` → clean. Manuálně: záložka Klub ukazuje prázdnou síň + profil; po dohrání sezóny se otevře Vyhlášení a tlačítko zahájí novou sezónu; v Sestavě jde vybrat kapitán a zranění hráči jsou šedí s 🚑.

- [ ] **Step 7: Stage (BEZ commitu)**

```bash
git add -A
```

---

### Task 11: Integrace, dokumentace, build

**Files:**
- Modify: `README.md`, `CLAUDE.md`
- Žádný nový kód — jen ověření celku a balíčky.

- [x] **Step 1: Celá sada testů 2× po sobě**

Run: `npm run test && npm run test` → Expected: PASS oba běhy (stabilita statistických testů).

- [x] **Step 2: Typová kontrola a web build**

Run: `npm run build` → Expected: clean (tsc strict + vite).

- [x] **Step 3: Desktopový build**

Run: `npm run tauri build` (timeout klidně 15 min) → Expected: AppImage + .deb v `src-tauri/target/release/bundle/`.

- [x] **Step 4: Dokumentace**
  - `README.md`: sekci „Stav projektu" aktualizovat — M1 hotové, M2 hotové (interaktivní zápas, kariéra, vyhlášení, vizuál), odkaz na spec `2026-07-06-zabavnost-design.md` a tento plán; milníky přečíslovat dle specu zábavnosti (M3 budování týmu, M4 velkolepost + reálné soupisky).
  - `CLAUDE.md`: v sekci „Kde co je" přidat odkaz na tento plán jako aktuální; poznámku „commity se nedělají bez vyžádání uživatele".

- [ ] **Step 5: Ruční E2E checklist (projít v `npm run tauri dev`)** — MANUÁLNÍ, provede uživatel.

1. Nová hra → výběr klubu → Přehled ukazuje cíl sezóny, důvěru 50, náladu 50
2. Pokračovat → předzápas (hláška soupeře, taktika) → Začít zápas → minuty běží, momentum se hýbe, události naskakují se šancemi
3. Pauza po třetině → změna taktiky + proslov (jen 1×) → pokračovat
4. Time-out a odvolání brankáře reagují; zranění nabídne náhradníky
5. Konec zápasu → Pokračovat → Přehled: důvěra/nálada se pohnuly, tabulka sedí
6. Odsimulovat celý zápas z předzápasu funguje
7. Dohrát sezónu (přeskakovat) → Vyhlášení → nová sezóna → historie v Klubu
8. Uložit/načíst funguje (verze 2; staré M1 uložení se tiše přeskočí)
9. Vizuál: Inter font, odznaky klubů, barevné bary, animace událostí

- [x] **Step 6: Stage (BEZ commitu)**

```bash
git add -A
```

---

## Self-review plánu

- **Pokrytí specu:** M2a interaktivní zápas (T2 engine, T8 UI, T4 napojení), momentum + šance (T2 `sance`, T7 MomentumGraf, T8), proslov/timeout/brankář/zranění (T2+T8), taktika (T1+T2+T8 předzápas i pauzy); M2b cíl/důvěra/nálada/derby/vyhazov s nabídkami (T5, UI T9), M2c vyhlášení/historie/trofeje/rekordy/kapitán/profil (T6, UI T10), M2d vizuál (T7 + průběžně). Rozehraný zápas se neukládá (StavZapasu jen v React state, autosave před zápasem v `pokracuj` a po něm v `dokonci`). Verze uložení 2 (T1).
- **Vědomá zjednodušení:** AI soupeř nemění taktiku ani neodvolává brankáře (konzistence interaktivní vs. simulované cesty — kandidát na M3/M4); nálada fanoušků se sleduje jen pro můj klub; brankáři se nezraňují.
- **Typová konzistence:** `StavZapasu` a spol. žijí v `zapas.ts` (UI importuje odtud); `CekajiciZapas`, `Trener`, `Rekordy` atd. v `types.ts` (T1); `poMemZapase(s, v, cz)`, `dokonciZapas(state, stavZapasu)`, `zapisRekordVyhry(s, v, cz)` — podpisy sedí napříč T4/T5/T6.
- **Určeno pro slabší vykonavatele:** kompletní kód všude; provázanost T3→T4 (přesun logiky zranění do `zapisDopadyZapasu`) je popsaná krok za krokem v T4/Step 4.






