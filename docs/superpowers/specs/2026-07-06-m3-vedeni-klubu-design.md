# M3 — Vedení klubu: přestupy, finance, sponzoři, trénink, akademie, média

Datum: 2026-07-06
Stav: schváleno (Jirka: „všechno najednou"; design delegován)
Navazuje na: specy 2026-07-05, 2026-07-06-zabavnost, 2026-07-06-m25-hloubka

## Finance

- **Rozpočet v Kč u všech 42 klubů** (AI kluby hospodaří taky — trh má
  druhou stranu). Startovní: extraliga 60 mil., Chance liga 20 mil.,
  2. liga 8 mil. Při postupu/sestupu klub dostane startovní rozpočet
  nové ligy, pokud je vyšší než jeho zůstatek (měkký polštář).
- **Plat hráče** (nové pole `plat`, Kč/měsíc): `round(overall² × 25 / 1000) × 1000`
  při generování; přestupem +10 %.
- **Měsíční uzávěrka** každých 30 herních dní: − součet platů soupisky,
  + sponzorský příjem. Zpráva se souhrnem.
- **Vstupné po domácím zápase** (jen můj klub): návštěvnost = základ ligy
  (extraliga 8000, Chance 3500, 2. liga 1200) × (0.6 + nálada/250) ×
  (derby 1.3), příjem = návštěvnost × cena lístku (150/100/60 Kč dle
  ligy). AI kluby místo toho dostávají v měsíční uzávěrce paušál vstupného
  = základ ligy × cena lístku × 4 × 0.8 (≈ 4 domácí zápasy/měsíc).
- **Bankrot:** rozpočet < 0 → varovná zpráva každý týden; < −5 mil. →
  vedení samo prodá nejdražšího hráče „do zahraničí" za jeho hodnotu
  (hráč zmizí ze hry — žádný AI klub se nemusí měnit; zpráva, důvěra −10).
  Hra nekončí.
- **Sponzor s volbou:** na začátku každé sezóny nabídka dvou smluv —
  `jistota` (plný fix: extraliga 12 mil., Chance 4 mil., 2. liga 1,5 mil./měs.)
  vs `bonus` (60 % fixu + prémie za výhru: 400/150/60 tis. Kč). Volba na
  Přehledu; dokud hráč nevybere, běží jistota. Fix se násobí
  (0.8 + důvěra/250).

## Přestupy

- **Okno:** základní část + konec sezóny; v playoff trh zavřený.
- **Hodnota hráče:** `overall² × 4000 × faktorVěku × (1 + (forma−50)/200)`,
  faktorVěku: ≤21 ×1.8, 22–25 ×1.4, 26–29 ×1.0, 30–32 ×0.6, 33+ ×0.35.
- **Nákup:** obrazovka Přestupy — hráči všech lig s filtry (liga, pozice,
  max. cena, řazení dle hodnoty/overall/věku). U cizích hráčů potenciál
  jen jako odhad-rozmezí („75–85", skutečnost ± šum). Nabídka částky →
  AI přijme, pokud ≥ hodnota × faktorOchoty (klíčoví hráči — top 6 týmu
  dle overall — ×1.3, jinak ×0.95); jinak protinávrh = požadovaná částka
  a jedna runda (přijmout/odejít). Kupující platí částku, prodávajícímu
  klubu se přičte. Podpisem plat +10 %. Soupiska max 26 hráčů.
- **Prodej:** vlastního hráče „nabídnout k prodeji" → do 3 herních dnů
  nabídka od AI klubu, který má rozpočet a zájem (částka = hodnota ×
  0.9–1.1) → přijmout/odmítnout. Prodej blokován, pokud by soupiska
  klesla pod 12 Ú / 6 O / 2 B.
- **AI ↔ AI přestupy:** zhruba 1× za 10 dní jeden náhodný (deterministický
  z RNG dne) přestup mezi AI kluby respektující jejich rozpočty → zpráva.
- Přestoupivší hráč: forma 50, únava 0, statistiky sezóny si nese,
  jde na lavičku (sestavu upraví trenér), chemie lajn se nemění
  (mění se až zařazením do lajny přes `zmenSestavuKlubu`).

## Trénink

- **Týdenní zaměření** mého klubu (volba na nové obrazovce Trénink):
  `strelba` / `obrana` / `kondice` / `brankari`.
- Každých 7 herních dní: podle zaměření se 2 náhodní hráči s prostorem
  (overall < potenciál; u kondice bez podmínky) zlepší:
  - strelba → +1 střelba nebo technika (útočníci a obránci)
  - obrana → +1 obrana nebo fyzička
  - kondice → všem −10 únavy navíc a 1 hráč +1 výdrž
  - brankari → +1 chytání brankáře
  Zpráva pro zlepšené hráče. Clamp 99, deterministicky z RNG.
- AI kluby netrénují (jejich růst řeší letní vývoj — vědomé zjednodušení).

## Akademie

- Při `zahajNovouSezonu`: můj klub dostane 1–2 odchovance (17–18 let,
  atributy při spodním okraji ligy, potenciál s bonusem randInt(5,20),
  nízký plat), pokud je místo do 26. AI kluby doplní odchovance jen při
  soupisce < 23 (aby trhem prodané pozice dorostly). Zpráva
  („🎓 Akademie přivedla…").

## Média

- **Otázka novinářů:** po výrazné události (výhra/prohra rozdílem ≥ 4,
  derby, série 5 výher) se na Přehledu objeví karta s otázkou a 2–3
  odpověďmi (šablony, ~8 kusů). Odpověď posune morálku týmu a/nebo
  náladu fanoušků o ±3–5 (deterministicky; „diplomatická" volba bez
  rizika, „ofenzivní" volba risk/reward s rng). Otázka zmizí odpovědí
  nebo dalším odehraným zápasem (bez postihu).
- Přestupové zprávy pokrývá sekce Přestupy (AI ↔ AI + moje obchody).

## UI

- **Nové záložky:** Přestupy (trh + moje nabídky k prodeji), Finance
  (rozpočet, měsíční přehled, poslední pohyby, sponzorská smlouva),
  Trénink (zaměření + poslední efekty).
- **Přehled:** karta rozpočtu (zůstatek + měsíční bilance), karta otázky
  novinářů (když je), volba sponzora na začátku sezóny.
- **Soupiska:** sloupec Plat a Hodnota.

## GameState (plain JSON, verze uložení → 4)

`Hrac.plat`; `Tym.rozpocet`; `GameState.sponzor { typ, mesicne, zaVyhru }`,
`sponzorNabidka: boolean` (čeká na volbu), `treninkZamereni`,
`nabidkyProdeje: { hracId, denOd }[]`, `prichoziNabidka: { hracId,
klubId, castka } | null`, `otazkaMedii: { text, moznosti: { text,
efektMoralka, efektNalada, riskantni }[] } | null`, `posledniUzaverka: number` (den poslední uzávěrky).

## Mimo rozsah

- Délka smluv a volní hráči (M4+), skauti jako osoby, AI trénink,
  vícekolové smlouvání, výkupní klauzule, nálada jednotlivých hráčů
  z ice-timu.
