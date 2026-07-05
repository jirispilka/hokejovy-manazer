# Hokejový manažer — pravidla projektu

Manažerská hokejová hra pro dítě (12–14 let). Česky, offline, Linux desktop.

## Kde co je

- **Herní design (co stavíme):** `docs/superpowers/specs/2026-07-05-hokej-manazer-design.md`
- **Implementační plán M1:** `docs/superpowers/plans/2026-07-05-m1-hratelna-kostra.md`
  — vykonávej tasky po jednom, přesně podle plánu (obsahuje kompletní kód
  i testy). Stav rozdělané práce poznáš z odškrtaných checkboxů `- [x]`
  a z `git log`.
- **Stav projektu a milníky:** `README.md`

## Tvrdá pravidla (neporušovat)

1. `src/core/` je čistá TS knihovna: ŽÁDNÉ importy z `src/ui/`, Reactu ani
   `@tauri-apps/*`. Jádro nikdy nesahá na `Date`, `Math.random()` ani
   `localStorage` — čas i náhodu dostává parametrem (`Rng` z `src/core/rng.ts`).
2. Celý `GameState` musí projít `JSON.stringify` beze ztráty (žádné třídy,
   funkce, Mapy, Sety, Daty v herním stavu).
3. Simulace je deterministická: stejný seed → stejný výsledek. Hlídají to testy.
4. Veškeré texty v UI česky. Herní pojmy v kódu česky (`Hrac`, `sestava`),
   technické anglicky (`createRng`, `GameState`).
5. Atributy hráčů 1–99. Body: 3 / 2 (prodloužení) / 1 / 0, zápas nikdy remízou.
6. Žádné nové závislosti bez souhlasu uživatele (žádný router, žádný
   state-management — stačí React `useState`).

## Příkazy

- `npm run test` — Vitest testy jádra (musí být zelené před každým commitem)
- `npm run dev` — UI v prohlížeči (ukládání padá do localStorage)
- `npm run tauri dev` — plná desktopová aplikace
- `npm run tauri build` — Linux balíčky (AppImage, .deb)

## Workflow

TDD: nejdřív test, ověř že padá, pak implementace, ověř že prochází, commit.
Commity česky s prefixem `feat:`/`test:`/`chore:`. Po každém dokončeném
tasku plánu odškrtni jeho checkboxy v souboru plánu a commitni.
