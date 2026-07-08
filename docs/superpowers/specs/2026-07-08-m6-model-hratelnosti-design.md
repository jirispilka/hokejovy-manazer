# M6 — Matematický model hratelnosti zápasu

Datum: 2026-07-08  
Stav: schváleno (implementace)  
Navazuje na: `2026-07-07-zapas-trenerske-zasahy-design.md` (nahrazuje kalibrační cíle)

## Proč

Výsledek zápasu působí příliš náhodně a UI je přeplácané. Cíl: **síla týmu/OVR dominuje** s kontrolovaným podílem náhody (~25 % u vyrovnaných týmů), srozumitelné procenta u akcí a jednodušší živý zápas.

## Principy

1. **3-krokový model** — útok v minutě → nebezpečná šance → gól ze střely.
2. **Kalibrace 70–75 %** — favorit o +8 průměrného OVR vyhrává ~70–75 % zápasů (méně náhody než dříve 62 %).
3. **Extrémy fungují** — teoreticky 100 vs 0 OVR → ~98–99 % výher silnějšího.
4. **Vytížení lajn viditelné** — nastavení před zápasem a v přestávce, opravená rotace obrany.
5. **Zjednodušené UI** — bez 2D kluziště; feed + panel síly + predikce %.
6. **Volitelná minihra** — timing u klíčových momentů (pGol ≥ 35 %), ±8 % na šanci.
7. **Determinismus** — stejný seed + volby + timing → stejný výsledek.

---

## A. Index síly

- `silaTymu` + zápasové modifikátory (taktika, energie, vytížení, chemie) → `sily(strana)`.
- Kalibrační metrika: průměrné OVR sestavy (`souhrnSestavy`).

## B. Makro kalibrace (emergentní z minut)

| Δ OVR | Cíl výher silnějšího |
|-------|----------------------|
| 0 | ~50 % |
| +8 | **70–75 %** |
| +20 | ~90 % |
| +50+ | ≥97 % |

Parametr `PODIL_NAHODY = 0.22` — náhoda se projeví variance minut, ne přímým losováním výsledku.

## C. Mikro — tři kroky

1. `pUtokVMinute` — proběhne útok?
2. `pNebezpecnaSance` — nebezpečná situace? (sigmoid rozdílu útoku/obrany)
3. `pGolZeStrelby` — gól? (`ALFA_GOL × strelba/brankář × chemie × energie`)

Neutrální akce při neúspěchu kroku 2: přihrávka, ofsajd, vyhrané buly.

## D. Vytížení lajn

- `Tym.vytizeniUtoku` — předzápasové nastavení (0–2 po lajnách).
- Rotace útoků i obrany podle vah vytížení.
- Střelec z celé aktivní pětky (obránci nižší váha střelby).

## E. Klíčový moment + minihra

- Práh `pGol ≥ 35 %`.
- Volitelná minihra timing: zelená zóna +8 %, blízko +4 %, daleko −4 až −8 %.
- `GameState.nastaveni.minihryZapnuto` (default true).

## F. UI

**Odstranit:** 2D kluziště, panel hráčů za běhu, nasazení za běhu.  
**Ponechat:** skóre, momentum, panel síly s predikcí %, feed, auto-pauzy, přestávky.

## G. Testy

Monte Carlo 500 seeds: +8 OVR → 65–80 %, rovnováha 45–55 %, průměr 4–7 gólů, determinismus.

## H. Mimo rozsah

- Minihra u každé střely.
- Animovaná kostka (stačí text).
