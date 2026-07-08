# Zápas — pravděpodobnostní model a trenérské zásahy

Datum: 2026-07-07  
Stav: schváleno (Jirka — varianta B balance, varianta A pauzy)  
Navazuje na: `2026-07-06-zabavnost-design.md` (M2 interaktivní zápas), `sestava.ts` (síla týmu, chemie)

## Proč

Sestava a taktika technicky ovlivňují zápas (`silaTymu`, `taktikaFaktory`), ale hráč
to nevidí a výsledek působí náhodně. Cíl: **srozumitelný model šancí** + **trenérská
rozhodnutí**, která šance posunou — ne čistá náhoda, ne micromanagement každé minuty.

## Principy

1. **Viditelná procenta** — u klíčových akcí hráč vidí šanci před losováním.
2. **Příprava + zásah** — sestava/chemie = dlouhodobá síla; během zápasu max 3
   trenérské žetony + povinné volby na přesilovce.
3. **Upset možný, ale vysvětlitelný** (balance B) — favorit vyhrává ~62 % proti týmu
   o ~8 OVR slabšímu; dobré trenérské rozhodnutí posune na ~70 %.
4. **Auto-pauza u napětí** (varianta A) — hra se zastaví u přesilovky a klíčových
   momentů; hráč musí reagovat (max 10 s), jinak default. Víc napětí, méně „klikni
   a čekej“.
5. **Determinismus** — stejný seed + stejné volby hráče → stejný zápas.
6. **Jádro čisté** — rozšíření `StavZapasu`, žádné nové npm závislosti.

---

## A. Pravděpodobnostní model (3 kroky)

Každá útočná akce projde třemi kroky. Výsledek každého kroku jde zobrazit v UI
jako procento (`Udalost.sance`).

### Krok 1 — Kdo útočí?

Tým s vyšší kombinací útoku a situace dostane útok. Místo dvou nezávislých losování
za minutu: **jedna minuta = max jedna útočná akce** (střídá se podle síly + domácí led).

```
pUtocnik = utokA / (utokA + utokB)   // kdo má „puk“
pUtok = clamp(0.55 + 0.35 × pUtocnik, 0.35, 0.90)  // šance že v této minutě vůbec útočí
```

`utok` / `obrana` = `sily(strana)` z `zapas.ts` (sestava, chemie, taktika, energie,
proslov, momentum).

### Krok 2 — Nebezpečná šance?

```
rozdil = utokUtocnika × taktikaUtok − obranaObrance × taktikaObrana
pNebezpeci = sigmoid(0.08 × rozdil + momentumBonus)
```

` sigmoid(x) = 1 / (1 + exp(−x)) `, výsledek clamp 0.12–0.88.

**Taktický trade-off:**
- Pressing: `taktikaUtok ×1.35`, `taktikaObrana ×0.75`; při neúspěchu +15 % šance
  protiútoku soupeře v další minutě.
- Beton: `×0.65` / `×1.30`; soupeř má −20 % na `pNebezpeci`.

### Krok 3 — Gól?

```
pGol = clamp(
  0.06 × (efektivniStrelba / brankarSila) × chemieFaktor(lajna) × energieFaktor,
  0.03, 0.75
)
```

Střelec = vážený výběr z bruslařů na ledě (střelba × energie). Asistence 80 % šance
jako dnes.

**Přesilovka:** místo fixního `×1.6` použít **PP jednotku** (viz B) — síla vybrané
lajny ×1.8 pro útočící, PK jednotka sníží `pNebezpeci` soupeře o 25 %.

---

## B. Auto-pauza — kdy se hra zastaví (varianta A)

Simulace minut **nepokračuje**, dokud hráč nepotvrdí modal (nebo nevyprší 10 s timer
→ použije se **bezpečný default**). Tikání (`rychlost > 0`) se automaticky vynuluje.

| Situace | Auto-pauza? | Co hráč řeší |
|---------|-------------|--------------|
| Vyloučení (PP nebo PK) | **Vždy** | Výběr jednotky (viz B2) |
| Klíčový moment — **náš** útok, `pGol ≥ 35 %` | **Vždy** | Zapálit / Bezpečně / Nechat běžet |
| Klíčový moment — **soupeř** útočí, `pGol ≥ 35 %` | **Vždy** | Timeout / Beton / Nechat běžet |
| Prohráváme o 1 gól, 50.–60. min | **Vždy** (1× za zápas) | Odvolat brankáře? / Pres / Nechat |
| Pauza třetiny | **Vždy** (už dnes) | Proslov, sestava, taktika |
| Zranění našeho hráče | **Vždy** (už dnes) | Náhradník |

**Omezení spamu:** max **2 auto-pauzy klíčového momentu na třetinu** (přesilovka se
do limitu nepočítá). Další vysoké šance v té třetině proběhnou bez pauzy — jen
zvýraznění v feedu.

**Odsimulovat zbytek:** při zapnutém auto-pauze se chová jako dnes — žádné modaly,
AI volí defaulty (rychlý skip pro nudné zápasy).

---

## B2. Přesilovka / oslabení

### Před zápasem

Na obrazovce živého zápasu (nebo Sestavy) hráč nastaví:

| Volba | Možnosti | Default |
|-------|----------|---------|
| PP jednotka | 1.–4. útok | 1. útok |
| PK dvojice | 1.–3. obrana | nejsilnější dvojice |
| PK agresivita | „Bezpečná“ / „Blokovat střelu“ | Bezpečná |

Uloženo v `GameState` u týmu jako `ppJednotka: 0–3`, `pkObrana: 0–2` (volitelné —
pokud chybí, default).

### Během zápasu — vyloučení

Simulace **zastaví tikání** (`rychlost = 0`) a zobrazí modal:

**Máme přesilovku:**
```
⚡ Přesilovka 2 minuty!
[1. útok — doporučeno]  [2. útok]  [4. útok — šetří hvězdy]
```

**Hrajeme oslabení:**
```
🛡️ Oslabení 2 minuty!
[1. obrana — PK]  [2. obrana]  [Bezpečná / Risk blok]
```

Hráč má **10 s**, pak se použije předzápasové nastavení. Volba se zapíše do
`StavZapasu` (`aktivniPpLajna`, `aktivniPkObrana`) na 2 minuty simulace.

**Bez modalu u soupeře** — AI vybere default (nejlepší jednotka).

---

## B3. Klíčový moment — modal (auto-pauza)

Engine **před losováním** spočítá `pGol` a pokud ≥ 35 % (a limit třetiny nedosažen),
nastaví `cekaNaKlicovyMoment` místo okamžitého výsledku.

**Náš útok:**
```
🔥 Klíčový moment — 52. min
Novák jede na branku! Šance na gól: 52 %

[Zapálit to 🔥]  — 1 žeton, gól 52 % → 64 %, kostka 4/6 dobrých
[Hrát bezpečně]  — přihrávka, gól 52 % → 28 %, +momentum malý
[▶ Nechat běžet] — losuje se hned (default po 10 s)
```

**Soupeř útočí:**
```
⚠️ Nebezpečí — 38. min
Soupeř má velkou šanci! Gól: 41 %

[Time-out ⏱]     — 1 žeton, −šance soupeře, +momentum
[Přepnout Beton] — okamžitě (zdarma), obrana +, útok −
[▶ Nechat běžet] — default po 10 s
```

Po volbě (nebo timeoutu modalu) engine **losuje s upraveným `pGol`** a zapíše událost
včetně `sance` v %.

---

## C. Trenérské žetony (3× za zápas)

| Žeton | Efekt | Kdy nabídnout |
|-------|-------|---------------|
| **Timeout** | +20 momentum, −8 % `pGol` soupeře na akci | Modal soupeřova útoku |
| **Zapálit to** | +12 % `pGol` na akci | Modal našeho útoku |
| **Pres / střídání** | 5 min Pressing NEBO výměna unavené lajny | Modal „prohráváme o 1“ nebo ručně v pauze |

Žetony se **nabízejí v auto-pauze** — hráč nemusí hledat tlačítko v panelu. Panel
trenéra zůstává pro taktiku a brankáře kdykoli během pauzy.

Neomezeně (zdarma): změna taktiky, odvolání brankáře (i mimo modal), proslov,
přeskládání lajn v pauze.

---

## D. „Kostka“ — vizualizace, ne nový RNG

Při **Zapálit to** hráč vidí před potvrzením:

```
🎲 Výsledek akce: 4/6 dobrých
   Gól / skvělá šance / dobrá šance / zákrok / vedle / protiútok
```

Šest segmentů má pravděpodobnosti odvozené z `pGol` a momenta — **ne hází se jinak
než dnes**, jen se outcomes zobrazí jako „kostka“ pro srozumitelnost. Žeton posune
1 segment z „špatný“ do „dobrý“.

---

## E. UI během zápasu

### Panel síly (nový, nad skóre)

```
Tvůj tým          Soupeř
Útok:   82         71
Obrana: 74         68
Chemie: 65         58
Síla:  186        172
→ Při útoku: ~41 % nebezpečná šance, ~19 % gól
```

Při změně taktiky krátká animace: `Útok 82 → 98`.

### Trenérský panel

- Taktika (5 úrovní) — beze změny
- Žetony: `●●○` (2 zbývají)
- Odvolat brankáře — vždy dostupné během pauzy / modalu
- **Modal přes celou obrazovku** při auto-pauze (přesilovka, klíčový moment) s odpočtem 10 s
- Ruční pauza (⏸) zůstává — hráč může zastavit sám kdykoli

### Závěrečný souhrn

Po zápase krátký blok: použité žetony, PP/PK volby, průměrná šance vs skóre.

---

## F. Rozšíření stavu (`StavZapasu`)

```typescript
// StranaZapasu — nová pole
ppJednotka: number      // 0–3, aktivní PP lajna
pkObrana: number        // 0–2, aktivní PK dvojice
pkAgresivni: boolean
zbyvajiciZetony: number // start 3, timeout/zapálit/pres −1

// StavZapasu — nová pole
cekaNaPresilovku: {
  strana: 'domaci' | 'hoste'
  minutDo: number       // minuta + 2
  typ: 'pp' | 'pk'
} | null
cekaNaKlicovyMoment: {
  utocnik: 'domaci' | 'hoste'
  pGol: number          // % před losováním
  strelecId: string
  tretina: 1 | 2 | 3
} | null
klicoveMomentyVTretine: [number, number, number]  // počítadlo 0–2 per třetina
cekaNaTlaceni: boolean   // modal „prohráváme o 1 v závěru“, 1× za zápas
protiutokBonus: number  // 0–1, z pressing neúspěchu
```

`GameState` — volitelně per tým: `ppJednotka`, `pkObrana` (předzápasové defaulty).

Migrace uložení: nová pole default (1. útok, 1. obrana, 3 žetony).

---

## G. Balance (varianta B)

Kalibrační cíle (testy Monte Carlo, 500 zápasů):

| Situace | Cíl výher favorita |
|---------|-------------------|
| +8 průměr OVR sestavy | ~62 % |
| +8 OVR + 3 dobré zásahy | ~70 % |
| Rovnováha OVR | ~50 % |
| Průměrný počet gólů | 4–7 celkem |

Trenérské žetony max ±8–12 % na výsledek jednoho zápasu.

---

## H. AI soupeř

- PP/PK: nejlepší dostupná jednotka (energie > 30 %).
- Žetony: 1× timeout když prohrává o 1 gól po 50. minutě; 1× „zapálit“ při šanci > 40 %.
- Skryté — hráč nevidí AI žetony.

---

## I. Testy

1. `sigmoid` a `pNebezpeci` monotónní vůči rozdílu síly.
2. PP jednotka 1. útok > 4. útok na `pGol` v přesilovce.
3. Zapálit to zvýší `pGol` o definovaný delta.
4. Auto-pauza: `cekaNaPresilovku` nebo `cekaNaKlicovyMoment` → `simulujMinutu` se nevolá.
5. Max 2 klíčové pauzy na třetinu — třetí vysoká šance projde bez modalu.
6. Default po 10 s = „Nechat běžet“ bez žetonu.
7. Balance: favorit +8 OVR vyhrává 55–70 % (500 seeds).
8. Determinismus: stejný seed + stejné volby modalů a žetonů → identický výsledek.

---

## J. Mimo rozsah (YAGNI)

- Micromanagement každé minuty / vlastnictví puku po sekundách.
- Animace házení kostkou (stačí text 4/6).
- Nové typy vyloučení (5+10 min).
- Trenérské žetony v lize mimo zápas hráče (AI simulace zůstane jednoduchá).

---

## K. Pořadí implementace (orientační)

1. Refactor `minutaHry` → 3-krokový model + testy balance.
2. Panel síly v `ZivyZapas.tsx`.
3. PP/PK stav + modal auto-pauzy.
4. Klíčový moment modal + limit 2/třetina + timer 10 s.
5. Trenérské žetony v modalu + závěrečný modal „prohráváme o 1“.
6. Předzápasové PP/PK nastavení.
7. Závěrečný souhrn + migrace uložení.

---

## Schválení

- Balance: **B** (~62 % favorit)
- Pauzy: **A** (auto-pauza u přesilovky, klíčových momentů a závěrečného tlaku)
