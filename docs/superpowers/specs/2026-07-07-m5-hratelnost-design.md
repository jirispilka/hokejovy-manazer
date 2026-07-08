# M5 — Hratelnost, plánovač tréninků a skauting

Datum: 2026-07-07
Stav: schváleno (Jirka)
Navazuje na: M4 (`2026-07-07-m4-ux-ekonomika`), zábavnost (`2026-07-06-zabavnost-design.md`)

## Proč

Hra má správné systémy (zápas, přestupy, finance), ale chybí **zábava a
vliv** — hráč kliká Pokračovat a nic zásadního neřeší. M5 přidává
rozhodnutí s trade-offy, příběhy a nástroje k budování týmu.

## Principy

1. **Doporučení ano, zákazy ne** — hra varuje („hráči jsou unavení"), ale
   rozhodnutí je vždy na hráči. Když je přetrénuje, je to jeho chyba.
2. **Viditelný dopad** — každé rozhodnutí má předvídatelný následek v UI.
3. **Příběh > tabulky** — kabina, derby, oblíbený hráč, briefing před zápasem.
4. **Jádro čisté** — žádné nové npm závislosti; `GameState` JSON-serializovatelný.

---

## A. Plánovač tréninků

### Denní volba na Přehledu

Každý volný den hráč na **Přehledu** potvrdí plán dne (s náhledem únavy, formy,
morálky, rozpočtu). Záložka **Trénink** slouží k plánování dopředu na 7 dní.

Typy aktivit: `strelba`, `utok`, `obrana`, `kondice`, `taktika`, `odpocinek`,
`volno`, `zabava`, `parta`, `sponzor`. Více seancí za den povoleno.

### Obrazovka Trénink

7denní kalendář příštího týdne. Známé zápasy (⚔) jsou fixní. Volné dny
hráč naplní aktivitami (viz výše).

| Typ | Efekt |
|-----|-------|
| `strelba` / `utok` / `obrana` | +1 atribut 2 hráčům na ledě |
| `kondice` | −15 únava; +1 výdrž/fyzička 1 hráči |
| `taktika` | +forma; +chemie lajně |
| `odpocinek` | −8 únava; +2 forma |
| `volno` | jen denní regenerace |
| `zabava` | +forma, +morálka |
| `parta` | +chemie lajny, +morálka |
| `sponzor` | +peníze, +důvěra, +nálada |

**Pravidla (důsledky, ne zákazy):**

- Max doporučeno 3 tréninkové dny/týden — 4. a více = přetrénink (−forma celému týmu).
- 2× `led` za týden: druhý má poloviční růst atributů.
- Den před zápasem + `led`: UI varování „riskantní", ale **povoleno**.
- Hráč vždy vybírá konkrétní hráče na led (2) a posilovnu (1).

### Preview a doporučení

Tlačítko **Potvrdit týdenní plán** zobrazí souhrn únavy, růstu a varování.
Tlačítko **Doporučený plán** předvyplní rozumný rozvrh (odpočinek před
zápasem, 2–3 tréninky) — hráč může přepsat.

### Technické

- `GameState.treninkovyTyden: Record<number, TreninkDen | null>` — klíč = herní den
- Plán se potvrdí na začátku týdne; při `advanceDay` se v naplánovaný den
  spustí `aplikujTrenink()`
- Staré `treninkZamereni` deprecated; migrace v6→v7 (led→strelba, posilovna→kondice)
- Modul `src/core/trenink.ts`: `previewDne`, `potvrdDen`, `dalsiDen`, `validujPlan`, …

---

## B. Přestupy — hledání, filtry, skaut

### Filtry trhu

K stávajícímu jménu, lize, pozici:

- OVR min/max
- Věk min/max
- Potenciál min (odhad rozmezí)
- Max. cena, max. plat
- Checkbox „Lepší než můj nejslabší na pozici"
- Jen zdraví

### Řazení

OVR, potenciál, cena, věk, forma, poměr cena/výkon.

### Šablony (1 klik)

Mladý talent · Okamžitá posila · Levná loterie · Brankářská posila

### Skaut report

U vybraného hráče panel s rozmezím potenciálu, textovým komentářem a
hvězdičkovým doporučením. Nejistota roste u mladých a hráčů z nižší ligy.

### Prodej vlastních hráčů

Sloupec „Můj tým" na obrazovce Přestupy (přesun ze Soupisky). Fronta až 2
příchozích nabídek.

### Sdílený komponent

`FiltrHracu` — použitelný i na Soupisce.

---

## C. Zábavnost — příběhy

### Kabinové události

`GameState.kabinovaUdalost` — 1× za 1–2 týdny, banner na Přehledu:

- Stížnost na málo zápasů
- Kapitán žádá tvrdší/lehčí trénink
- Odchovanec září / hádky v lajně

2–3 volby s dopadem na morálku, formu, chemii.

### Derby a rivalové

Využít `rivalove.json`. Před derby briefing (H2H, forma). Po derby speciální
zpráva + média.

### Oblíbený hráč

`oblibenyHracId` — milníky (góly), drama při prodeji.

### Předzápasový briefing

Karta na Přehledu: soupeř, forma, nebezpečný střelec, tip trenéra.

### Deadline day

Posledních 7 dní před uzavřením přestupového okna — více nabídek, banner.

---

## D. Mechanický podklad

### Přehled a ekonomika

- `mesicniCashflow()` — příjmy/výdaje/měsíc, sdíleno s Finance
- Zrušit sezónní `Math.max(rozpocet, START_ROZPOCET)`
- Startovní kapitál: extraliga 20M, Chance 8M, 2. liga 3M
- Sponzor fix: 3M / 1,2M / 500k měsíčně
- Karta „Příběh týdne" na Přehledu

### Soupiska

Smazat zobrazení scraped `historieStatistik`. Jen `herniHistorie`.

### Sestava

Měkká chemie (proporcionální, ne reset na 30). Preview výměny. Propis
sestavy po živém zápase. Tip po zápase.

### Finance

Marketing: dres / LED / TV práva. Oslovit sponzory (cooldown 30 dní).
Vliv tabulky na návštěvnost. Záložka Historie → Účetní deník.

---

## Migrace uložení v5 → v6

```typescript
treninkovyTyden: {}
kabinovaUdalost: null
oblibenyHracId: null
marketing: []
// mapovat treninkZamereni → prázdný týden nebo doporucenyPlan
```

---

## Mimo rozsah M5

- Canvas vizualizace kluziště (M4+ / budoucí)
- Multiplayer, online liga
- Oprava scraperu historie (smazáno místo opravy)
