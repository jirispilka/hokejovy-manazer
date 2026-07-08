# M5 — Hratelnost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Udělat hru zábavnou a ovlivnitelnou — plánovač tréninků s volnou volbou a varováními, bohaté přestupy, kabinové příběhy, plus mechanické opravy ekonomiky a chemie.

**Architecture:** Nový modul `trenink.ts` a `kabinovka.ts` v `src/core/`; rozšíření `GameState` s migrací v6; UI změny v existujících obrazovkách. TDD: nejdřív test, pak implementace. Commity česky `feat:`/`test:` — **jen na výslovnou žádost uživatele**.

**Tech Stack:** TypeScript, Vitest, React `useState`, existující `Rng`/`GameState` vzory.

## Global Constraints

- `src/core/` bez importů z UI/Tauri; žádné `Date`/`Math.random()`/`localStorage` v jádře
- `GameState` musí projít `JSON.stringify` beze ztráty
- Determinismus: stejný seed → stejný výsledek
- UI texty česky; žádné nové npm závislosti
- Trénink: **doporučení ano, tvrdé zákazy ne** — hráč nese důsledky

**Spec:** [`docs/superpowers/specs/2026-07-07-m5-hratelnost-design.md`](../specs/2026-07-07-m5-hratelnost-design.md)

---

## Soubory — přehled

| Nový | Účel |
|------|------|
| `src/core/trenink.ts` | Plán týdne, preview, aplikace, doporučení |
| `src/core/kabinovka.ts` | Generování a vyhodnocení kabinových událostí |
| `src/core/skaut.ts` | Skaut report, filtry hráčů |
| `tests/core/trenink.test.ts` | Testy tréninku |
| `tests/core/kabinovka.test.ts` | Testy kabiny |
| `tests/core/skaut.test.ts` | Testy filtrů/skauta |
| `tests/core/m5-ekonomika.test.ts` | Cashflow, budget floor |

| Upravit | Účel |
|---------|------|
| `src/core/types.ts` | v6 typy |
| `src/core/ulozeni.ts` | Migrace v5→v6 |
| `src/core/sezona.ts` | Trénink tick, kabina tick, briefing |
| `src/core/finance.ts` | `mesicniCashflow`, marketing |
| `src/core/sestava.ts` | Měkká chemie, `navrhPoZapase` |
| `src/ui/obrazovky/Trenink.tsx` | Plánovač 7 dní |
| `src/ui/obrazovky/Prestupy.tsx` | Filtry, skaut, Můj tým |
| `src/ui/obrazovky/Prehled.tsx` | Cashflow, briefing, kabina, příběh týdne |
| `src/ui/komponenty.tsx` | `FiltrHracu` |
| `CLAUDE.md`, `README.md` | Odkaz na M5 |

---

## Fáze 1 — Plánovač tréninků

### Task 1: Typy a migrace v6 (základ)

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/ulozeni.ts`
- Test: `tests/core/ulozeni.test.ts`

**Interfaces:**
- Produces: `TreninkTyp = 'led' | 'posilovna' | 'taktika' | 'odpocinek'`
- Produces: `TreninkDen { typ, hraci?: string[], lajna?: number }`
- Produces: `GameState.treninkovyTyden`, `kabinovaUdalost`, `oblibenyHracId`, `marketing`

- [x] Přidat typy do `types.ts`
- [x] Migrace v5→v6: výchozí prázdné hodnoty, `treninkZamereni` ponechat pro zpětnou kompatibilitu čtení
- [x] Test: načtení v5 save → doplní nová pole
- [x] `npm run test tests/core/ulozeni.test.ts`

### Task 2: Jádro tréninku — preview a doporučení

**Files:**
- Create: `src/core/trenink.ts`
- Create: `tests/core/trenink.test.ts`
- Modify: `src/core/kalendar.ts` — `dnyTydne(hra, odDne)` vrátí 7 dní s typy zápas/klid

- [x] Test: `previewTydne` — led zvedne únavu, odpočinek sníží
- [x] Test: 4 tréninky za týden → přetrénink penalizace
- [x] Test: 2× led → druhý poloviční růst
- [x] Test: `doporucenyPlan` — nepřepíše zápasy, dá odpočinek den před zápasem
- [x] Implementovat `previewTydne`, `doporucenyPlan`, `validujPlan` (jen varování, žádný throw)
- [x] `npm run test tests/core/trenink.test.ts`

### Task 3: Aplikace tréninku v sezóně

**Files:**
- Modify: `src/core/trenink.ts`
- Modify: `src/core/sezona.ts` — nahradit `treninkovyTick` voláním `aplikujTrenink`
- Modify: `tests/core/trenink.test.ts`

- [x] Test: `aplikujTrenink` s vybranými hráči zvedne správný atribut
- [x] Test: determinismus se stejným seedem
- [x] Odstranit starou logiku `den % 7 === 0` jako jediný trigger
- [x] `posledniTrenink` zapisovat s českými názvy typů
- [x] `npm run test`

### Task 4: UI Trénink — 7denní plánovač

**Files:**
- Modify: `src/ui/obrazovky/Trenink.tsx`
- Modify: `src/ui/styl.css`

- [x] Mřížka 7 dní: zápas fixní, volné dny klikatelné (cyklus typů)
- [x] Panel výběru hráčů pro led/posilovnu
- [x] Preview panel pod mřížkou (volá `previewTydne`)
- [x] Tlačítka: **Doporučený plán** + **Potvrdit plán** (uloží `treninkovyTyden`)
- [x] Varování červeně, ale vždy lze potvrdit i riskantní plán
- [x] Ruční: naplánovat riskantní týden → v zápase tým unavený

---

## Fáze 2 — Přestupy a skauting

### Task 5: Filtry a skaut report

**Files:**
- Create: `src/core/skaut.ts`
- Create: `tests/core/skaut.test.ts`
- Modify: `src/ui/obrazovky/Prestupy.tsx`
- Modify: `src/ui/komponenty.tsx` — `FiltrHracu`

- [x] `filtrujHrace(radky, filtr)` — OVR, věk, potenciál, cena, plat, lepšíNezSlaby, zdravý
- [x] `skautReport(hra, hrac, klubId)` — rozmezí potenciálu, text, hvězdičky
- [x] Testy filtrů a nejistoty potenciálu u mladých
- [x] UI: rozšířený filtr panel + šablony (Mladý talent, …)
- [x] Skaut panel v detailu hráče

### Task 6: Prodej vlastních hráčů + deadline

**Files:**
- Modify: `src/ui/obrazovky/Prestupy.tsx`
- Modify: `src/ui/obrazovky/Soupiska.tsx` — odstranit prodejní tlačítka
- Modify: `src/core/prestupy.ts` — fronta 2 nabídek, deadline banner flag

- [x] Záložka/sloupec „Můj tým" s nabídnout/stáhnout
- [x] `trhTick`: max 2 `prichoziNabidka` ve frontě (`prichoziNabidky[]` — rozšířit typ)
- [x] Posledních 7 dní před playoff: `deadlineBlizko` zpráva
- [x] Test: fronta nabídek
- [x] `npm run test tests/core/prestupy.test.ts`

---

## Fáze 3 — Zábavnost

### Task 7: Kabinové události

**Files:**
- Create: `src/core/kabinovka.ts`
- Create: `tests/core/kabinovka.test.ts`
- Modify: `src/core/sezona.ts` — `kabinovyTick` při advanceDay
- Modify: `src/ui/obrazovky/Prehled.tsx`

- [x] Šablony: stížnost, kapitán, odchovanec, hádky (min 4)
- [x] `generujKabinovku(s, rng)` — max 1 za 10–14 dní
- [x] `vyresKabinovku(s, volbaIndex)` — morálka/forma/chemie
- [x] Banner na Přehledu s modalem
- [x] Testy determinismu a dopadů

### Task 8: Derby, briefing, oblíbený hráč

**Files:**
- Modify: `src/core/sezona.ts` nebo `src/core/kariera.ts`
- Modify: `src/ui/obrazovky/Prehled.tsx`
- Modify: `src/ui/obrazovky/Soupiska.tsx` — hvězdička oblíbeného

- [x] `predzapasovyBriefing(hra)` — soupeř, forma, střelec, tip
- [x] Karta briefing před `cekajiciZapas`
- [x] `oblibenyHracId` — toggle na Soupisce
- [x] Milníky gólů v `zapisDopadyZapasu` / `poMemZapase`
- [x] Před derby zvýraznění v briefingu

### Task 9: Příběh týdne na Přehledu

**Files:**
- Modify: `src/ui/obrazovky/Prehled.tsx`

- [x] Karta shrnuje: kabinová událost, derby tento týden, stav tréninkového plánu
- [x] Propojit s kalendářem z `kalendar.ts`

---

## Fáze 4 — Mechanický podklad

### Task 10: Ekonomika

**Files:**
- Modify: `src/core/finance.ts`, `src/core/hodnoty.ts`, `src/core/generator.ts`, `src/core/sezona.ts`
- Create: `tests/core/m5-ekonomika.test.ts`
- Modify: `src/ui/obrazovky/Prehled.tsx`, `src/ui/obrazovky/Finance.tsx`

- [x] `mesicniCashflow(s)` — reálný počet domácích z rozpisu
- [x] Zrušit `Math.max(rozpocet, START_ROZPOCET)` v `zahajNovouSezonu`
- [x] Nové konstanty START_ROZPOCET a SPONZOR_FIX dle specu
- [x] Marketing smlouvy + `oslovSponzory`, `prodejTvPrav`
- [x] UI cashflow na Přehledu a Finance
- [x] Testy cashflow a floor removal

### Task 11: Sestava — měkká chemie

**Files:**
- Modify: `src/core/sestava.ts`, `src/core/zapas.ts`, `src/core/sezona.ts`
- Modify: `tests/core/chemie.test.ts`, `src/ui/obrazovky/Sestava.tsx`

- [x] Proporcionální chemie v `zmenSestavuKlubu` a `upravSestavuVZapase`
- [x] `predikceChemie(tym, novaSestava)`
- [x] `dokonciZapas`: propis sestavy+chemie hráčova týmu ze `stavZapasu`
- [x] `navrhPoZapase(vysledek)` → text tipu
- [x] UI preview při výměně

### Task 12: Soupiska historie

**Files:**
- Modify: `src/ui/obrazovky/Soupiska.tsx`, `src/core/generator.ts`
- Modify: `tests/core/data-m4.test.ts`

- [x] Záložka jen `herniHistorie`, všichni hráči viditelní
- [x] Generator nekopíruje `historieStatistik`

---

## Fáze 5 — Dokončení

### Task 13: Verifikace a dokumentace

- [x] `npm run test` (2×) zelené
- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] Aktualizovat `README.md`, `CLAUDE.md` — M5 hotovo, odkaz na spec/plán
- [x] Odškrtnout checkboxy v tomto plánu
- [x] Ruční E2E checklist (níže)

---

## Ruční E2E checklist

- [x] Trénink: riskantní plán (led den před zápasem) — hra varuje, ale dovolí; tým v zápase unavený
- [x] Trénink: doporučený plán předvyplní, lze upravit
- [x] Přestupy: filtr „mladý talent" + skaut report
- [x] Přestupy: prodat hráče z Můj tým
- [x] Kabinová událost na Přehledu — volba mění morálku
- [x] Briefing před zápasem + derby zvýraznění
- [x] Oblíbený hráč — zpráva po gólu
- [x] Cashflow na Přehledu — bez magického doplnění na 60M po sezóně
- [x] Sestava: měkká chemie + tip po zápase
- [x] Soupiska: žádná reálná kariéra

---

## Pořadí a závislosti

```
Task 1 → 2 → 3 → 4 (trénink komplet)
Task 1 → 5 → 6 (přestupy)
Task 1 → 7 → 8 → 9 (zábava)
Task 1 → 10, 11, 12 (mechanika, paralelně po Task 1)
Task 13 (až vše)
```

**Doporučené pořadí implementace:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13
