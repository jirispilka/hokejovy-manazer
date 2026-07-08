# M4 — Reálná data, přehledné UI a stadionová ekonomika

> Implementační checklist milníku M4 (2026-07-07).

**Goal:** Obohacená reálná data, přehledné UI (Soupiska/Statistiky/Historie, Sestava, Přestupy, Trénink), hlubší finance včetně platů a stadionové ekonomiky.

## Fáze A — Data

- [x] `scripts/stahni-soupisky.mjs` — stažení soupisek + `trzniCena`
- [x] `scripts/obohat-historie.mjs` — historie z profilů hokej.cz + aktuální sezóna
- [x] `scripts/dopln-z-eliteprospects.mjs` — EP záloha (best-effort GraphQL)
- [x] Testy `tests/core/data-m4.test.ts` — 50 %+ extraligy má historii

## Fáze B–F — Jádro a UI

- [x] `platy.ts`, `kalendar.ts`, rozšířený `finance.ts` (stadion, historie)
- [x] Migrace uložení v4 → v5 (`ulozeni.ts`)
- [x] `herniHistorie` v `zahajNovouSezonu`
- [x] Soupiska — 3 sub-záložky
- [x] Sestava — autosave, chemie průvodce, filtr náhradníků, per-line chemie
- [x] Přestupy — 3 sloupce, stránkování, detail
- [x] Trénink — kalendář, odpočet, posledniTrenink
- [x] Finance — 4 sub-záložky (Přehled/Platy/Stadion/Historie)

## Verifikace

- [x] `npm run test` (2×) zelené
- [x] `npx tsc --noEmit`
- [x] `npm run build` — clean
- [ ] Ruční E2E (nová hra → Sparta historie → UI záložky → plat → stadion)
