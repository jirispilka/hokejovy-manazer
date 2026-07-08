# Hokejový manažer 🏒

Manažerská hokejová hra pro Honzíka — společný projekt táty a syna.
Tři reálné české ligy (Extraliga, Chance liga, 2. liga), start ve 2. lize,
cíl: probojovat se do extraligy a vyhrát titul.

## Stav projektu (2026-07-07)

- ✅ **Herní design schválen** — [docs/superpowers/specs/2026-07-05-hokej-manazer-design.md](docs/superpowers/specs/2026-07-05-hokej-manazer-design.md)
- ✅ **M1 hotovo** — [docs/superpowers/plans/2026-07-05-m1-hratelna-kostra.md](docs/superpowers/plans/2026-07-05-m1-hratelna-kostra.md)
  (výběr klubu, sestava, simulace, tabulky, celá sezóna s playoff, ukládání)
- ✅ **Spec zábavnosti schválen** — [docs/superpowers/specs/2026-07-06-zabavnost-design.md](docs/superpowers/specs/2026-07-06-zabavnost-design.md)
- ✅ **M2 hotovo** — [docs/superpowers/plans/2026-07-06-m2-zabavnost.md](docs/superpowers/plans/2026-07-06-m2-zabavnost.md)
  (interaktivní zápas s momentem a živými šancemi, kariéra trenéra
  s cílem/důvěrou/náladou a rizikem vyhazovu, vyhlášení sezóny s trofejemi
  a historií klubu, vizuální doladění — Inter, odznaky klubů, barevné bary,
  animace událostí)
- ✅ **Spec hloubky a čitelnosti schválen** — [docs/superpowers/specs/2026-07-06-m25-hloubka-design.md](docs/superpowers/specs/2026-07-06-m25-hloubka-design.md)
- ✅ **M2.5 hotovo** — [docs/superpowers/plans/2026-07-06-m25-hloubka.md](docs/superpowers/plans/2026-07-06-m25-hloubka.md)
  (výdrž a technika hráčů, role, chemie sestavy a lajn, energie a hodnocení
  v zápase, osobní proslovy, úprava lajn během zápasu, růst mladých hráčů
  hraním, forma týmů, kanadské bodování, reálná loga klubů s fallbackem)
- ✅ **Spec vedení klubu schválen** — [docs/superpowers/specs/2026-07-06-m3-vedeni-klubu-design.md](docs/superpowers/specs/2026-07-06-m3-vedeni-klubu-design.md)
- ✅ **M3 hotovo** — [docs/superpowers/plans/2026-07-06-m3-vedeni-klubu.md](docs/superpowers/plans/2026-07-06-m3-vedeni-klubu.md)
  (přestupy se smlouváním, finance s uzávěrkou a bankrotem, sponzoři
  s volbou, trénink, akademie, otázky novinářů)
- ✅ **M4 hotovo** — [docs/superpowers/plans/2026-07-07-m4-ux-ekonomika.md](docs/superpowers/plans/2026-07-07-m4-ux-ekonomika.md)
  (reálné soupisky s historií a tržní cenou, přehledné UI — Soupiska/Statistiky/Historie,
  Sestava s chemií, interaktivní Přestupy, Trénink s kalendářem, Finance s platy a stadionem)
- ✅ **Spec hratelnosti schválen** — [docs/superpowers/specs/2026-07-07-m5-hratelnost-design.md](docs/superpowers/specs/2026-07-07-m5-hratelnost-design.md)
- ✅ **M5 hotovo** — [docs/superpowers/plans/2026-07-07-m5-hratelnost.md](docs/superpowers/plans/2026-07-07-m5-hratelnost.md)
  (týdenní plánovač tréninků s volbou a varováními, skauting a filtry v přestupech,
  kabinové události a briefing, měkká chemie, cashflow bez magického doplnění rozpočtu,
  marketing, prodej vlastních hráčů, oblíbený hráč)

> **Data i loga jen pro soukromé rodinné použití** — hru veřejně nešířit.
> Aktualizace soupisek: `node scripts/stahni-soupisky.mjs`, obohacení historie: `node scripts/obohat-historie.mjs`.

## Jak pokračovat

Další milníky dle [docs/superpowers/specs/2026-07-05-hokej-manazer-design.md](docs/superpowers/specs/2026-07-05-hokej-manazer-design.md)
(vizualizace kluziště, ladění obtížnosti, balení).

## Milníky (ze specu)

1. **M1 — hratelná kostra (hotovo):** výběr klubu, sestava, simulace
   s textovým průběhem, tabulky, celá sezóna s playoff a postupem/sestupem,
   ukládání. Hráči zatím generovaní (náhodná česká jména).
2. **M2 — zábavnost (hotovo):** interaktivní zápas (momentum, živé šance,
   taktika, proslovy, time-out, odvolání brankáře, zranění), kariéra
   trenéra (cíl sezóny, důvěra, nálada, riziko vyhazovu, derby), vyhlášení
   sezóny (trofeje, rekordy, kapitán, historie klubu), vizuální doladění.
2.5. **M2.5 — hloubka a čitelnost (hotovo):** výdrž/technika, role hráčů,
   chemie sestavy a lajn, energie a hodnocení v zápase, osobní proslovy
   a úprava lajn během zápasu, růst mladých hráčů hraním, forma týmů,
   kanadské bodování, reálná loga klubů s fallbackem.
3. **M3 — budování týmu (hotovo):** přestupy se smlouváním (protinávrhy,
   listina, uzavřený trh v playoff), finance s měsíční uzávěrkou a vstupným,
   sponzoři s volbou na startu sezóny, bankrot a nucený prodej, trénink se
   zaměřením, akademie mladých talentů, otázky novinářů po zápasech.
4. **M4 — reálná data a UX (hotovo):** reálné soupisky se jmény, historií
   statistik a tržní cenou; přehledné obrazovky Soupiska/Sestava/Přestupy/Trénink;
   finance s úpravou platů, stadionovými příjmy (vstupné, jídlo, merch).
5. **M5 — hratelnost (hotovo):** denní volba aktivit na Přehledu (střelba/útok/obrana/kondice/taktika,
   odpočinek, volno, zábava, team building, akce se sponzory) + plánovač na 7 dní dopředu,
   skauting s filtry a reportem, kabinové příběhy, briefing před zápasem, měkká chemie,
   realističtější ekonomika, marketing, prodej vlastních hráčů, oblíbený hráč.
6. **M6 — model zápasu (hotovo):** kalibrovaný 3-krokový pravděpodobnostní model (OVR dominuje),
   zjednodušené UI zápasu, vytížení lajn, volitelná minihra u klíčových momentů.
   Spec: [docs/superpowers/specs/2026-07-08-m6-model-hratelnosti-design.md](docs/superpowers/specs/2026-07-08-m6-model-hratelnosti-design.md)

## Technologie (rozhodnuto)

Tauri 2 + React + TypeScript (strict) + Vite + Vitest.
Herní jádro jako čistá TS knihovna v `src/core/` (deterministická,
seedovaný RNG, plain-JSON stav), UI v `src/ui/`, cíl Linux.
