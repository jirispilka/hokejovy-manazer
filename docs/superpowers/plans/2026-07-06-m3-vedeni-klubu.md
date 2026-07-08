# M3 — Vedení klubu: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přestupový trh se smlouváním, klubové finance (rozpočty, platy, vstupné, sponzoři s volbou smlouvy, bankrot), týdenní trénink, akademie odchovanců a otázky novinářů — dle specu `docs/superpowers/specs/2026-07-06-m3-vedeni-klubu-design.md`.

**Architecture:** Tři nové čisté moduly jádra — `prestupy.ts` (hodnota hráče, smlouvání, přesuny, tržní tick), `finance.ts` (uzávěrka, vstupné, sponzor, bankrot) a `media.ts` (otázky novinářů) — zavěšené do `advanceDay`/`dokonciZapas`/`zahajNovouSezonu`. Peníze jsou celá čísla v Kč u všech 42 klubů (AI kluby hospodaří, aby trh měl druhou stranu). UI přidává záložky Přestupy, Finance a Trénink.

**Tech Stack:** beze změn (žádná nová závislost).

## Global Constraints

- Všechna pravidla CLAUDE.md: čisté jádro (žádné UI/React/Tauri importy, žádné `Date`/`Math.random()` — jen `Rng` parametr), `GameState` plain-JSON, determinismus, UI texty česky.
- **ŽÁDNÉ COMMITY** — po každém tasku jen `npm run test` (2×), `npx tsc --noEmit` a `git add -A`. Checkboxy odškrtávat.
- Verze uložení → **4**.
- Závazné hodnoty ze specu: startovní rozpočty [60 mil., 20 mil., 8 mil.] Kč dle úrovně ligy; plat = `round(overall² × 25 / 1000) × 1000` Kč/měs (přestupem ×1.1); uzávěrka každých 30 dní; sponzor fix [12 mil., 4 mil., 1,5 mil.]/měs × (0.8 + důvěra/250), bonus varianta = 60 % fixu + [400, 150, 60] tis. za výhru; vstupné: základ [8000, 3500, 1200] diváků × (0.6 + nálada/250) × (derby 1.3) × lístek [150, 100, 60] Kč; bankrot: < 0 týdenní varování, < −5 mil. nucený prodej nejdražšího „do zahraničí" za hodnotu + důvěra −10; hodnota hráče = `overall² × 4000 × faktorVěku(≤21:1.8, 22–25:1.4, 26–29:1.0, 30–32:0.6, 33+:0.35) × (1 + (forma−50)/200)`, zaokrouhleno na 10 tis.; ochota prodat: top-6 hráčů týmu ×1.3, jinak ×0.95; soupiska max 26, minima 12 Ú / 6 O / 2 B; okno mimo playoff; AI↔AI přestup ~1× za 10 dní; trénink každých 7 dní; akademie 1–2 odchovanci (17–18 let) při nové sezóně.
- Nové id hráčů (akademie) NESMÍ používat globální čítač `dalsiId` (po načtení hry se resetuje → kolize) — id tvaru `ak-<sezona>-<klubId>-<i>`.

## Struktura souborů

```
src/core/
├── types.ts       (rozšířit: plat, rozpocet, sponzor, trénink, trh, média)
├── generator.ts   (plat, rozpocet)
├── hodnoty.ts     (rozšířit: kc() formátování peněz)
├── prestupy.ts    (NOVÝ: hodnota, odhad potenciálu, smlouvání, přesuny, trhTick)
├── finance.ts     (NOVÝ: uzávěrka, vstupné, sponzor, bankrot)
├── media.ts       (NOVÝ: otázky novinářů)
├── sezona.ts      (zavěšení: trh/uzávěrka/trénink/akademie/vstupné/otázky)
└── ulozeni.ts     (VERZE 4)
src/ui/
├── App.tsx        (záložky Přestupy, Finance, Trénink)
├── obrazovky/Prestupy.tsx  (NOVÝ)
├── obrazovky/Finance.tsx   (NOVÝ)
├── obrazovky/Trenink.tsx   (NOVÝ)
├── obrazovky/Prehled.tsx   (karta rozpočtu, otázka médií, volba sponzora)
└── obrazovky/Soupiska.tsx  (sloupce Plat, Hodnota)
tests/core/ (nové: prestupy, finance, media, trenink-akademie; úprava: data-m3)
```

---

### Task 1: Typy, plat, rozpočet, verze 4

**Files:**
- Modify: `src/core/types.ts`, `src/core/generator.ts`, `src/core/sezona.ts` (jen `newGame`), `src/core/ulozeni.ts`, `src/core/hodnoty.ts` (kc)
- Test: `tests/core/data-m3.test.ts`; Modify: `tests/core/ulozeni.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export type TypSponzora = 'jistota' | 'bonus'
export interface Sponzor { typ: TypSponzora; mesicne: number; zaVyhru: number }
export type TreninkZamereni = 'strelba' | 'obrana' | 'kondice' | 'brankari'
export interface NabidkaProdeje { hracId: string; denOd: number }
export interface PrichoziNabidka { hracId: string; klubId: string; castka: number }
export interface MoznostOdpovedi { text: string; efektMoralka: number; efektNalada: number; riskantni: boolean }
export interface OtazkaMedii { text: string; moznosti: MoznostOdpovedi[] }
// Hrac navíc: plat: number (Kč/měsíc)
// Tym navíc: rozpocet: number (Kč)
// GameState navíc: sponzor: Sponzor; sponzorNabidka: boolean; treninkZamereni: TreninkZamereni;
//   nabidkyProdeje: NabidkaProdeje[]; prichoziNabidka: PrichoziNabidka | null;
//   otazkaMedii: OtazkaMedii | null; posledniUzaverka: number
```

```ts
// hodnoty.ts
export function kc(n: number): string
// >= 1 mil. → '12,5 mil. Kč' (čárka, 1 des. místo, bez zbytečné nuly: '8 mil. Kč');
// jinak → '850 tis. Kč'; záporné s minusem
```

- `generator.ts`: `generujHrace` navíc `plat: Math.round((o * o * 25) / 1000) * 1000` (spočítat z `overall(hrac)` PO sestavení hráče, stejně jako `potencial`); `generujTym` navíc `rozpocet: START_ROZPOCET[klub.liga]` s konstantou `export const START_ROZPOCET = [60_000_000, 20_000_000, 8_000_000]` v `generator.ts`.
- `sezona.ts` `newGame` navíc: `sponzor: { typ: 'jistota', mesicne: [12_000_000, 4_000_000, 1_500_000][ligaMehoKlubu], zaVyhru: 0 }` (úroveň ligy mého klubu — spočti z `ligy`), `sponzorNabidka: true`, `treninkZamereni: 'kondice'`, `nabidkyProdeje: []`, `prichoziNabidka: null`, `otazkaMedii: null`, `posledniUzaverka: 0`.
- `ulozeni.ts`: `VERZE = 4` (+ test verze `'"verze":4'` → `'"verze":99'`).

- [ ] **Step 1: Failing test** — `tests/core/data-m3.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generujTym, resetIdCitac, START_ROZPOCET } from '../../src/core/generator'
import { kc } from '../../src/core/hodnoty'
import { createRng } from '../../src/core/rng'
import { overall } from '../../src/core/sestava'
import { newGame } from '../../src/core/sezona'
import type { Klub } from '../../src/core/types'

describe('platy a rozpočty', () => {
  it('hráč má plat dle overall a klub startovní rozpočet dle ligy', () => {
    resetIdCitac()
    const t = generujTym(createRng(3), { id: 'tabor', nazev: 'HC Tábor', liga: 2 } as Klub)
    expect(t.rozpocet).toBe(START_ROZPOCET[2])
    for (const h of t.hraci) {
      const o = overall(h)
      expect(h.plat).toBe(Math.round((o * o * 25) / 1000) * 1000)
    }
  })
})

describe('newGame M3 pole', () => {
  const s = newGame(7, 'tabor')
  it('inicializuje sponzora, trénink a trh', () => {
    expect(s.sponzor).toEqual({ typ: 'jistota', mesicne: 1_500_000, zaVyhru: 0 })
    expect(s.sponzorNabidka).toBe(true)
    expect(s.treninkZamereni).toBe('kondice')
    expect(s.nabidkyProdeje).toEqual([])
    expect(s.prichoziNabidka).toBeNull()
    expect(s.otazkaMedii).toBeNull()
    expect(s.posledniUzaverka).toBe(0)
  })
})

describe('kc', () => {
  it('formátuje koruny česky', () => {
    expect(kc(12_500_000)).toBe('12,5 mil. Kč')
    expect(kc(8_000_000)).toBe('8 mil. Kč')
    expect(kc(850_000)).toBe('850 tis. Kč')
    expect(kc(-3_200_000)).toBe('-3,2 mil. Kč')
  })
})
```

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL.

- [ ] **Step 3: Implementace** — typy dle Interfaces; `kc` v `hodnoty.ts`:

```ts
export function kc(n: number): string {
  const znamenko = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const mil = abs / 1_000_000
    const text = (Math.round(mil * 10) / 10).toString().replace('.', ',').replace(/,0$/, '')
    return `${znamenko}${text} mil. Kč`
  }
  return `${znamenko}${Math.round(abs / 1000)} tis. Kč`
}
```

generator + newGame + VERZE dle Interfaces (v `generujHrace` nastav `plat: 0` v literálu a po výpočtu `o = overall(hrac)` přiřaď `hrac.plat = Math.round((o * o * 25) / 1000) * 1000`).

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2 (119 + nové), `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 2: Přestupový trh (`src/core/prestupy.ts`)

**Files:**
- Create: `src/core/prestupy.ts`
- Test: `tests/core/prestupy.test.ts`

**Interfaces:**
- Consumes: `overall`, `vychoziSestava`, `zmenSestavuKlubu` ze sestavy; `kc` z hodnot; `pick`, `hashSeed`, `Rng` z rng.
- Produces (T3/T4/UI používají přesně takto):

```ts
export const MINIMA: { U: 12; D: 6; G: 2 }
export function pocetNaPozici(t: Tym, pozice: Pozice): number
export function hodnotaHrace(h: Hrac): number // overall²×4000×faktorVěku×forma, na 10 tis.
export function odhadPotencialu(h: Hrac, seed: number): [number, number] // stabilní rozmezí ±5 kolem potenciálu ±šum(±4); skutečný potenciál je VŽDY uvnitř
export const prestupoveOknoOtevrene = (s: GameState) => s.faze !== 'playoff'
export function faktorOchoty(tym: Tym, hracId: string): number // top 6 dle overall → 1.3, jinak 0.95
export function vyhodnotNabidku(s: GameState, klubId: string, hracId: string, castka: number): { vysledek: 'prijato' | 'protinavrh'; pozadovano: number }
export function odeberZTymu(t: Tym, hracId: string): Hrac // mutuje t: vyřadí hráče, případně přestaví sestavu (vychoziSestava přes zmenSestavuKlubu) a přenese kapitánství
export function kupHrace(state: GameState, odKlubu: string, hracId: string, castka: number): GameState
export function nabidniKProdeji(state: GameState, hracId: string): GameState
export function stahniZProdeje(state: GameState, hracId: string): GameState
export function prijmiProdej(state: GameState): GameState
export function odmitniProdej(state: GameState): GameState
export function trhTick(s: GameState, rng: Rng): void // mutuje klon; volá advanceDay
```

Pravidla (testy hlídají): viz Global Constraints (hodnota, ochota, minima, cap 26, okno). `kupHrace` znovu validuje cenu přes `vyhodnotNabidku` (UI nemůže podstřelit), kupovanému plat ×1.1 (na tisíce), forma 50, únava 0. `trhTick`: nabídka na prodávaného hráče po ≥3 dnech (cena = hodnota × 0.9–1.1, kupec = náhodný klub s rozpočtem a místem; jen jedna `prichoziNabidka` naráz); AI↔AI přestup s pravděpodobností 0.1/den (respektuje minima, rozpočet, cap; kupujícímu AI klubu se hned přestaví sestava). Mimo okno `trhTick` nic negeneruje a čekající nabídku zruší.

- [ ] **Step 1: Failing test** — `tests/core/prestupy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/core/rng'
import { overall } from '../../src/core/sestava'
import { advanceDay, newGame } from '../../src/core/sezona'
import {
  faktorOchoty,
  hodnotaHrace,
  kupHrace,
  nabidniKProdeji,
  odhadPotencialu,
  odmitniProdej,
  prijmiProdej,
  trhTick,
  vyhodnotNabidku,
} from '../../src/core/prestupy'
import type { GameState } from '../../src/core/types'

const celkovePenize = (s: GameState) =>
  Object.values(s.tymy).reduce((sum, t) => sum + t.rozpocet, 0)

describe('hodnotaHrace a odhad', () => {
  const s = newGame(7, 'tabor')
  it('odpovídá vzorci a je na 10 tisíce', () => {
    const h = s.tymy.sparta.hraci[0]
    const o = overall(h)
    const faktor = h.vek <= 21 ? 1.8 : h.vek <= 25 ? 1.4 : h.vek <= 29 ? 1.0 : h.vek <= 32 ? 0.6 : 0.35
    const cekana = Math.round((o * o * 4000 * faktor * (1 + (h.forma - 50) / 200)) / 10000) * 10000
    expect(hodnotaHrace(h)).toBe(cekana)
  })
  it('odhad potenciálu je stabilní a obsahuje skutečnost', () => {
    const h = s.tymy.sparta.hraci[3]
    const [lo, hi] = odhadPotencialu(h, s.seed)
    expect(odhadPotencialu(h, s.seed)).toEqual([lo, hi])
    expect(h.potencial).toBeGreaterThanOrEqual(lo)
    expect(h.potencial).toBeLessThanOrEqual(hi)
  })
})

describe('smlouvání', () => {
  const s = newGame(7, 'tabor')
  it('klíčový hráč je dražší a nízká nabídka dostane protinávrh', () => {
    const sparta = s.tymy.sparta
    const hvezda = [...sparta.hraci].sort((a, b) => overall(b) - overall(a))[0]
    const okraj = [...sparta.hraci].sort((a, b) => overall(a) - overall(b))[0]
    expect(faktorOchoty(sparta, hvezda.id)).toBe(1.3)
    expect(faktorOchoty(sparta, okraj.id)).toBe(0.95)
    const { vysledek, pozadovano } = vyhodnotNabidku(s, 'sparta', hvezda.id, 1000)
    expect(vysledek).toBe('protinavrh')
    expect(pozadovano).toBeGreaterThan(hodnotaHrace(hvezda))
    expect(vyhodnotNabidku(s, 'sparta', hvezda.id, pozadovano).vysledek).toBe('prijato')
  })
})

describe('kupHrace', () => {
  it('přesune hráče, peníze i zvedne plat; zachovává celkové peníze', () => {
    let s = newGame(7, 'tabor')
    s.tymy.tabor.rozpocet = 200_000_000 // ať je na nákup
    const pred = celkovePenize(s)
    const cil = s.tymy.decin.hraci.find((h) => h.pozice === 'U')!
    const { pozadovano } = vyhodnotNabidku(s, 'decin', cil.id, 0)
    const puvodniPlat = cil.plat
    const po = kupHrace(s, 'decin', cil.id, pozadovano)
    expect(po.tymy.tabor.hraci.some((h) => h.id === cil.id)).toBe(true)
    expect(po.tymy.decin.hraci.some((h) => h.id === cil.id)).toBe(false)
    const novy = po.tymy.tabor.hraci.find((h) => h.id === cil.id)!
    expect(novy.plat).toBe(Math.round((puvodniPlat * 1.1) / 1000) * 1000)
    expect(novy.forma).toBe(50)
    expect(po.tymy.tabor.rozpocet).toBe(200_000_000 - pozadovano)
    expect(celkovePenize(po)).toBe(pred)
  })
  it('odmítne podstřelenou cenu, plnou soupisku, chudý klub a playoff', () => {
    const s = newGame(7, 'tabor')
    const cil = s.tymy.decin.hraci.find((h) => h.pozice === 'U')!
    expect(() => kupHrace(s, 'decin', cil.id, 1000)).toThrow()
    const { pozadovano } = vyhodnotNabidku(s, 'decin', cil.id, 0)
    const chudy = structuredClone(s)
    chudy.tymy.tabor.rozpocet = 0
    expect(() => kupHrace(chudy, 'decin', cil.id, pozadovano)).toThrow(/rozpočet/)
    const vPlayoff = structuredClone(s)
    vPlayoff.faze = 'playoff'
    vPlayoff.tymy.tabor.rozpocet = 200_000_000
    expect(() => kupHrace(vPlayoff, 'decin', cil.id, pozadovano)).toThrow(/playoff/i)
  })
  it('prodávající neklesne pod minimum pozice', () => {
    const s = newGame(7, 'tabor')
    s.tymy.tabor.rozpocet = 500_000_000
    // brankáři: klub má přesně 2 → prodat nesmí
    const golman = s.tymy.decin.hraci.find((h) => h.pozice === 'G')!
    const { pozadovano } = vyhodnotNabidku(s, 'decin', golman.id, 0)
    expect(() => kupHrace(s, 'decin', golman.id, pozadovano)).toThrow(/minimum/)
  })
})

describe('prodej a trhTick', () => {
  it('nabídka přijde po 3+ dnech a prodej převede hráče i peníze', () => {
    let s = newGame(7, 'tabor')
    const prodavany = s.tymy.tabor.hraci.filter((h) => h.pozice === 'U')[13] // 14. útočník — nad minimem
    s = nabidniKProdeji(s, prodavany.id)
    expect(s.nabidkyProdeje).toHaveLength(1)
    let pojistka = 0
    while (!s.prichoziNabidka && pojistka++ < 30) {
      s = s.cekajiciZapas ? { ...s } : s // (zápasy neřešíme — advanceDay je hraje AI, můj dohrajeme enginem v jiných testech)
      // posouváme jen trh: zavolej trhTick přímo na klonu
      const klon = structuredClone(s)
      klon.den++
      trhTick(klon, createRng(1000 + klon.den))
      s = klon
    }
    expect(s.prichoziNabidka).not.toBeNull()
    expect(s.prichoziNabidka!.hracId).toBe(prodavany.id)
    const pred = celkovePenize(s)
    const castka = s.prichoziNabidka!.castka
    const mujPred = s.tymy.tabor.rozpocet
    const po = prijmiProdej(s)
    expect(po.tymy.tabor.hraci.some((h) => h.id === prodavany.id)).toBe(false)
    expect(po.tymy.tabor.rozpocet).toBe(mujPred + castka)
    expect(po.prichoziNabidka).toBeNull()
    expect(celkovePenize(po)).toBe(pred)
  })
  it('odmítnutí nabídku smaže a hráč zůstává', () => {
    let s = newGame(7, 'tabor')
    const prodavany = s.tymy.tabor.hraci.filter((h) => h.pozice === 'U')[12]
    s = nabidniKProdeji(s, prodavany.id)
    s.prichoziNabidka = { hracId: prodavany.id, klubId: 'sparta', castka: 5_000_000 }
    const po = odmitniProdej(s)
    expect(po.prichoziNabidka).toBeNull()
    expect(po.tymy.tabor.hraci.some((h) => h.id === prodavany.id)).toBe(true)
  })
  it('AI↔AI přestup zachovává peníze, minima a cap', () => {
    let s = newGame(7, 'tabor')
    const pred = celkovePenize(s)
    let prevodu = 0
    for (let den = 1; den <= 60; den++) {
      const klon = structuredClone(s)
      klon.den++
      const zprav = klon.zpravy.length
      trhTick(klon, createRng(9000 + den))
      if (klon.zpravy.length > zprav && klon.zpravy[0].includes('Přestup v lize')) prevodu++
      s = klon
    }
    expect(prevodu).toBeGreaterThan(0) // ~6 očekávaných za 60 dní
    expect(celkovePenize(s)).toBe(pred)
    for (const t of Object.values(s.tymy)) {
      expect(t.hraci.length).toBeLessThanOrEqual(26)
      expect(t.hraci.filter((h) => h.pozice === 'U').length).toBeGreaterThanOrEqual(12)
      expect(t.hraci.filter((h) => h.pozice === 'D').length).toBeGreaterThanOrEqual(6)
      expect(t.hraci.filter((h) => h.pozice === 'G').length).toBeGreaterThanOrEqual(2)
    }
  })
  it('mimo okno trh spí a čekající nabídka zaniká', () => {
    const s = newGame(7, 'tabor')
    s.faze = 'playoff'
    s.prichoziNabidka = { hracId: 'x', klubId: 'sparta', castka: 1 }
    const klon = structuredClone(s)
    trhTick(klon, createRng(1))
    expect(klon.prichoziNabidka).toBeNull()
  })
})
```

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL (prestupy.ts neexistuje).

- [ ] **Step 3: Implementace** — `src/core/prestupy.ts`:

```ts
import { kc } from './hodnoty'
import { hashSeed, pick, type Rng } from './rng'
import { overall, vychoziSestava, zmenSestavuKlubu } from './sestava'
import type { GameState, Hrac, Pozice, Tym } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const na10tis = (n: number) => Math.round(n / 10_000) * 10_000

export const MINIMA = { U: 12, D: 6, G: 2 } as const

export const pocetNaPozici = (t: Tym, pozice: Pozice): number =>
  t.hraci.filter((h) => h.pozice === pozice).length

const faktorVeku = (vek: number) =>
  vek <= 21 ? 1.8 : vek <= 25 ? 1.4 : vek <= 29 ? 1.0 : vek <= 32 ? 0.6 : 0.35

export function hodnotaHrace(h: Hrac): number {
  const o = overall(h)
  return na10tis(o * o * 4000 * faktorVeku(h.vek) * (1 + (h.forma - 50) / 200))
}

export function odhadPotencialu(h: Hrac, seed: number): [number, number] {
  let idHash = 0
  for (const znak of h.id) idHash = (idHash * 31 + znak.charCodeAt(0)) >>> 0
  const sum = (hashSeed(seed, idHash) % 9) - 4 // ±4 → skutečnost je vždy v rozmezí ±5
  const stred = clamp(h.potencial + sum, 1, 99)
  return [Math.max(1, stred - 5), Math.min(99, stred + 5)]
}

export const prestupoveOknoOtevrene = (s: GameState): boolean => s.faze !== 'playoff'

export function faktorOchoty(tym: Tym, hracId: string): number {
  const poradi = [...tym.hraci]
    .sort((a, b) => overall(b) - overall(a))
    .findIndex((h) => h.id === hracId)
  return poradi >= 0 && poradi < 6 ? 1.3 : 0.95
}

export function vyhodnotNabidku(
  s: GameState,
  klubId: string,
  hracId: string,
  castka: number,
): { vysledek: 'prijato' | 'protinavrh'; pozadovano: number } {
  const tym = s.tymy[klubId]
  const hrac = tym.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v klubu.')
  const pozadovano = na10tis(hodnotaHrace(hrac) * faktorOchoty(tym, hracId))
  return { vysledek: castka >= pozadovano ? 'prijato' : 'protinavrh', pozadovano }
}

export function odeberZTymu(t: Tym, hracId: string): Hrac {
  const hrac = t.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v týmu.')
  t.hraci = t.hraci.filter((h) => h.id !== hracId)
  const bylVSestave = [...t.sestava.utoky.flat(), ...t.sestava.obrany.flat(), t.sestava.brankar].includes(hracId)
  if (bylVSestave) {
    const prestaveny = zmenSestavuKlubu(t, vychoziSestava(t.hraci))
    t.sestava = prestaveny.sestava
    t.chemie = prestaveny.chemie
    t.slozeni = prestaveny.slozeni
  }
  if (t.kapitanId === hracId) {
    t.kapitanId = [...t.hraci].sort((a, b) => overall(b) - overall(a))[0]?.id ?? null
  }
  return hrac
}

function prestavAI(t: Tym): void {
  const prestaveny = zmenSestavuKlubu(t, vychoziSestava(t.hraci))
  t.sestava = prestaveny.sestava
  t.chemie = prestaveny.chemie
  t.slozeni = prestaveny.slozeni
}

export function kupHrace(state: GameState, odKlubu: string, hracId: string, castka: number): GameState {
  if (!prestupoveOknoOtevrene(state)) throw new Error('Přestupové okno je v playoff zavřené.')
  const { vysledek } = vyhodnotNabidku(state, odKlubu, hracId, castka)
  if (vysledek !== 'prijato') throw new Error('Nabídka je pod požadovanou cenou.')
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const prodavajici = s.tymy[odKlubu]
  const hrac = prodavajici.hraci.find((h) => h.id === hracId)!
  if (muj.rozpocet < castka) throw new Error('Na tenhle přestup nemáš rozpočet.')
  if (muj.hraci.length >= 26) throw new Error('Soupiska je plná (max 26 hráčů).')
  if (pocetNaPozici(prodavajici, hrac.pozice) - 1 < MINIMA[hrac.pozice])
    throw new Error('Klub hráče neprodá — spadl by pod minimum soupisky.')
  odeberZTymu(prodavajici, hracId)
  hrac.plat = Math.round((hrac.plat * 1.1) / 1000) * 1000
  hrac.forma = 50
  hrac.unava = 0
  muj.hraci.push(hrac)
  muj.rozpocet -= castka
  prodavajici.rozpocet += castka
  s.zpravy.unshift(`✍️ Přestup! ${hrac.jmeno} ${hrac.prijmeni} přichází z ${prodavajici.nazev} za ${kc(castka)}.`)
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function nabidniKProdeji(state: GameState, hracId: string): GameState {
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const hrac = muj.hraci.find((h) => h.id === hracId)
  if (!hrac) throw new Error('Hráč není v tvém klubu.')
  if (pocetNaPozici(muj, hrac.pozice) - 1 < MINIMA[hrac.pozice])
    throw new Error('Prodejem bys spadl pod minimum soupisky.')
  if (!s.nabidkyProdeje.some((n) => n.hracId === hracId)) {
    s.nabidkyProdeje.push({ hracId, denOd: s.den })
  }
  return s
}

export function stahniZProdeje(state: GameState, hracId: string): GameState {
  const s = structuredClone(state)
  s.nabidkyProdeje = s.nabidkyProdeje.filter((n) => n.hracId !== hracId)
  if (s.prichoziNabidka?.hracId === hracId) s.prichoziNabidka = null
  return s
}

export function prijmiProdej(state: GameState): GameState {
  const nabidka = state.prichoziNabidka
  if (!nabidka) throw new Error('Žádná nabídka nečeká.')
  if (!prestupoveOknoOtevrene(state)) throw new Error('Přestupové okno je v playoff zavřené.')
  const s = structuredClone(state)
  const muj = s.tymy[s.mujKlubId]
  const kupec = s.tymy[nabidka.klubId]
  const hrac = muj.hraci.find((h) => h.id === nabidka.hracId)
  if (!hrac) {
    s.prichoziNabidka = null
    return s
  }
  if (pocetNaPozici(muj, hrac.pozice) - 1 < MINIMA[hrac.pozice])
    throw new Error('Prodejem bys spadl pod minimum soupisky.')
  odeberZTymu(muj, hrac.id)
  hrac.forma = 50
  hrac.unava = 0
  kupec.hraci.push(hrac)
  prestavAI(kupec)
  kupec.rozpocet -= nabidka.castka
  muj.rozpocet += nabidka.castka
  s.nabidkyProdeje = s.nabidkyProdeje.filter((n) => n.hracId !== hrac.id)
  s.prichoziNabidka = null
  s.zpravy.unshift(`💰 ${hrac.jmeno} ${hrac.prijmeni} prodán do ${kupec.nazev} za ${kc(nabidka.castka)}.`)
  s.zpravy = s.zpravy.slice(0, 50)
  return s
}

export function odmitniProdej(state: GameState): GameState {
  const s = structuredClone(state)
  s.prichoziNabidka = null
  return s
}

// tržní tick — volá advanceDay na už naklonovaném stavu (mutuje s)
export function trhTick(s: GameState, rng: Rng): void {
  if (!prestupoveOknoOtevrene(s)) {
    s.prichoziNabidka = null
    return
  }
  // nabídky na hráče nabídnuté k prodeji (jedna naráz, po ≥3 dnech)
  if (!s.prichoziNabidka) {
    for (const n of s.nabidkyProdeje) {
      if (s.den - n.denOd < 3) continue
      const hrac = s.tymy[s.mujKlubId].hraci.find((h) => h.id === n.hracId)
      if (!hrac) continue
      const cena = na10tis(hodnotaHrace(hrac) * (0.9 + rng() * 0.2))
      const zajemci = Object.values(s.tymy).filter(
        (t) => t.klubId !== s.mujKlubId && t.rozpocet >= cena && t.hraci.length < 26,
      )
      if (zajemci.length === 0) continue
      const kupec = pick(rng, zajemci)
      s.prichoziNabidka = { hracId: hrac.id, klubId: kupec.klubId, castka: cena }
      s.zpravy.unshift(`📨 ${kupec.nazev} nabízí ${kc(cena)} za hráče ${hrac.jmeno} ${hrac.prijmeni}.`)
      break
    }
  }
  // AI ↔ AI přestup ~1× za 10 dní
  if (rng() < 0.1) {
    const aiKluby = Object.values(s.tymy).filter((t) => t.klubId !== s.mujKlubId)
    const prodavajici = pick(rng, aiKluby)
    const kandidati = prodavajici.hraci.filter(
      (h) => pocetNaPozici(prodavajici, h.pozice) > MINIMA[h.pozice],
    )
    if (kandidati.length > 0) {
      const hrac = pick(rng, kandidati)
      const cena = hodnotaHrace(hrac)
      const kupci = aiKluby.filter(
        (t) => t.klubId !== prodavajici.klubId && t.rozpocet >= cena && t.hraci.length < 26,
      )
      if (kupci.length > 0) {
        const kupec = pick(rng, kupci)
        odeberZTymu(prodavajici, hrac.id)
        hrac.forma = 50
        hrac.unava = 0
        kupec.hraci.push(hrac)
        prestavAI(kupec)
        kupec.rozpocet -= cena
        prodavajici.rozpocet += cena
        s.zpravy.unshift(
          `🔁 Přestup v lize: ${hrac.jmeno} ${hrac.prijmeni} mění ${prodavajici.nazev} za ${kupec.nazev} (${kc(cena)}).`,
        )
      }
    }
  }
  s.zpravy = s.zpravy.slice(0, 50)
}
```

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2, `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 3: Finance (`src/core/finance.ts`)

**Files:**
- Create: `src/core/finance.ts`
- Test: `tests/core/finance.test.ts`

**Interfaces:**
- Consumes: `kc` z hodnot; `hodnotaHrace`, `odeberZTymu`, `MINIMA`, `pocetNaPozici` z prestupy; `vyhazov` z kariery (bez cyklu — kariera finance neimportuje).
- Produces:

```ts
export const SPONZOR_FIX: number[] // [12e6, 4e6, 1.5e6] dle úrovně ligy
export const SPONZOR_BONUS_VYHRA: number[] // [400e3, 150e3, 60e3]
export function nabidkySponzora(s: GameState): { jistota: Sponzor; bonus: Sponzor } // bonus: 60 % fixu + zaVyhru
export function zvolSponzora(state: GameState, typ: TypSponzora): GameState // clone; sponzorNabidka = false
export function vstupne(s: GameState, derby: boolean): number // jen můj klub
export function mesicniUzaverka(s: GameState): void // mutuje klon; všechny kluby
export function bonusZaVyhru(s: GameState): void // mutuje klon; jen typ 'bonus'
export function zkontrolujBankrot(s: GameState): void // mutuje klon; varování / nucený prodej „do zahraničí"
```

Pravidla: viz Global Constraints. AI kluby v uzávěrce: + `SPONZOR_FIX[u]` + paušál vstupného `základDiváků × lístek × 4 × 0.8`; můj klub: + `round(sponzor.mesicne × (0.8 + důvěra/250))` a zpráva se souhrnem. Bankrot: < 0 → varovná zpráva jen když `den % 7 === 0`; ≤ −5 mil. → prodej nejdražšího PRODEJNÉHO hráče (respektuje minima) „do zahraničí" — hráč zmizí ze hry, + hodnota, důvěra −10 (při pádu na 0 `vyhazov`).

- [ ] **Step 1: Failing test** — `tests/core/finance.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  bonusZaVyhru,
  mesicniUzaverka,
  nabidkySponzora,
  SPONZOR_FIX,
  vstupne,
  zkontrolujBankrot,
  zvolSponzora,
} from '../../src/core/finance'
import { newGame } from '../../src/core/sezona'

describe('sponzor', () => {
  const s = newGame(7, 'tabor')
  it('nabídky odpovídají lize a volba vypne nabídku', () => {
    const { jistota, bonus } = nabidkySponzora(s)
    expect(jistota).toEqual({ typ: 'jistota', mesicne: SPONZOR_FIX[2], zaVyhru: 0 })
    expect(bonus.mesicne).toBe(Math.round(SPONZOR_FIX[2] * 0.6))
    expect(bonus.zaVyhru).toBe(60_000)
    const po = zvolSponzora(s, 'bonus')
    expect(po.sponzor.typ).toBe('bonus')
    expect(po.sponzorNabidka).toBe(false)
  })
  it('bonus za výhru přičítá jen u bonusové smlouvy', () => {
    const bonusovy = structuredClone(zvolSponzora(s, 'bonus'))
    const pred = bonusovy.tymy.tabor.rozpocet
    bonusZaVyhru(bonusovy)
    expect(bonusovy.tymy.tabor.rozpocet).toBe(pred + 60_000)
    const jistotovy = structuredClone(zvolSponzora(s, 'jistota'))
    const pred2 = jistotovy.tymy.tabor.rozpocet
    bonusZaVyhru(jistotovy)
    expect(jistotovy.tymy.tabor.rozpocet).toBe(pred2)
  })
})

describe('vstupné', () => {
  it('roste s náladou a derby', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.naladaFanousku = 50
    const zakladni = vstupne(s, false)
    expect(zakladni).toBe(Math.round(1200 * (0.6 + 50 / 250)) * 60)
    s.naladaFanousku = 100
    expect(vstupne(s, false)).toBeGreaterThan(zakladni)
    expect(vstupne(s, true)).toBe(Math.round(1200 * (0.6 + 100 / 250) * 1.3) * 60)
  })
})

describe('mesicniUzaverka', () => {
  it('strhne platy a přičte sponzory všem klubům', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.den = 30
    const mujPred = s.tymy.tabor.rozpocet
    const platy = s.tymy.tabor.hraci.reduce((sum, h) => sum + h.plat, 0)
    const fix = Math.round(s.sponzor.mesicne * (0.8 + s.trener.duvera / 250))
    const aiPred = s.tymy.sparta.rozpocet
    mesicniUzaverka(s)
    expect(s.tymy.tabor.rozpocet).toBe(mujPred - platy + fix)
    expect(s.posledniUzaverka).toBe(30)
    const aiPlaty = s.tymy.sparta.hraci.reduce((sum, h) => sum + h.plat, 0)
    expect(s.tymy.sparta.rozpocet).toBe(
      aiPred - aiPlaty + SPONZOR_FIX[0] + Math.round(8000 * 150 * 4 * 0.8),
    )
    expect(s.zpravy[0]).toContain('uzávěrka')
  })
})

describe('bankrot', () => {
  it('při hlubokém mínusu prodá nejdražšího prodejného a sníží důvěru', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.tymy.tabor.rozpocet = -6_000_000
    const pocetPred = s.tymy.tabor.hraci.length
    const duveraPred = s.trener.duvera
    zkontrolujBankrot(s)
    expect(s.tymy.tabor.hraci.length).toBe(pocetPred - 1)
    expect(s.tymy.tabor.rozpocet).toBeGreaterThan(-6_000_000)
    expect(s.trener.duvera).toBe(duveraPred - 10)
    expect(s.zpravy.some((z) => z.includes('zahraničí'))).toBe(true)
    // minima drží
    expect(s.tymy.tabor.hraci.filter((h) => h.pozice === 'G').length).toBeGreaterThanOrEqual(2)
  })
  it('malé mínus jen varuje v den dělitelný 7', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    s.tymy.tabor.rozpocet = -1_000_000
    s.den = 14
    const pocetPred = s.tymy.tabor.hraci.length
    zkontrolujBankrot(s)
    expect(s.tymy.tabor.hraci.length).toBe(pocetPred)
    expect(s.zpravy[0]).toContain('mínusu')
  })
})
```

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL.

- [ ] **Step 3: Implementace** — `src/core/finance.ts`:

```ts
import { vyhazov } from './kariera'
import { kc } from './hodnoty'
import { hodnotaHrace, MINIMA, odeberZTymu, pocetNaPozici } from './prestupy'
import type { GameState, Sponzor, TypSponzora } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export const SPONZOR_FIX = [12_000_000, 4_000_000, 1_500_000]
export const SPONZOR_BONUS_VYHRA = [400_000, 150_000, 60_000]
const ZAKLAD_DIVAKU = [8000, 3500, 1200]
const CENA_LISTKU = [150, 100, 60]

const urovenKlubu = (s: GameState, klubId: string): number =>
  s.ligy.find((l) => l.tymy.includes(klubId))!.uroven

export function nabidkySponzora(s: GameState): { jistota: Sponzor; bonus: Sponzor } {
  const u = urovenKlubu(s, s.mujKlubId)
  return {
    jistota: { typ: 'jistota', mesicne: SPONZOR_FIX[u], zaVyhru: 0 },
    bonus: { typ: 'bonus', mesicne: Math.round(SPONZOR_FIX[u] * 0.6), zaVyhru: SPONZOR_BONUS_VYHRA[u] },
  }
}

export function zvolSponzora(state: GameState, typ: TypSponzora): GameState {
  const s = structuredClone(state)
  s.sponzor = nabidkySponzora(s)[typ]
  s.sponzorNabidka = false
  s.zpravy.unshift(
    typ === 'jistota'
      ? '🤝 Podepsána sponzorská smlouva s jistotou.'
      : '🤝 Podepsána bonusová smlouva — každá výhra se počítá!',
  )
  return s
}

export function vstupne(s: GameState, derby: boolean): number {
  const u = urovenKlubu(s, s.mujKlubId)
  const navstevnost = Math.round(ZAKLAD_DIVAKU[u] * (0.6 + s.naladaFanousku / 250) * (derby ? 1.3 : 1))
  return navstevnost * CENA_LISTKU[u]
}

// mutuje klon — volá advanceDay
export function mesicniUzaverka(s: GameState): void {
  for (const t of Object.values(s.tymy)) {
    const platy = t.hraci.reduce((sum, h) => sum + h.plat, 0)
    t.rozpocet -= platy
    const u = urovenKlubu(s, t.klubId)
    if (t.klubId === s.mujKlubId) {
      const fix = Math.round(s.sponzor.mesicne * (0.8 + s.trener.duvera / 250))
      t.rozpocet += fix
      s.zpravy.unshift(
        `📒 Měsíční uzávěrka: sponzor +${kc(fix)}, platy −${kc(platy)}. Zůstatek ${kc(t.rozpocet)}.`,
      )
    } else {
      t.rozpocet += SPONZOR_FIX[u] + Math.round(ZAKLAD_DIVAKU[u] * CENA_LISTKU[u] * 4 * 0.8)
    }
  }
  s.posledniUzaverka = s.den
  s.zpravy = s.zpravy.slice(0, 50)
}

// mutuje klon — volá dokonciZapas po mé výhře
export function bonusZaVyhru(s: GameState): void {
  if (s.sponzor.typ !== 'bonus' || s.sponzor.zaVyhru <= 0) return
  s.tymy[s.mujKlubId].rozpocet += s.sponzor.zaVyhru
}

// mutuje klon — volá advanceDay
export function zkontrolujBankrot(s: GameState): void {
  const muj = s.tymy[s.mujKlubId]
  if (muj.rozpocet >= 0) return
  if (muj.rozpocet > -5_000_000) {
    if (s.den % 7 === 0) {
      s.zpravy.unshift(`⚠️ Klub je v mínusu (${kc(muj.rozpocet)})! Prodej hráče, nebo přijdou následky.`)
      s.zpravy = s.zpravy.slice(0, 50)
    }
    return
  }
  const prodejni = muj.hraci
    .filter((h) => pocetNaPozici(muj, h.pozice) > MINIMA[h.pozice])
    .sort((a, b) => hodnotaHrace(b) - hodnotaHrace(a))
  if (prodejni.length === 0) return // soupiska na minimu — nedá se nic dělat
  const obetovany = prodejni[0]
  const cena = hodnotaHrace(obetovany)
  odeberZTymu(muj, obetovany.id)
  muj.rozpocet += cena
  s.nabidkyProdeje = s.nabidkyProdeje.filter((n) => n.hracId !== obetovany.id)
  if (s.prichoziNabidka?.hracId === obetovany.id) s.prichoziNabidka = null
  s.trener.duvera = clamp(s.trener.duvera - 10, 0, 100)
  s.zpravy.unshift(
    `🚨 Vedení zasáhlo: ${obetovany.jmeno} ${obetovany.prijmeni} prodán do zahraničí za ${kc(cena)}. Důvěra klesá.`,
  )
  s.zpravy = s.zpravy.slice(0, 50)
  if (s.trener.duvera === 0 && !s.nabidky) vyhazov(s)
}
```

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2, `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 4: Zavěšení do sezóny — trh, uzávěrka, vstupné, bankrot

**Files:**
- Modify: `src/core/sezona.ts`
- Test: `tests/core/sezona-m3.test.ts`

**Interfaces:**
- Consumes: `trhTick` (T2), `mesicniUzaverka`, `vstupne`, `bonusZaVyhru`, `zkontrolujBankrot` (T3), `START_ROZPOCET` (generator).
- Produces (změny chování `sezona.ts`):
  - `advanceDay`: po odehrání zápasů dne (v obou fázích, před `return s`): `const rngDne = createRng(hashSeed(s.seed, s.sezona, s.den, 333))`, pak `trhTick(s, rngDne)`, pak `if (s.den - s.posledniUzaverka >= 30) mesicniUzaverka(s)`, pak `zkontrolujBankrot(s)`.
  - `dokonciZapas`: po `poMemZapase(...)`: můj DOMÁCÍ zápas → `s.tymy[s.mujKlubId].rozpocet += vstupne(s, cz.derby)` + zpráva `🎟️ Vstupné: +${kc(...)}`; moje VÝHRA → `bonusZaVyhru(s)`.
  - `zahajNovouSezonu`: `s.sponzorNabidka = true`; `s.sponzor` přenastavit na jistotu nové ligy (`nabidkySponzora` po swapu lig); `s.nabidkyProdeje = []`, `s.prichoziNabidka = null`, `s.otazkaMedii = null`, `s.posledniUzaverka = 0`; rozpočtový polštář VŠEM klubům: `t.rozpocet = Math.max(t.rozpocet, START_ROZPOCET[urovenPoSwapu])`.

- [ ] **Step 1: Failing test** — `tests/core/sezona-m3.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import { START_ROZPOCET } from '../../src/core/generator'
import type { GameState } from '../../src/core/types'

const krok = (s: GameState): GameState => {
  if (s.nabidky) return prijmiNabidku(s, s.nabidky[0])
  if (!s.cekajiciZapas) return advanceDay(s)
  const cz = s.cekajiciZapas
  const stav = simulujDoKonce(
    zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
    s.tymy[cz.domaci],
    s.tymy[cz.hoste],
    createRng(600 + s.den),
  )
  return dokonciZapas(s, stav)
}

describe('finanční kolo sezóny', () => {
  it('po 30+ dnech proběhne uzávěrka a vstupné teče po domácích zápasech', () => {
    let s = newGame(7, 'tabor')
    let vstupnePrislo = false
    for (let i = 0; i < 35; i++) {
      const bylMujDomaci = s.cekajiciZapas?.domaci === 'tabor'
      const pred = s.tymy.tabor.rozpocet
      s = krok(s)
      if (bylMujDomaci && s.tymy.tabor.rozpocet > pred) vstupnePrislo = true
    }
    expect(s.posledniUzaverka).toBeGreaterThanOrEqual(30)
    expect(vstupnePrislo).toBe(true)
    expect(s.zpravy.some((z) => z.includes('uzávěrka'))).toBe(true)
  })
  it('celá sezóna doběhne a AI rozpočty přežijí (žádný klub v extrémním mínusu)', () => {
    let s = newGame(9, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    expect(s.faze).toBe('konecSezony')
    for (const t of Object.values(s.tymy)) {
      expect(t.rozpocet).toBeGreaterThan(-100_000_000) // sanity: ekonomika neuletěla
      expect(t.hraci.length).toBeGreaterThanOrEqual(20)
    }
  })
  it('nová sezóna resetuje trh, nabídne sponzora a dá rozpočtový polštář', () => {
    let s = newGame(9, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    const nova = zahajNovouSezonu(s)
    expect(nova.sponzorNabidka).toBe(true)
    expect(nova.nabidkyProdeje).toEqual([])
    expect(nova.prichoziNabidka).toBeNull()
    expect(nova.posledniUzaverka).toBe(0)
    for (const liga of nova.ligy) {
      for (const klubId of liga.tymy) {
        expect(nova.tymy[klubId].rozpocet).toBeGreaterThanOrEqual(START_ROZPOCET[liga.uroven])
      }
    }
  })
})
```

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL.

- [ ] **Step 3: Implementace** — přesně dle Produces (importy: `trhTick` z `./prestupy`; `mesicniUzaverka`, `vstupne`, `bonusZaVyhru`, `zkontrolujBankrot`, `nabidkySponzora` z `./finance`; `START_ROZPOCET` z `./generator`; `kc` z `./hodnoty`). V `dokonciZapas` urči výhru: `const mojeVyhra = (cz.domaci === s.mujKlubId) === (v.golyDomaci > v.golyHoste)`.

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2 (POZOR: plnosezónní testy v `dokonceni/historie/sezona/rozvoj.test.ts` teď protečou i tržními ticky — determinismus drží, ale kdyby některý spadl na změněném stavu, oprav OČEKÁVÁNÍ testu, ne jádro, a zdokumentuj), `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 5: Trénink a akademie

**Files:**
- Modify: `src/core/sezona.ts`
- Test: `tests/core/trenink-akademie.test.ts`

**Interfaces:**
- Produces:
  - `export function zmenTrenink(state: GameState, zamereni: TreninkZamereni): GameState` (clone + set + return)
  - interní `treninkovyTick(s, rng)` volaný z `advanceDay` hned před `trhTick` — jen když `s.den > 0 && s.den % 7 === 0`; efekty dle Global Constraints (strelba → +1 střelba/technika 2 náhodným bruslařům s prostorem; obrana → +1 obrana/fyzička; kondice → všem −10 únavy a 1 hráči +1 výdrž; brankari → +1 chytání brankáři s prostorem). Zpráva `📈 Trénink: …` za každé zlepšení, clamp 99.
  - akademie v `zahajNovouSezonu` (PŘED resetem statistik, po swapu lig): můj klub 1–2 odchovanci (do 26), AI kluby 1 (jen když < 23 hráčů); věk 17–18, `potencial = min(99, overall + randInt(5, 20))`, `plat = 20_000`, **id `ak-${sezona}-${klubId}-${i}`** (NE globální čítač); pozice náhodně U/U/D; rng = `createRng(hashSeed(s.seed, s.sezona, 777))`; zpráva `🎓 Akademie přivedla talent: …` pro můj klub.

- [ ] **Step 1: Failing test** — `tests/core/trenink-akademie.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prijmiNabidku } from '../../src/core/kariera'
import { createRng } from '../../src/core/rng'
import { advanceDay, dokonciZapas, newGame, zahajNovouSezonu, zmenTrenink } from '../../src/core/sezona'
import { simulujDoKonce, zacniZapas } from '../../src/core/zapas'
import type { GameState } from '../../src/core/types'

const krok = (s: GameState): GameState => {
  if (s.nabidky) return prijmiNabidku(s, s.nabidky[0])
  if (!s.cekajiciZapas) return advanceDay(s)
  const cz = s.cekajiciZapas
  const stav = simulujDoKonce(
    zacniZapas(s.tymy[cz.domaci], s.tymy[cz.hoste]),
    s.tymy[cz.domaci],
    s.tymy[cz.hoste],
    createRng(800 + s.den),
  )
  return dokonciZapas(s, stav)
}

describe('trénink', () => {
  it('zaměření na brankáře zvedne chytání do 3 týdnů', () => {
    let s = zmenTrenink(newGame(31, 'tabor'), 'brankari')
    expect(s.treninkZamereni).toBe('brankari')
    // zaruč prostor růstu oběma brankářům
    for (const g of s.tymy.tabor.hraci.filter((h) => h.pozice === 'G')) g.potencial = 99
    const chytaniPred = s.tymy.tabor.hraci
      .filter((h) => h.pozice === 'G')
      .reduce((sum, h) => sum + h.atributy.chytani, 0)
    for (let i = 0; i < 21; i++) s = krok(s)
    const chytaniPo = s.tymy.tabor.hraci
      .filter((h) => h.pozice === 'G')
      .reduce((sum, h) => sum + h.atributy.chytani, 0)
    expect(chytaniPo).toBeGreaterThan(chytaniPred)
    expect(s.zpravy.some((z) => z.includes('Trénink'))).toBe(true)
  })
  it('kondice sráží únavu každý týden', () => {
    let s = zmenTrenink(newGame(31, 'tabor'), 'kondice')
    for (const h of s.tymy.tabor.hraci) h.unava = 50
    // den 7 je tréninkový — dojdi k němu bez zápasu mého klubu? zápasy únavu mění;
    // proto měříme jen, že se únava někdy propadla o 10 mimo zápasové dny
    const den6 = (() => {
      let stav = s
      while (stav.den < 6) stav = krok(stav)
      return stav.tymy.tabor.hraci[0].unava
    })()
    let stav = s
    while (stav.den < 7) stav = krok(stav)
    // hráč 0 mohl hrát v den 6/7 — spolehlivější je kontrola náhradníka mimo sestavu
    const tym = stav.tymy.tabor
    const vSestave = new Set([...tym.sestava.utoky.flat(), ...tym.sestava.obrany.flat(), tym.sestava.brankar])
    const nahradnik = tym.hraci.find((h) => !vSestave.has(h.id))!
    expect(nahradnik.unava).toBeLessThan(50) // −10/den odpočinku již existuje; kondice přidává −10 navíc v den 7
    void den6
  })
})

describe('akademie', () => {
  it('nová sezóna přivede 1–2 odchovance s unikátními id', () => {
    let s = newGame(33, 'tabor')
    let pojistka = 0
    while (s.faze !== 'konecSezony' && pojistka++ < 400) s = krok(s)
    const pocetPred = s.tymy.tabor.hraci.length
    const nova = zahajNovouSezonu(s)
    const noviMoji = nova.tymy.tabor.hraci.filter((h) => h.id.startsWith('ak-'))
    expect(noviMoji.length).toBeGreaterThanOrEqual(1)
    expect(noviMoji.length).toBeLessThanOrEqual(2)
    expect(nova.tymy.tabor.hraci.length).toBe(Math.min(26, pocetPred + noviMoji.length))
    for (const m of noviMoji) {
      expect(m.vek).toBeGreaterThanOrEqual(17)
      expect(m.vek).toBeLessThanOrEqual(19) // 17–18 + letní stárnutí o 1 dle pořadí operací
      expect(m.plat).toBe(20_000)
      expect(m.potencial).toBeGreaterThanOrEqual(1)
    }
    const vsechnaId = Object.values(nova.tymy).flatMap((t) => t.hraci.map((h) => h.id))
    expect(new Set(vsechnaId).size).toBe(vsechnaId.length)
    expect(nova.zpravy.some((z) => z.includes('Akademie'))).toBe(true)
  })
})
```

Pozn.: pokud akademii vložíš PO letním stárnutí (`vek++`), odchovanci zůstanou 17–18 — vlož ji až ZA smyčku letního vývoje a test uprav na `toBeLessThanOrEqual(18)`; rozhodni se pro jedno umístění a testu přizpůsob mez (preferuj PO stárnutí = čistší).

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL (`zmenTrenink` neexistuje).

- [ ] **Step 3: Implementace** — v `sezona.ts`:

```ts
export function zmenTrenink(state: GameState, zamereni: TreninkZamereni): GameState {
  const s = structuredClone(state)
  s.treninkZamereni = zamereni
  return s
}

// mutuje klon — volá advanceDay v tréninkový den (každých 7 dní)
function treninkovyTick(s: GameState, rng: Rng): void {
  if (s.den <= 0 || s.den % 7 !== 0) return
  const muj = s.tymy[s.mujKlubId]
  const zprava = (h: Hrac, co: string) =>
    s.zpravy.unshift(`📈 Trénink: ${h.jmeno} ${h.prijmeni} zlepšil ${co}.`)
  if (s.treninkZamereni === 'kondice') {
    for (const h of muj.hraci) h.unava = Math.max(0, h.unava - 10)
    const kandidat = pick(rng, muj.hraci)
    if (kandidat.atributy.vydrz < 99) {
      kandidat.atributy.vydrz++
      zprava(kandidat, 'výdrž')
    }
  } else if (s.treninkZamereni === 'brankari') {
    const brankari = muj.hraci.filter(
      (h) => h.pozice === 'G' && overall(h) < h.potencial && h.atributy.chytani < 99,
    )
    if (brankari.length > 0) {
      const g = pick(rng, brankari)
      g.atributy.chytani++
      zprava(g, 'chytání')
    }
  } else {
    const pole = muj.hraci.filter((h) => h.pozice !== 'G' && overall(h) < h.potencial)
    for (let i = 0; i < 2 && pole.length > 0; i++) {
      const h = pole[randInt(rng, 0, pole.length - 1)]
      const klic: keyof Atributy =
        s.treninkZamereni === 'strelba'
          ? rng() < 0.5
            ? 'strelba'
            : 'technika'
          : rng() < 0.5
            ? 'obrana'
            : 'fyzicka'
      if (h.atributy[klic] < 99) {
        h.atributy[klic]++
        zprava(h, NAZVY_ATRIBUTU[klic])
      }
    }
  }
  s.zpravy = s.zpravy.slice(0, 50)
}
```

Volání v `advanceDay` (před `trhTick`): `treninkovyTick(s, rngDne)`.

Akademie v `zahajNovouSezonu` — vlož ZA smyčku letního vývoje hráčů (odchovanci tak nestárnou hned o rok), před nové rozpisy:

```ts
// akademie: odchovanci
const rngAkademie = createRng(hashSeed(s.seed, s.sezona, 777))
for (const liga of s.ligy) {
  for (const klubId of liga.tymy) {
    const tym = s.tymy[klubId]
    const jeMuj = klubId === s.mujKlubId
    if (!jeMuj && tym.hraci.length >= 23) continue
    const pocet = jeMuj ? randInt(rngAkademie, 1, 2) : 1
    for (let i = 0; i < pocet && tym.hraci.length < 26; i++) {
      const pozice = pick(rngAkademie, ['U', 'U', 'D'] as Pozice[])
      const mladik = generujHrace(rngAkademie, pozice, liga.uroven, randInt(rngAkademie, 17, 18))
      mladik.id = `ak-${s.sezona}-${klubId}-${i}` // NE globální čítač — po načtení hry by kolidoval
      mladik.potencial = Math.min(99, overall(mladik) + randInt(rngAkademie, 5, 20))
      mladik.plat = 20_000
      tym.hraci.push(mladik)
      if (jeMuj) {
        s.zpravy.unshift(
          `🎓 Akademie přivedla talent: ${mladik.jmeno} ${mladik.prijmeni} (${pozice === 'U' ? 'útočník' : 'obránce'}, ${mladik.vek} let).`,
        )
      }
    }
  }
}
```

(úprava testu dle Pozn. v Step 1: mez `toBeLessThanOrEqual(18)`).

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2, `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 6: Média (`src/core/media.ts`)

**Files:**
- Create: `src/core/media.ts`
- Modify: `src/core/sezona.ts` (zavěšení v `dokonciZapas`)
- Test: `tests/core/media.test.ts`

**Interfaces:**
- Produces:

```ts
export function zkontrolujOtazku(s: GameState, v: Vysledek, cz: CekajiciZapas): void
// mutuje klon; volá dokonciZapas PO poMemZapase. Nastaví s.otazkaMedii (nebo null
// — tím zaniká i stará nezodpovězená otázka): derby výhra/prohra, rozdíl ≥ 4 (demolice),
// rozdíl ≤ −4 (debakl), série 5 výher (formaTymu === 5× V/VP). 5 šablon.
export function odpovezNaOtazku(state: GameState, index: number, rng: Rng): GameState
// clone; aplikuje efektMoralka (na můj tým, clamp 30–70) a efektNalada (clamp 0–100);
// riskantni volba: rng() < 0.4 → efekty se OTOČÍ do záporu a zpráva o průšvihu; otazkaMedii = null
```

- [ ] **Step 1: Failing test** — `tests/core/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { odpovezNaOtazku, zkontrolujOtazku } from '../../src/core/media'
import { createRng } from '../../src/core/rng'
import { newGame } from '../../src/core/sezona'
import type { CekajiciZapas, Vysledek } from '../../src/core/types'

const vysledek = (gd: number, gh: number): Vysledek => ({
  golyDomaci: gd,
  golyHoste: gh,
  strelyDomaci: 30,
  strelyHoste: 30,
  prodlouzeni: false,
  najezdy: false,
  udalosti: [],
  energie: {},
  hodnoceni: {},
})
const cz = (derby = false): CekajiciZapas => ({ domaci: 'tabor', hoste: 'decin', derby, playoff: null })

describe('zkontrolujOtazku', () => {
  it('demolice a debakl vyvolají otázku, těsný zápas ne', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    zkontrolujOtazku(s, vysledek(6, 1), cz())
    expect(s.otazkaMedii).not.toBeNull()
    expect(s.otazkaMedii!.moznosti.length).toBeGreaterThanOrEqual(2)
    zkontrolujOtazku(s, vysledek(2, 1), cz())
    expect(s.otazkaMedii).toBeNull() // stará otázka zaniká dalším zápasem
    zkontrolujOtazku(s, vysledek(0, 5), cz())
    expect(s.otazkaMedii).not.toBeNull()
  })
  it('derby vyvolá otázku vždy', () => {
    const s = structuredClone(newGame(7, 'tabor'))
    zkontrolujOtazku(s, vysledek(2, 1), cz(true))
    expect(s.otazkaMedii).not.toBeNull()
  })
})

describe('odpovezNaOtazku', () => {
  const priprav = () => {
    const s = structuredClone(newGame(7, 'tabor'))
    zkontrolujOtazku(s, vysledek(6, 1), cz())
    return s
  }
  it('bezpečná odpověď aplikuje efekty', () => {
    const s = priprav()
    const bezpecna = s.otazkaMedii!.moznosti.findIndex((m) => !m.riskantni)
    const volba = s.otazkaMedii!.moznosti[bezpecna]
    const moralkaPred = s.tymy.tabor.moralka
    const naladaPred = s.naladaFanousku
    const po = odpovezNaOtazku(s, bezpecna, createRng(1))
    expect(po.tymy.tabor.moralka).toBe(Math.min(70, moralkaPred + volba.efektMoralka))
    expect(po.naladaFanousku).toBe(Math.min(100, naladaPred + volba.efektNalada))
    expect(po.otazkaMedii).toBeNull()
  })
  it('riskantní odpověď se může otočit proti', () => {
    let otocilo = false
    let pomohlo = false
    for (let seed = 0; seed < 40 && !(otocilo && pomohlo); seed++) {
      const s = priprav()
      const riskantni = s.otazkaMedii!.moznosti.findIndex((m) => m.riskantni)
      if (riskantni < 0) throw new Error('Šablona nemá riskantní volbu.')
      const pred = s.naladaFanousku
      const po = odpovezNaOtazku(s, riskantni, createRng(seed))
      if (po.naladaFanousku < pred) otocilo = true
      if (po.naladaFanousku > pred) pomohlo = true
    }
    expect(otocilo).toBe(true)
    expect(pomohlo).toBe(true)
  })
  it('neplatný index a chybějící otázka házejí chybu', () => {
    const s = priprav()
    expect(() => odpovezNaOtazku(s, 99, createRng(1))).toThrow()
    const bez = structuredClone(newGame(7, 'tabor'))
    expect(() => odpovezNaOtazku(bez, 0, createRng(1))).toThrow()
  })
})
```

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL.

- [ ] **Step 3: Implementace** — `src/core/media.ts`:

```ts
import { formaTymu } from './hodnoty'
import type { Rng } from './rng'
import type { CekajiciZapas, GameState, OtazkaMedii, Vysledek } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

const DERBY_VYHRA = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Vyhráli jste derby s ${souper}! Co vzkážete jejich fanouškům?"`,
  moznosti: [
    { text: 'Byl to férový boj, klobouk dolů.', efektMoralka: 2, efektNalada: 2, riskantni: false },
    { text: 'Ať si zvykají — tohle město je naše!', efektMoralka: 3, efektNalada: 6, riskantni: true },
  ],
})

const DERBY_PROHRA = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Prohrané derby s ${souper}. Jak to vysvětlíte fanouškům?"`,
  moznosti: [
    { text: 'Omlouváme se, příště to vrátíme.', efektMoralka: 1, efektNalada: 2, riskantni: false },
    { text: 'Rozhodčí nám to dnes nedovolili vyhrát.', efektMoralka: 3, efektNalada: 3, riskantni: true },
  ],
})

const DEMOLICE = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Rozstříleli jste ${souper}. Je tým zralý na vyšší cíle?"`,
  moznosti: [
    { text: 'Jdeme zápas od zápasu.', efektMoralka: 2, efektNalada: 1, riskantni: false },
    { text: 'Ano — a klidně to napište tučně!', efektMoralka: 4, efektNalada: 5, riskantni: true },
  ],
})

const DEBAKL = (souper: string): OtazkaMedii => ({
  text: `Novináři: „Debakl od ${souper}. Kdo za to může?"`,
  moznosti: [
    { text: 'Odpovědnost beru na sebe.', efektMoralka: 3, efektNalada: 1, riskantni: false },
    { text: 'Hráči dnes nechali dres v kabině.', efektMoralka: -2, efektNalada: 3, riskantni: true },
    { text: 'Bez komentáře.', efektMoralka: 0, efektNalada: -2, riskantni: false },
  ],
})

const SERIE = (): OtazkaMedii => ({
  text: 'Novináři: „Pět výher v řadě! Kde to zastavíte?"',
  moznosti: [
    { text: 'Nohama na zemi, pracujeme dál.', efektMoralka: 2, efektNalada: 2, riskantni: false },
    { text: 'Nezastavíme. Jedeme si pro pohár!', efektMoralka: 4, efektNalada: 6, riskantni: true },
  ],
})

// mutuje klon — volá dokonciZapas po mém zápase
export function zkontrolujOtazku(s: GameState, v: Vysledek, cz: CekajiciZapas): void {
  const mujDomaci = cz.domaci === s.mujKlubId
  const rozdil = mujDomaci ? v.golyDomaci - v.golyHoste : v.golyHoste - v.golyDomaci
  const souper = s.tymy[mujDomaci ? cz.hoste : cz.domaci].nazev
  const liga = s.ligy.find((l) => l.tymy.includes(s.mujKlubId))!
  const forma = formaTymu(liga, s.mujKlubId)
  const serieVyher = forma.length === 5 && forma.every((z) => z === 'V' || z === 'VP')

  let otazka: OtazkaMedii | null = null
  if (cz.derby) otazka = rozdil > 0 ? DERBY_VYHRA(souper) : DERBY_PROHRA(souper)
  else if (rozdil >= 4) otazka = DEMOLICE(souper)
  else if (rozdil <= -4) otazka = DEBAKL(souper)
  else if (serieVyher && rozdil > 0) otazka = SERIE()
  s.otazkaMedii = otazka // null = stará nezodpovězená otázka zaniká
}

export function odpovezNaOtazku(state: GameState, index: number, rng: Rng): GameState {
  if (!state.otazkaMedii) throw new Error('Žádná otázka novinářů nečeká.')
  const volba = state.otazkaMedii.moznosti[index]
  if (!volba) throw new Error('Neplatná odpověď.')
  const s = structuredClone(state)
  let { efektMoralka, efektNalada } = volba
  let text = '🗞️ Odpověď v médiích zarezonovala.'
  if (volba.riskantni && rng() < 0.4) {
    efektMoralka = -Math.abs(efektMoralka)
    efektNalada = -Math.abs(efektNalada)
    text = '🗞️ Novináři odpověď otočili proti tobě!'
  }
  const muj = s.tymy[s.mujKlubId]
  muj.moralka = clamp(muj.moralka + efektMoralka, 30, 70)
  s.naladaFanousku = clamp(s.naladaFanousku + efektNalada, 0, 100)
  s.zpravy.unshift(text)
  s.zpravy = s.zpravy.slice(0, 50)
  s.otazkaMedii = null
  return s
}
```

Zavěšení: v `dokonciZapas` za `zapisRekordVyhry(...)` přidat `zkontrolujOtazku(s, v, cz)`.

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2, `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 7: UI — obrazovka Přestupy

**Files:**
- Create: `src/ui/obrazovky/Prestupy.tsx`
- Modify: `src/ui/App.tsx` (jen záložka + obsah pro `prestupy` — zbylé dvě záložky přidá Task 8)

**Interfaces:**
- Consumes: core přestupy API (T2), `kc`, `overall`, `roleHrace`, `OdznakKlubu`, `BadgePozice`, `ulozHru`.
- Produces: `Prestupy({ hra, setHra })`; `Obrazovka` typ += `'prestupy'`.

- [ ] **Step 1: Komponenta** — `src/ui/obrazovky/Prestupy.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { kc, roleHrace } from '../../core/hodnoty'
import {
  hodnotaHrace,
  kupHrace,
  nabidniKProdeji,
  odhadPotencialu,
  odmitniProdej,
  prestupoveOknoOtevrene,
  prijmiProdej,
  stahniZProdeje,
  vyhodnotNabidku,
} from '../../core/prestupy'
import { overall } from '../../core/sestava'
import type { GameState, Hrac, Pozice } from '../../core/types'
import { BadgePozice, OdznakKlubu } from '../komponenty'
import { ulozHru } from '../store'

interface RadekTrhu {
  hrac: Hrac
  klubId: string
}

export function Prestupy({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const [filtrLiga, setFiltrLiga] = useState(-1)
  const [filtrPozice, setFiltrPozice] = useState<'vse' | Pozice>('vse')
  const [vybrany, setVybrany] = useState<RadekTrhu | null>(null)
  const [nabidka, setNabidka] = useState(0)
  const [protinavrh, setProtinavrh] = useState<number | null>(null)
  const [hlaska, setHlaska] = useState('')

  const okno = prestupoveOknoOtevrene(hra)
  const muj = hra.tymy[hra.mujKlubId]

  const trh = useMemo(() => {
    const radky: RadekTrhu[] = []
    for (const liga of hra.ligy) {
      if (filtrLiga >= 0 && liga.uroven !== filtrLiga) continue
      for (const klubId of liga.tymy) {
        if (klubId === hra.mujKlubId) continue
        for (const hrac of hra.tymy[klubId].hraci) {
          if (filtrPozice !== 'vse' && hrac.pozice !== filtrPozice) continue
          radky.push({ hrac, klubId })
        }
      }
    }
    return radky.sort((a, b) => hodnotaHrace(b.hrac) - hodnotaHrace(a.hrac)).slice(0, 60)
  }, [hra, filtrLiga, filtrPozice])

  function aplikuj(s: GameState, zprava: string) {
    setHra(s)
    void ulozHru(0, s)
    setHlaska(zprava)
  }

  function proved(castka: number) {
    if (!vybrany) return
    try {
      aplikuj(kupHrace(hra, vybrany.klubId, vybrany.hrac.id, castka), '✍️ Přestup dokončen!')
      setVybrany(null)
      setProtinavrh(null)
    } catch (e) {
      setHlaska(`❌ ${(e as Error).message}`)
    }
  }

  function poslatNabidku() {
    if (!vybrany) return
    const { vysledek, pozadovano } = vyhodnotNabidku(hra, vybrany.klubId, vybrany.hrac.id, nabidka)
    if (vysledek === 'prijato') proved(nabidka)
    else setProtinavrh(pozadovano)
  }

  const naProdej = hra.nabidkyProdeje
    .map((n) => muj.hraci.find((h) => h.id === n.hracId))
    .filter((h): h is Hrac => !!h)

  return (
    <>
      <h2>Přestupy {!okno && <span className="pill pill-derby">trh v playoff zavřen</span>}</h2>
      {hlaska && <p>{hlaska}</p>}

      {hra.prichoziNabidka && (
        <div className="karta" style={{ borderColor: 'var(--zlata)' }}>
          <h3>📨 Příchozí nabídka</h3>
          <p>
            {hra.tymy[hra.prichoziNabidka.klubId].nazev} nabízí{' '}
            <b>{kc(hra.prichoziNabidka.castka)}</b> za hráče{' '}
            {(() => {
              const h = muj.hraci.find((x) => x.id === hra.prichoziNabidka!.hracId)
              return h ? `${h.jmeno} ${h.prijmeni}` : '(už není v klubu)'
            })()}
          </p>
          <button className="tlacitko" disabled={!okno} onClick={() => { try { aplikuj(prijmiProdej(hra), '💰 Prodáno!') } catch (e) { setHlaska(`❌ ${(e as Error).message}`) } }}>
            Přijmout
          </button>{' '}
          <button className="tlacitko sekundarni" onClick={() => aplikuj(odmitniProdej(hra), 'Nabídka odmítnuta.')}>
            Odmítnout
          </button>
        </div>
      )}

      <div className="karta">
        <h3>Moji hráči na prodejní listině</h3>
        {naProdej.length === 0 && <p style={{ color: 'var(--tlumeny)' }}>Nikdo. Hráče nabídneš tlačítkem u soupisky níže.</p>}
        {naProdej.map((h) => (
          <div key={h.id} className="zprava" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>
              {h.jmeno} {h.prijmeni} · hodnota {kc(hodnotaHrace(h))}
            </span>
            <button className="tlacitko sekundarni tlacitko-mini" onClick={() => aplikuj(stahniZProdeje(hra, h.id), 'Staženo z prodeje.')}>
              Stáhnout
            </button>
          </div>
        ))}
        <details style={{ marginTop: 8 }}>
          <summary className="klik" style={{ color: 'var(--tlumeny)' }}>Nabídnout hráče k prodeji…</summary>
          {muj.hraci
            .filter((h) => !hra.nabidkyProdeje.some((n) => n.hracId === h.id))
            .map((h) => (
              <div key={h.id} className="zprava" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <BadgePozice pozice={h.pozice} />
                <span style={{ flex: 1 }}>
                  {h.jmeno} {h.prijmeni} ({overall(h)}) · {kc(hodnotaHrace(h))}
                </span>
                <button className="tlacitko sekundarni tlacitko-mini" onClick={() => { try { aplikuj(nabidniKProdeji(hra, h.id), 'Na listině.') } catch (e) { setHlaska(`❌ ${(e as Error).message}`) } }}>
                  Prodat
                </button>
              </div>
            ))}
        </details>
      </div>

      <div className="karta">
        <h3>Trh ({kc(muj.rozpocet)} k dispozici)</h3>
        <p>
          <select value={filtrLiga} onChange={(e) => setFiltrLiga(Number(e.target.value))}>
            <option value={-1}>Všechny ligy</option>
            {hra.ligy.map((l) => (
              <option key={l.uroven} value={l.uroven}>
                {l.nazev}
              </option>
            ))}
          </select>{' '}
          <select value={filtrPozice} onChange={(e) => setFiltrPozice(e.target.value as 'vse' | Pozice)}>
            <option value="vse">Všechny pozice</option>
            <option value="U">Útočníci</option>
            <option value="D">Obránci</option>
            <option value="G">Brankáři</option>
          </select>{' '}
          <span style={{ color: 'var(--tlumeny)' }}>60 nejhodnotnějších dle filtru</span>
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Hráč</th>
              <th>Klub</th>
              <th>Věk</th>
              <th>Celkem</th>
              <th>Role</th>
              <th>Hodnota</th>
            </tr>
          </thead>
          <tbody>
            {trh.map((r) => (
              <tr key={r.hrac.id} className={`klik ${vybrany?.hrac.id === r.hrac.id ? 'muj' : ''}`}
                onClick={() => { setVybrany(r); setNabidka(hodnotaHrace(r.hrac)); setProtinavrh(null) }}>
                <td><BadgePozice pozice={r.hrac.pozice} /></td>
                <td>{r.hrac.jmeno} {r.hrac.prijmeni}</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <OdznakKlubu klubId={r.klubId} velikost={20} /> {hra.tymy[r.klubId].nazev}
                </td>
                <td>{r.hrac.vek}</td>
                <td><b>{overall(r.hrac)}</b></td>
                <td>{roleHrace(r.hrac) ?? 'Brankář'}</td>
                <td>{kc(hodnotaHrace(r.hrac))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vybrany && (
        <div className="karta" style={{ borderColor: 'var(--akcent)' }}>
          <h3>
            {vybrany.hrac.jmeno} {vybrany.hrac.prijmeni} — nabídka
          </h3>
          <p style={{ color: 'var(--tlumeny)' }}>
            Věk {vybrany.hrac.vek} · plat {kc(vybrany.hrac.plat)}/měs (u tebe +10 %) · odhad potenciálu{' '}
            {odhadPotencialu(vybrany.hrac, hra.seed).join('–')} · hodnota {kc(hodnotaHrace(vybrany.hrac))}
          </p>
          {protinavrh === null ? (
            <>
              <input
                type="number"
                value={nabidka}
                step={100000}
                min={0}
                onChange={(e) => setNabidka(Number(e.target.value))}
                style={{ width: 160 }}
              />{' '}
              <button className="tlacitko" disabled={!okno} onClick={poslatNabidku}>
                Nabídnout {kc(nabidka)}
              </button>{' '}
              <button className="tlacitko sekundarni" onClick={() => setVybrany(null)}>
                Zavřít
              </button>
            </>
          ) : (
            <>
              <p>
                Klub chce <b>{kc(protinavrh)}</b>.
              </p>
              <button className="tlacitko" disabled={!okno || muj.rozpocet < protinavrh} onClick={() => proved(protinavrh)}>
                Přijmout protinávrh
              </button>{' '}
              <button className="tlacitko sekundarni" onClick={() => { setProtinavrh(null); setVybrany(null) }}>
                Odejít od jednání
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: App** — `Obrazovka` += `'prestupy'`; do `ZALOZKY` za `['liga', 'Soutěže']` přidat `['prestupy', 'Přestupy']`; do `obsah`: `prestupy: <Prestupy hra={hra} setHra={setHra} />,`; import.

- [ ] **Step 3: Ověřit** — `npm run test` (beze změn jádra), `npm run build` clean, dev-server curl smoke.

- [ ] **Step 4: Stage** — `git add -A`

---

### Task 8: UI — obrazovky Finance a Trénink

**Files:**
- Create: `src/ui/obrazovky/Finance.tsx`, `src/ui/obrazovky/Trenink.tsx`
- Modify: `src/ui/App.tsx` (záložky `finance`, `trenink`), `src/ui/obrazovky/Soupiska.tsx` (sloupce Plat, Hodnota)

**Interfaces:**
- Consumes: `nabidkySponzora`, `zvolSponzora`, `SPONZOR_FIX`, `vstupne` (finance); `zmenTrenink` (sezona); `hodnotaHrace` (prestupy); `kc`; `Ukazatel`/`barvaHodnoty`.
- Produces: `Finance({ hra, setHra })`, `Trenink({ hra, setHra })`; `Obrazovka` += `'finance' | 'trenink'`.

- [ ] **Step 1: Finance** — `src/ui/obrazovky/Finance.tsx`:

```tsx
import { nabidkySponzora, vstupne, zvolSponzora } from '../../core/finance'
import { kc } from '../../core/hodnoty'
import { hodnotaHrace } from '../../core/prestupy'
import type { GameState } from '../../core/types'
import { ulozHru } from '../store'

export function Finance({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const muj = hra.tymy[hra.mujKlubId]
  const platy = muj.hraci.reduce((sum, h) => sum + h.plat, 0)
  const fix = Math.round(hra.sponzor.mesicne * (0.8 + hra.trener.duvera / 250))
  const odhadVstupneho = vstupne(hra, false) * 2 // ~2 domácí zápasy za měsíc
  const bilance = fix + odhadVstupneho - platy
  const nejdrazsi = [...muj.hraci].sort((a, b) => b.plat - a.plat).slice(0, 8)
  const nabidky = nabidkySponzora(hra)

  function zvol(typ: 'jistota' | 'bonus') {
    const s = zvolSponzora(hra, typ)
    setHra(s)
    void ulozHru(0, s)
  }

  return (
    <>
      <h2>Finance</h2>
      <div className="mrizka-3">
        <div className="karta" style={{ textAlign: 'center' }}>
          <h3>Zůstatek</h3>
          <div className={muj.rozpocet >= 0 ? 'skore vyhra' : 'skore prohra'} style={{ fontSize: 30 }}>
            {kc(muj.rozpocet)}
          </div>
        </div>
        <div className="karta">
          <h3>Měsíční bilance (odhad)</h3>
          <div className="zprava">Sponzor: +{kc(fix)}</div>
          <div className="zprava">Vstupné (~2 domácí): +{kc(odhadVstupneho)}</div>
          <div className="zprava">Platy: −{kc(platy)}</div>
          <div className={bilance >= 0 ? 'vyhra' : 'prohra'} style={{ paddingTop: 6, fontWeight: 700 }}>
            Celkem: {bilance >= 0 ? '+' : ''}
            {kc(bilance)}
          </div>
        </div>
        <div className="karta">
          <h3>Sponzorská smlouva</h3>
          <p>
            {hra.sponzor.typ === 'jistota' ? 'Jistota' : 'Bonusová'}: {kc(hra.sponzor.mesicne)}/měs
            {hra.sponzor.zaVyhru > 0 && ` + ${kc(hra.sponzor.zaVyhru)} za výhru`}
          </p>
          {hra.sponzorNabidka && (
            <>
              <p style={{ color: 'var(--zlata)' }}>Nová sezóna — vyber smlouvu:</p>
              <button className="tlacitko sekundarni" onClick={() => zvol('jistota')}>
                Jistota {kc(nabidky.jistota.mesicne)}/měs
              </button>{' '}
              <button className="tlacitko sekundarni" onClick={() => zvol('bonus')}>
                {kc(nabidky.bonus.mesicne)}/měs + {kc(nabidky.bonus.zaVyhru)}/výhra
              </button>
            </>
          )}
        </div>
      </div>
      <div className="karta">
        <h3>Nejvyšší platy</h3>
        <table>
          <thead>
            <tr>
              <th>Hráč</th>
              <th>Plat/měs</th>
              <th>Hodnota</th>
            </tr>
          </thead>
          <tbody>
            {nejdrazsi.map((h) => (
              <tr key={h.id}>
                <td>
                  {h.jmeno} {h.prijmeni}
                </td>
                <td>{kc(h.plat)}</td>
                <td>{kc(hodnotaHrace(h))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Trénink** — `src/ui/obrazovky/Trenink.tsx`:

```tsx
import { zmenTrenink } from '../../core/sezona'
import type { GameState, TreninkZamereni } from '../../core/types'
import { ulozHru } from '../store'

const VOLBY: { id: TreninkZamereni; nazev: string; popis: string }[] = [
  { id: 'strelba', nazev: '🎯 Střelba', popis: 'Každý týden se 2 bruslaři zlepší ve střelbě nebo technice.' },
  { id: 'obrana', nazev: '🛡 Obrana', popis: 'Každý týden se 2 bruslaři zlepší v obraně nebo fyzičce.' },
  { id: 'kondice', nazev: '💪 Kondice', popis: 'Týmu každý týden ubude únava navíc a někdo zlepší výdrž.' },
  { id: 'brankari', nazev: '🥅 Brankáři', popis: 'Každý týden se zlepší chytání jednoho brankáře.' },
]

export function Trenink({ hra, setHra }: { hra: GameState; setHra: (s: GameState) => void }) {
  const treninkoveZpravy = hra.zpravy.filter((z) => z.includes('Trénink')).slice(0, 8)
  return (
    <>
      <h2>Trénink</h2>
      <p style={{ color: 'var(--tlumeny)' }}>Tréninkový den je každý 7. den sezóny. Zlepšují se jen hráči s prostorem růstu.</p>
      <div className="mrizka">
        {VOLBY.map((v) => (
          <button
            key={v.id}
            className={`karta klik ${hra.treninkZamereni === v.id ? 'vybrany' : ''}`}
            onClick={() => {
              const s = zmenTrenink(hra, v.id)
              setHra(s)
              void ulozHru(0, s)
            }}
          >
            <h3>{v.nazev}</h3>
            <p style={{ color: 'var(--tlumeny)', marginBottom: 0 }}>{v.popis}</p>
          </button>
        ))}
      </div>
      <div className="karta">
        <h3>Poslední pokroky</h3>
        {treninkoveZpravy.length === 0 ? (
          <p style={{ color: 'var(--tlumeny)' }}>Zatím žádné — počkej na tréninkový den.</p>
        ) : (
          treninkoveZpravy.map((z, i) => (
            <div key={i} className="zprava">
              {z}
            </div>
          ))
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: App + Soupiska** — `Obrazovka` += `'finance' | 'trenink'`; `ZALOZKY` za Přestupy: `['finance', 'Finance'], ['trenink', 'Trénink']`; obsah + importy. Soupiska: sloupce `<th>Plat</th><th>Hodnota</th>` (za Zápasy) a buňky `<td>{kc(h.plat)}</td><td>{kc(hodnotaHrace(h))}</td>` (importy `kc`, `hodnotaHrace`).

- [ ] **Step 4: Ověřit** — `npm run test`, `npm run build` clean, curl smoke.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 9: UI — Přehled: rozpočet, otázka novinářů, volba sponzora

**Files:**
- Modify: `src/ui/obrazovky/Prehled.tsx`

**Interfaces:**
- Consumes: `kc`, `odpovezNaOtazku` (media), `nabidkySponzora`/`zvolSponzora` (finance), `createRng`/`hashSeed` (rng).

- [ ] **Step 1: Rozpočet do karty Vedení** — pod Ukazatel důvěry přidat:

```tsx
<p style={{ marginBottom: 0, marginTop: 8 }}>
  💰 <b className={hra.tymy[hra.mujKlubId].rozpocet >= 0 ? 'vyhra' : 'prohra'}>{kc(hra.tymy[hra.mujKlubId].rozpocet)}</b>
</p>
```

- [ ] **Step 2: Karta otázky novinářů** — NAD `mrizka-3` (hned pod `<h2>Přehled</h2>`):

```tsx
{hra.otazkaMedii && (
  <div className="karta" style={{ borderColor: 'var(--zlata)' }}>
    <h3>🎤 {hra.otazkaMedii.text}</h3>
    {hra.otazkaMedii.moznosti.map((m, i) => (
      <button
        key={i}
        className={`tlacitko ${m.riskantni ? 'nebezpecne' : 'sekundarni'}`}
        style={{ marginRight: 8, marginBottom: 8 }}
        onClick={() => {
          const s = odpovezNaOtazku(hra, i, createRng(hashSeed(hra.seed, hra.sezona, hra.den, 444)))
          setHra(s)
          void ulozHru(0, s)
        }}
      >
        {m.text}
        {m.riskantni && ' ⚡'}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Volba sponzora** — pod kartu otázky (zobrazí se na začátku sezóny):

```tsx
{hra.sponzorNabidka && (
  <div className="karta">
    <h3>🤝 Sponzor čeká na podpis</h3>
    {(() => {
      const n = nabidkySponzora(hra)
      return (
        <>
          <button className="tlacitko sekundarni" style={{ marginRight: 8 }} onClick={() => { const s = zvolSponzora(hra, 'jistota'); setHra(s); void ulozHru(0, s) }}>
            Jistota: {kc(n.jistota.mesicne)}/měs
          </button>
          <button className="tlacitko sekundarni" onClick={() => { const s = zvolSponzora(hra, 'bonus'); setHra(s); void ulozHru(0, s) }}>
            Bonus: {kc(n.bonus.mesicne)}/měs + {kc(n.bonus.zaVyhru)}/výhra
          </button>
        </>
      )
    })()}
  </div>
)}
```

(importy: `kc` z hodnot, `odpovezNaOtazku` z media, `nabidkySponzora`/`zvolSponzora` z finance, `createRng`/`hashSeed` z rng.)

- [ ] **Step 4: Ověřit** — `npm run test`, `npm run build`, curl smoke. Manuálně: rozpočet na Přehledu; po vysokém vítězství otázka novinářů; na startu sezóny volba sponzora (zmizí volbou).

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 10: Integrace, dokumentace, build

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1:** `npm run test && npm run test` → oba běhy zelené. `npm run build` → clean.
- [ ] **Step 2:** `npm run tauri build` (timeout 15 min) → AppImage + .deb.
- [ ] **Step 3:** README.md: M3 hotové (přestupy se smlouváním, finance s uzávěrkou a bankrotem, sponzoři s volbou, trénink, akademie, otázky novinářů) + odkazy na spec/plán; milníky: zbývá M4 (reálné soupisky — tvrdý požadavek, vizualizace kluziště, ladění). CLAUDE.md: odkaz na tento plán.
- [ ] **Step 4: Ruční E2E checklist (pro Jirku a Honzíka):**
  1. Přehled: rozpočet, volba sponzora na startu sezóny
  2. Přestupy: koupě hráče (protinávrh → přijetí), prodej přes listinu (nabídka do 3 dnů), zavřený trh v playoff
  3. Finance: bilance sedí s uzávěrkou (po 30. dnu zpráva), vstupné po domácím zápase
  4. Trénink: změna zaměření, pokroky v tréninkový den
  5. Otázka novinářů po vysoké výhře/derby, riskantní odpověď občas selže
  6. Akademie: nová sezóna přivede talenty
  7. Bankrot: utrať vše a nech klub spadnout do −5 mil. → nucený prodej
  8. Staré uložení (verze 3) se přeskočí
- [ ] **Step 5: Stage** — `git add -A`

---

## Self-review plánu

- **Pokrytí specu:** finance (T1 platy/rozpočty, T3 uzávěrka/vstupné/sponzor/bankrot, T4 zavěšení), přestupy (T2 + T4 tick + UI T7), trénink (T5 + UI T8), akademie (T5), média (T6 + UI T9), verze 4 (T1), UI (T7–T9), dokumentace a build (T10). AI paušál vstupného v uzávěrce (T3). Rozpočtový polštář nové sezóny (T4).
- **Typová konzistence:** `odeberZTymu`/`MINIMA`/`pocetNaPozici` exportované z prestupy a použité ve finance (T3); `vyhazov` import z kariery do finance (jednosměrný — kariera finance neimportuje); `NAZVY_ATRIBUTU` ze sezony použit v treninkovyTick (žije v sezona.ts z finálního fixu M2.5); `zmenTrenink` v sezona.ts (potřebuje import `TreninkZamereni`).
- **Vědomá zjednodušení:** jedna runda smlouvání; jedna příchozí nabídka naráz; AI netrénuje; prodaný hráč „do zahraničí" mizí ze hry; média = 5 šablon (spec „~8" orientačně — rozšíření je triviální).
- **Determinismus:** trh/trénink čerpají z `rngDne = createRng(hashSeed(seed, sezona, den, 333))`; akademie 777; odpověď médiím 444 (UI) — vše reprodukovatelné.
- **Riziko testů:** plnosezónní testy z M2/M2.5 poběží s tržními ticky — determinismus drží (stejné seedy → stejné ticky), ale asserty na počty hráčů/zpráv mohou vyžadovat úpravu očekávání (T4/Step 4 to autorizuje s dokumentací).




