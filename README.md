# Hokejový manažer 🏒

Manažerská hokejová hra pro Honzíka — společný projekt táty a syna.
Tři reálné české ligy (Extraliga, Chance liga, 2. liga), start ve 2. lize,
cíl: probojovat se do extraligy a vyhrát titul.

## Stav projektu (2026-07-05)

- ✅ **Herní design schválen** — [docs/superpowers/specs/2026-07-05-hokej-manazer-design.md](docs/superpowers/specs/2026-07-05-hokej-manazer-design.md)
- ✅ **Implementační plán M1 hotov** — [docs/superpowers/plans/2026-07-05-m1-hratelna-kostra.md](docs/superpowers/plans/2026-07-05-m1-hratelna-kostra.md)
- ⬜ Implementace nezačala — žádný kód zatím neexistuje

## Jak pokračovat

Otevřít plán M1 a vykonat jeho tasky po jednom (v Claude Code: skill
`superpowers:subagent-driven-development` nebo `superpowers:executing-plans`
nad souborem plánu). Plán je samonosný: každý task má kompletní kód, testy
a commit.

## Milníky (ze specu)

1. **M1 — hratelná kostra:** výběr klubu, sestava, simulace s textovým
   průběhem, tabulky, celá sezóna s playoff a postupem/sestupem, ukládání.
   Hráči zatím generovaní (náhodná česká jména).
2. **M2 — zápasový zážitek:** 2D vizualizace kluziště, momentum graf,
   živá šance na gól, odvolání brankáře.
3. **M3 — vedení klubu:** přestupy, trénink, finance, sponzoři, média.
4. **M4 — reálná data + finiš:** **reálné soupisky se skutečnými jmény
   hráčů (tvrdý požadavek)** — jednorázový scraper → JSON v repu; ladění
   obtížnosti, vizuální doladění, balení pro Linux. Datový krok lze
   předsunout před M2/M3, je nezávislý.

Milníky M2–M4 zatím nemají detailní implementační plán — vytvořit až po
dokončení M1 (brainstorming netřeba, spec platí; rovnou skill
`superpowers:writing-plans`).

## Technologie (rozhodnuto)

Tauri 2 + React + TypeScript (strict) + Vite + Vitest.
Herní jádro jako čistá TS knihovna v `src/core/` (deterministická,
seedovaný RNG, plain-JSON stav), UI v `src/ui/`, cíl Linux.
