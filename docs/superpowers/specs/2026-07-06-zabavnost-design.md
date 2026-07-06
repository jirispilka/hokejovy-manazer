# Zábavnost — redesign herní smyčky (M2)

Datum: 2026-07-06
Stav: schváleno v brainstormingu (Jirka)
Navazuje na: `2026-07-05-hokej-manazer-design.md` (základní design platí dál;
tento dokument ho rozšiřuje a mění pořadí milníků)

## Proč

M1 (hratelná kostra) je hotové a nudné — chybí smyčka **rozhodnutí →
viditelný dopad → napětí → odměna**. Jediné rozhodnutí (sestava) nemá
viditelný efekt a nic není v sázce. Tento redesign dává hře herní prvky
po vzoru klasických manažerů (Football Manager, Hattrick, EHM).

## Nové pořadí milníků

- **M2 — Zápas ve tvých rukou + je o co hrát + moderní vizuál** (tento
  spec, jeden milník, implementuje se najednou)
- **M3 — Budování týmu:** přestupy se smlouváním, skauting a wonderkidi,
  trénink, finance, sponzoři, média, akademie (beze změn z původního specu)
- **M4 — Velkolepost:** vizualizace kluziště (canvas), reálné soupisky
  (tvrdý požadavek trvá), zvuky, ladění obtížnosti

Vizualizace kluziště se vědomě odsouvá za interaktivitu — pocit „můžu to
ovlivnit a o něco jde" dává zábavu rychleji než animace.

## M2a: Interaktivní zápas

Zápas je událost na 1–2 minuty, vždy přeskočitelná:

1. **Před zápasem:** soupeř, jeho forma a postavení v tabulce, hláška
   trenéra soupeře; volba taktiky a úprava lajn.
2. **Průběh po třetinách:** textové události naskakují svižně; ovládání
   rychlosti (pauza / normální / rychlá) + „skočit na konec třetiny";
   nahoře **momentum graf** (přetahovaná, kdo dominuje) a **živá šance
   na gól**; velká šance se na okamžik zvýrazní („Novák jede sám na
   bránu…!").
3. **Pauza mezi třetinami:** změna taktiky (útočná / vyvážená / obranná),
   **proslov v kabině** (povzbudit / zdrbat / nechat být → jednorázový
   posun morálky ±, s náhodou, jako FM team talk), přeskládání lajn.
4. **Závěr zápasu:** tlačítko **Odvolat brankáře** (hra bez gólmana,
   velký útočný boost + riziko prázdné brány) a **Time-out**
   (jednorázový boost momenta, 1× za zápas).
5. **Zranění a vyloučení:** hráč může v zápase vypadnout (zranění na 1–3
   zápasy) → okamžité rozhodnutí: kým ho v lajně nahradit. Vyloučení
   zobrazí přesilovku (kdo hraje, šance rostou).
6. **„Odsimulovat zbytek"** — kdykoli; nudný zápas odbydeš jedním klikem.
   Cizí zápasy se simulují na pozadí jako dosud.

### Dopady na jádro (design úrovně, detaily v plánu)

- Taktika (útočná/vyvážená/obranná) je vstup simulace: útočná zvyšuje
  vlastní šance i šance soupeře, obranná obojí snižuje.
- Simulace umí běžet **po třetinách** (stav zápasu je serializovatelný
  mezikrok: skóre, střely, momentum, přesilovky, zranění) — UI mezi
  třetinami mění vstupy.
- **Momentum** je interní stav simulace (posouvá ho gól, šance, přesilovka,
  time-out, atmosféra domácích fanoušků) a mírně ovlivňuje pravděpodobnosti;
  UI ho jen zobrazuje, spolu s odvozenou živou šancí na gól.
- Odvolaný brankář: útok +výrazně, každá střela soupeře = velká šance na
  gól do prázdné brány.
- Zranění: událost v zápase; zraněný hráč má `zranenZapasu: number`
  (počet zápasů mimo), nesmí do sestavy, po vypršení se vrací.
- Determinismus trvá: interaktivní zásahy jsou vstupy, mezi nimi je
  simulace deterministická (stejný seed + stejné zásahy → stejný zápas).

## M2b: Tlak a sázky

- **Cíl sezóny od vedení** podle síly klubu v lize (soupiska vs. ostatní):
  „postup / playoff / střed tabulky / záchrana". Zobrazen trvale na Přehledu.
- **Důvěra vedení** (0–100, start 50): roste s výsledky nad očekávání,
  klesá s prohrami s outsidery a nesplněnými cíli; vyhodnocení i v průběhu
  sezóny. Pod 20 varování („Vedení ztrácí trpělivost!").
- **Vyhazov:** důvěra na 0 nebo hrubě nesplněný cíl → klub tě propustí.
  Hra nekončí: přijdou 2–3 nabídky (slabší kluby, i z nižší ligy),
  vybereš si a kariéra pokračuje. Odmítnout vše = konec kariéry
  (nová hra).
- **Nálada fanoušků** (0–100): výhry/série ji zvedají, prohry srážejí;
  dává malý bonus k momentu domácích zápasů („atmosféra"). Napojení na
  vstupné/peníze přijde v M3.
- **Derby:** každý klub má pevného rivala (datový soubor dvojic).
  Speciální upoutávka, dvojnásobný dopad na náladu fanoušků a důvěru
  vedení.

## M2c: Odměny a historie

- **Vyhlášení sezóny** (obrazovka po finále): mistři lig, nejlepší
  střelec ligy, hvězda mého týmu (nejvíc bodů), postupující/sestupující.
- **Síň trofejí a historie:** trofeje (tituly, postupy), tabulka
  minulých sezón (klub, umístění, cíl splněn/nesplněn), rekordy klubu
  (nejvyšší výhra, nejlepší střelec historie).
- **Profil trenéra:** kariérní statistiky napříč kluby (zápasy, výhry,
  trofeje, vyhazovy) — přežívá vyhazov.
- **Kapitán:** hráč zvolený kapitánem („C" u jména) drží morálku týmu
  (mírnější propady). Volba na obrazovce Sestava.

## M2d: Vizuální kabát („nesmí vypadat jako z roku 2000")

Cíl: moderní tmavý vzhled sportovní aplikace (inspirace FM24 / moderní
sportovní appky), ne generický HTML vzhled. Konkrétně:

- **Typografie:** kvalitní font (Inter/Manrope, přibalený lokálně —
  žádné CDN, hra je offline), jasná hierarchie velikostí, tabulková
  čísla zarovnaná (tabular-nums).
- **Barevný systém:** promyšlená tmavá paleta (pozadí/panely/akcenty),
  akcentní barva klubu — každý klub má v datech **klubové barvy** a
  **monogramový odznak** (kruhové „logo" z iniciál v klubových barvách,
  bez licenčních problémů). Dresové barvy v zápase.
- **Komponenty:** karty se stíny a zaoblením, badge pozic (G/O/Ú),
  progres bary (forma, únava, důvěra, nálada) místo holých čísel,
  hezké tabulky se zvýrazněním, stavové barvy (výhra zelená, prohra
  červená).
- **Pohyb:** jemné přechody a mikroanimace (naskakující události
  v zápase, plynulý momentum graf, přechody obrazovek, „puls" velké
  šance) — CSS transitions/animations, žádná animační knihovna.
- **Zápasová obrazovka jako vlajková loď:** skóre-board jako z TV
  přenosu, animovaný momentum graf, barevné odlišení týmů.
- Žádné nové runtime závislosti — vše CSS + přibalený font + inline SVG.

## UI změny

- **Zápas:** živá obrazovka (události + momentum + šance + ovládací
  tlačítka + pauzy mezi třetinami) místo statického výpisu; výpis
  zůstává jako záznam po zápase.
- **Přehled:** cíl sezóny, důvěra vedení, nálada fanoušků, upoutávka na
  příští zápas (derby zvýrazněné).
- **Nová obrazovka Klub:** síň trofejí, historie sezón, rekordy, profil
  trenéra.
- **Sestava:** volba kapitána.
- **Nová hra:** beze změn (výběr klubu 2. ligy).

## GameState rozšíření (vše plain-JSON)

Trenér (důvěra, kariérní statistiky, aktuální klub), cíl sezóny, nálada
fanoušků, rival klubu (statická data), klubové barvy (statická data),
zranění hráčů (`zranenZapasu`), kapitán týmu, historie sezón, trofeje.
**Rozehraný zápas se neukládá** — autosave probíhá před zápasem a po
něm; načtení uprostřed zápasu ho začne znovu (jednodušší a bezpečné).

## Mimo rozsah M2

- Přestupy, trénink, finance, sponzoři, média (M3 — spec z 2026-07-05)
- Vizualizace kluziště, reálné soupisky (M4)
- Dlouhodobá zranění, disciplinárka, reprezentační přestávky
