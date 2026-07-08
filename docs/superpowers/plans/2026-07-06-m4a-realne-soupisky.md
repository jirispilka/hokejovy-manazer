# M4a — Reálné soupisky: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hra používá skutečná jména hráčů všech tří českých lig (tvrdý požadavek ze specu 2026-07-05) — jednorázově stažené soupisky sezóny 2025/26 přibalené jako JSON, atributy odvozené z reálných statistik, generovaní hráči jen jako doplněk/fallback.

**Architecture:** Datový task stáhne soupisky best-effort do `src/core/data/soupisky.json` (stejný přístup jako u log: cíl + kritéria místo doslovného kódu, protože strukturu zdrojů neznáme předem). `generator.ts` pak při stavbě týmu sáhne po reálných hráčích (seřazených podle bodů na zápas), odvodí atributy ze statistik ve stávajících rozsazích ligy a chybějící pozice doplní generovanými hráči; kluby bez dat zůstávají plně generované. Determinismus se zachovává (statická data + stávající rng tok).

**Tech Stack:** beze změn; scraper je jednorázový skript ve `scripts/` (spouštěný ručně, není součástí buildu).

## Global Constraints

- Všechna pravidla CLAUDE.md; **ŽÁDNÉ COMMITY** (jen `git add -A`); testy 2× + `npx tsc --noEmit` po každém tasku.
- Data jsou POUZE pro soukromé rodinné použití (nešířit) — poznámka patří do README.
- `soupisky.json` formát (závazný pro oba tasky):

```json
{
  "sparta": [
    { "jmeno": "Jan", "prijmeni": "Novák", "pozice": "U", "vek": 26, "zapasy": 52, "goly": 18, "asistence": 24 }
  ]
}
```

  — klíč = `klubId` z `kluby.json`; `pozice` ∈ U/D/G; brankáři `goly`/`asistence` 0; neznámé `zapasy` 0; chybějící klub = klíč chybí. Věk 16–45 (mimo rozsah zahodit).
- Nová id reálných hráčů: `r-<klubId>-<pozice>-<i>` (žádný globální čítač).
- Verze uložení se NEMĚNÍ (data ovlivňují jen nové hry).

---

### Task 1: Stažení reálných soupisek (datový task)

**Files:**
- Create: `scripts/stahni-soupisky.mjs` (jednorázový, ručně spouštěný — dokumentační hodnota), `src/core/data/soupisky.json`

**Cíl a kritéria (místo doslovného kódu — struktura zdrojů není předem známá, jako u log):**

1. Pro všech 42 klubů z `src/core/data/kluby.json` zkus získat aktuální soupisku (sezóna 2025/26, případně 2024/25) se jmény, pozicemi, věkem/ročníkem a statistikami (zápasy, góly, asistence) z veřejných zdrojů. Doporučené pořadí: oficiální weby soutěží (hokej.cz / český hokej), eliteprospects.com týmové stránky, Wikipedie jako nouzovka. Slušné chování: sekvenčně, User-Agent `HokejManazer/1.0 (soukromy rodinny projekt)`, žádné hammering.
2. Mapuj pozice: brankář→G, obránce→D, útočník/křídlo/centr→U. Věk spočti z ročníku narození (k roku 2026). Hráče bez čitelného jména zahoď.
3. Ukládej průběžně do `src/core/data/soupisky.json` dle formátu z Global Constraints. Validuj: JSON parsovatelný, klíče jen platná klubId, pozice jen U/D/G, věk 16–45.
4. **Akceptační kritéria:** extraliga pokrytá CELÁ (14/14 klubů, ≥ 18 hráčů na klub — jádro zážitku); Chance liga a 2. liga best-effort (co nejde, vynech — fallback řeší Task 2). Do reportu tabulka pokrytí per klub (počet hráčů U/D/G) a použité zdroje.
5. Skript ulož (i nedokonalý) do `scripts/stahni-soupisky.mjs` s komentářem, z jakých URL četl — pro budoucí aktualizaci soupisek.
6. Sanity: `node -e "const s=require('./src/core/data/soupisky.json'); console.log(Object.keys(s).length)"` + namátkově ověř 3 známá jména hvězd extraligy (např. kapitáni Sparty/Pardubic/Třince) proti realitě.

- [x] Data stažena a validní, report pokrytí sepsán, `git add -A`

---

### Task 2: Integrace do generátoru (kompletní kód)

**Files:**
- Modify: `src/core/generator.ts`
- Test: `tests/core/data-m4.test.ts`

**Interfaces:**
- Consumes: `soupisky.json` (Task 1), stávající `ROZSAHY`, `generujHrace`, `overall`, `clamp` vzory.
- Produces:

```ts
export interface RealnyHrac {
  jmeno: string
  prijmeni: string
  pozice: Pozice
  vek: number
  zapasy: number
  goly: number
  asistence: number
}
export function hracZRealnych(rng: Rng, r: RealnyHrac, uroven: number, id: string): Hrac
// generujTym: klub s ≥ 10 reálnými hráči → top 14 U / 7 D / 2 G podle bodů na zápas
// (brankáři podle odehraných zápasů), nedostatek doplní generujHrace; jinak plný fallback.
```

- [ ] **Step 1: Failing test** — `tests/core/data-m4.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import soupisky from '../../src/core/data/soupisky.json'
import kluby from '../../src/core/data/kluby.json'
import { generujSvet, generujTym, hracZRealnych, resetIdCitac } from '../../src/core/generator'
import { createRng } from '../../src/core/rng'
import { overall } from '../../src/core/sestava'
import type { Klub, Pozice } from '../../src/core/types'

const DATA = soupisky as Record<string, { jmeno: string; prijmeni: string; pozice: Pozice; vek: number; zapasy: number; goly: number; asistence: number }[]>
const pokryteKluby = Object.keys(DATA).filter((id) => DATA[id].length >= 10)

describe('soupisky.json validita', () => {
  it('klíče jsou platná klubId a záznamy dávají smysl', () => {
    const idKlubu = new Set((kluby as Klub[]).map((k) => k.id))
    for (const [klubId, hraci] of Object.entries(DATA)) {
      expect(idKlubu.has(klubId)).toBe(true)
      for (const h of hraci) {
        expect(['U', 'D', 'G']).toContain(h.pozice)
        expect(h.vek).toBeGreaterThanOrEqual(16)
        expect(h.vek).toBeLessThanOrEqual(45)
        expect(h.jmeno.length).toBeGreaterThan(0)
        expect(h.prijmeni.length).toBeGreaterThan(0)
      }
    }
  })
  it('extraliga je pokrytá celá (tvrdý požadavek)', () => {
    const extraliga = (kluby as Klub[]).filter((k) => k.liga === 0).map((k) => k.id)
    for (const id of extraliga) {
      expect(pokryteKluby, `chybí extraligový klub ${id}`).toContain(id)
    }
  })
})

describe('hracZRealnych', () => {
  const vzor = { jmeno: 'Test', prijmeni: 'Hvězda', pozice: 'U' as Pozice, vek: 24, zapasy: 50, goly: 30, asistence: 30 }
  it('lepší statistiky → vyšší overall (velký rozdíl přebije šum)', () => {
    const hvezda = hracZRealnych(createRng(1), vzor, 0, 'r-x-U-0')
    const okraj = hracZRealnych(createRng(1), { ...vzor, goly: 1, asistence: 1 }, 0, 'r-x-U-1')
    expect(overall(hvezda)).toBeGreaterThan(overall(okraj))
  })
  it('nese reálné jméno, věk, id a validní atributy', () => {
    const h = hracZRealnych(createRng(2), vzor, 1, 'r-x-U-0')
    expect(h.jmeno).toBe('Test')
    expect(h.prijmeni).toBe('Hvězda')
    expect(h.vek).toBe(24)
    expect(h.id).toBe('r-x-U-0')
    for (const v of Object.values(h.atributy)) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(99)
    }
    expect(h.plat).toBeGreaterThan(0)
    expect(h.potencial).toBeGreaterThanOrEqual(overall(h))
  })
})

describe('generujTym s reálnými soupiskami', () => {
  it('pokrytý klub dostane reálná jména a správné počty', () => {
    if (pokryteKluby.length === 0) return // žádná data — čistý fallback svět
    const klubId = pokryteKluby[0]
    const klub = (kluby as Klub[]).find((k) => k.id === klubId)!
    resetIdCitac()
    const tym = generujTym(createRng(5), klub)
    expect(tym.hraci.filter((h) => h.pozice === 'U')).toHaveLength(14)
    expect(tym.hraci.filter((h) => h.pozice === 'D')).toHaveLength(7)
    expect(tym.hraci.filter((h) => h.pozice === 'G')).toHaveLength(2)
    const realna = new Set(DATA[klubId].map((r) => `${r.jmeno} ${r.prijmeni}`))
    const zasazenych = tym.hraci.filter((h) => realna.has(`${h.jmeno} ${h.prijmeni}`)).length
    expect(zasazenych).toBeGreaterThanOrEqual(Math.min(15, DATA[klubId].length))
    expect(tym.hraci.some((h) => h.id.startsWith(`r-${klubId}-`))).toBe(true)
  })
  it('nepokrytý klub zůstává generovaný', () => {
    resetIdCitac()
    const nepokryty = (kluby as Klub[]).find((k) => !pokryteKluby.includes(k.id))
    if (!nepokryty) return // vše pokryto — není co testovat
    const tym = generujTym(createRng(6), nepokryty)
    expect(tym.hraci.every((h) => !h.id.startsWith('r-'))).toBe(true)
    expect(tym.hraci).toHaveLength(23)
  })
  it('svět je dál deterministický', () => {
    expect(JSON.stringify(generujSvet(42))).toBe(JSON.stringify(generujSvet(42)))
  })
})
```

- [ ] **Step 2: Ověřit RED** — Run: `npm run test` → FAIL (`hracZRealnych` neexistuje; test extraligy může padat, dokud Task 1 nedodá data — Task 1 běží PŘED tímto taskem).

- [ ] **Step 3: Implementace** — do `src/core/generator.ts`:

```ts
import soupiskyData from './data/soupisky.json'

export interface RealnyHrac {
  jmeno: string
  prijmeni: string
  pozice: Pozice
  vek: number
  zapasy: number
  goly: number
  asistence: number
}

const SOUPISKY = soupiskyData as Record<string, RealnyHrac[]>
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const bodyNaZapas = (r: RealnyHrac) => (r.goly + r.asistence) / Math.max(1, r.zapasy)

// atributy z reálných statistik: body na zápas umístí hráče v rozsahu ligy,
// šum drží rozmanitost, poměr gólů a asistencí ladí střelbu vs. přihrávky
export function hracZRealnych(rng: Rng, r: RealnyHrac, uroven: number, id: string): Hrac {
  const [lo, hi] = ROZSAHY[uroven]
  const rozpeti = hi - lo
  const vykon =
    r.pozice === 'G'
      ? Math.min(1, r.zapasy / 40) * 0.8 + 0.2 // brankář: jednička chytá víc zápasů
      : Math.min(1.3, bodyNaZapas(r)) // 1 bod/zápas ≈ hvězda ligy
  const zaklad = lo + rozpeti * Math.min(1, 0.2 + 0.6 * vykon)
  const kolem = (posun = 0) => clamp(Math.round(zaklad + posun + (rng() - 0.5) * rozpeti * 0.35), 1, 99)
  const slaby = () => randInt(rng, 10, 30)
  const golPodil = (r.goly - r.asistence) / Math.max(1, r.goly + r.asistence) // −1 nahrávač … +1 střelec
  const atributy: Atributy =
    r.pozice === 'G'
      ? { strelba: slaby(), prihravky: slaby(), brusleni: kolem(), obrana: kolem(), fyzicka: kolem(), chytani: kolem(3), vydrz: kolem(), technika: slaby() }
      : r.pozice === 'D'
        ? { strelba: kolem(-8 + golPodil * 6), prihravky: kolem(golPodil * -6), brusleni: kolem(), obrana: kolem(4), fyzicka: kolem(), chytani: slaby(), vydrz: kolem(), technika: kolem() }
        : { strelba: kolem(golPodil * 8), prihravky: kolem(golPodil * -8), brusleni: kolem(), obrana: kolem(-10), fyzicka: kolem(), chytani: slaby(), vydrz: kolem(), technika: kolem() }
  const hrac: Hrac = {
    id,
    jmeno: r.jmeno,
    prijmeni: r.prijmeni,
    vek: r.vek,
    pozice: r.pozice,
    atributy,
    potencial: 0,
    forma: 50,
    unava: 0,
    goly: 0,
    asistence: 0,
    zranenZapasu: 0,
    odehranoSezona: 0,
    plat: 0,
  }
  const o = overall(hrac)
  hrac.potencial = hrac.vek < 24 ? Math.min(99, o + randInt(rng, 3, 15)) : o
  hrac.plat = Math.round((o * o * 25) / 1000) * 1000
  return hrac
}

function sestavHrace(rng: Rng, klub: Klub): Hrac[] {
  const realni = SOUPISKY[klub.id]
  const hraci: Hrac[] = []
  const potreba: [Pozice, number][] = [
    ['U', 14],
    ['D', 7],
    ['G', 2],
  ]
  const maData = !!realni && realni.length >= 10
  for (const [pozice, pocet] of potreba) {
    const kandidati = maData
      ? realni
          .filter((r) => r.pozice === pozice)
          .sort((a, b) => bodyNaZapas(b) - bodyNaZapas(a) || b.zapasy - a.zapasy)
          .slice(0, pocet)
      : []
    kandidati.forEach((r, i) => hraci.push(hracZRealnych(rng, r, klub.liga, `r-${klub.id}-${pozice}-${i}`)))
    for (let i = kandidati.length; i < pocet; i++) hraci.push(generujHrace(rng, pozice, klub.liga))
  }
  return hraci
}
```

a v `generujTym` nahradit stávající tři smyčky `generujHrace` jediným voláním:

```ts
const hraci = sestavHrace(rng, klub)
```

(zbytek — kapitán, sestava, chemie, slozeni, rozpocet — beze změny).

- [ ] **Step 4: Ověřit GREEN** — `npm run test` ×2 (všechny stávající testy MUSÍ zůstat zelené — kalibrační testy zápasu používají fiktivní kluby `x`/`y`, které v soupiskách nejsou → fallback, žádný dopad), `npx tsc --noEmit`.

- [ ] **Step 5: Stage** — `git add -A`

---

### Task 3: Dokumentace a build

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] `npm run test && npm run test` → zelené; `npm run build` → clean; `npm run tauri build` → balíčky.
- [ ] README: M4a hotovo (reálné soupisky, pokrytí dle reportu Tasku 1, poznámka „data i loga jen pro soukromé použití — hru veřejně nešířit"); zbývá M4b (vizualizace kluziště, ladění obtížnosti). CLAUDE.md: odkaz na tento plán + `scripts/stahni-soupisky.mjs` zmínka pro aktualizaci dat.
- [ ] Ruční E2E: nová hra → Sparta/Pardubice mají skutečné hvězdy s vysokým overall; 2. liga kluby bez dat mají generovaná jména; kanadské bodování ukazuje reálná jména.
- [ ] `git add -A`

---

## Self-review plánu

- **Pokrytí specu:** reálná jména (T1 data + T2 integrace), atributy z reálných statistik (T2 `hracZRealnych`), scraper → JSON v repu (T1 + skript pro aktualizace), offline navždy (data přibalená), fallback pro nepokryté kluby (T2). Extraliga celá = akceptační kritérium (jádro „hvězdy jsou hvězdy").
- **Typová konzistence:** `RealnyHrac` a `hracZRealnych` definované v T2 a použité v testech; id `r-<klubId>-<pozice>-<i>` unikátní vůči `h*`/`ak-*`.
- **Vědomá zjednodušení:** brankářská kvalita jen z počtu zápasů (SV% se špatně shání); statistiky z jedné sezóny; hráči bez statistik (nováčci) dostanou nízký výkon — přijatelné.
- **Determinismus:** statická data + stávající rng tok; rozdílný počet draws real/fallback je per klub konstantní.
