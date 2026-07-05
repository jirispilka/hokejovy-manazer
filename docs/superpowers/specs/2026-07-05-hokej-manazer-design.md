# Hokejový manažer — návrh hry

Datum: 2026-07-05
Stav: schváleno v brainstormingu (Jirka)

## Účel a kontext

Manažerská hokejová hra pro Honzíka (12–14 let), vyvíjená jako společný projekt
otce a syna. Kód píše táta, hra musí být srozumitelná a zábavná pro Honzíka.
Jeden hráč proti počítači, česky, offline, na Linuxu.

Inspirace: Football Manager (tempo hry), Hattrick (jednoduchost mechanik),
NHL/FIFA (atributy 1–99).

## Kostra hry

### Soutěže

Tři úrovně věrné realitě, každá 14 týmů, reálné názvy klubů:

- **Extraliga** (Sparta, Pardubice, Třinec, Kometa, …)
- **Chance liga** (Zlín, Jihlava, Přerov, …)
- **2. liga** (Tábor, Vrchlabí, Piráti Chomutov, …)

### Průběh sezóny

1. **Základní část** — každý s každým 2× (26 kol), zápasy 2× týdně.
2. **Playoff** — top 8 týmů ligy, čtvrtfinále → semifinále → finále,
   série na 3 vítězné zápasy (best-of-5).
3. **Postup a sestup** — vítěz playoff nižší ligy postupuje, poslední tým
   základní části vyšší ligy sestupuje (1 nahoru / 1 dolů, bez baráže).
4. Mimo sezónu krátká přestávka s přípravou (přestupy, trénink).

Sezóna odpovídá cca 4 měsícům herního času.

### Herní smyčka

Nová hra → výběr klubu z 2. ligy → dlouhodobý cíl: postoupit do extraligy
a vyhrát titul.

Hraje se vlastním tempem (jako FM): připravíš tým (sestava, taktika,
přestupy, trénink) → tlačítko **Pokračovat** posouvá kalendář den po dni →
v den zápasu se zápas odehraje → výsledky, tabulka, zprávy → opakuj.

## Hráči

- Soupiska ~20 hráčů na tým: 12 útočníků, 6 obránců, 2 brankáři.
- **Reálná jména hráčů** — do hry se přibalí reálné soupisky všech tří lig
  (jednorázový scrape z veřejných zdrojů, např. eliteprospects / hokej.cz,
  uložený jako JSON data). Atributy se odvodí ze skutečných statistik
  (body, věk, pozice), takže reálné hvězdy jsou hvězdy i ve hře.
- Atributy ve stupnici **1–99**: Střelba, Přihrávky, Bruslení, Obrana,
  Fyzička; brankáři Chytání.
- Dynamické veličiny: **Forma** (kolísá zápas od zápasu), **Únava**
  (hraní bez rotace oslabuje), **Věk a potenciál** (mladíci rostou,
  po ~30 letech pozvolný pokles).
- **Morálka týmu** (týmová, ne per hráč): zvedají ji výhry a povedené
  odpovědi médiím, sráží prohry — mírně ovlivňuje výkon v zápase.
- Nově generovaní hráči (odchovanci) dostávají náhodná česká jména.

## Sestava a taktika

- 4 útočné lajny (po 3 hráčích), 3 obranné dvojice, volba brankáře —
  skládání přetahováním myší (drag & drop).
- Taktika: útočná / vyvážená / obranná; volba přesilovkové lajny.
- Mezi třetinami lze taktiku změnit.
- V závěru zápasu tlačítko **„Odvolat brankáře"** (hra bez gólmana).

## Simulace zápasu

- Zápas se generuje jako proud událostí po minutách: šance, střely,
  zákroky, góly, vyloučení, přesilovky.
- Vstupy výpočtu: síla lajn na ledě, forma, únava, taktika, brankář,
  výhoda domácího ledu + náhoda (slabší tým může vyhrát).
- Simulátor je deterministický při daném seedu (testovatelnost).

### Zápasová obrazovka (vizualizace)

- 2D kluziště shora (canvas): puntíky hráčů + puk přehrávají klíčové akce
  (útok → střela → zákrok/GÓL).
- **Momentum graf** — přetahovaná ukazující, kdo právě dominuje.
- **Živá pravděpodobnost gólu** u každé akce (např. „šance 35 %").
- Ukazatel skóre, času a střel jako v TV přenosu.
- Ovládání rychlosti: pauza / normální / zrychlená / přeskočit na konec.

## Vedení klubu

### Přestupy

- Přestupní listina napříč ligami; AI kluby aktivně nakupují a prodávají.
- Cena podle atributů, věku a formy; smlouvy = plat + délka.
- Přestupy otevřené mimo playoff.

### Trénink a rozvoj

- Týdenní zaměření: střelba / obrana / kondice / brankáři.
- Rozvoj podle věku a potenciálu; klubová akademie dodá 1–2 odchovance
  za sezónu.

### Finance

- Příjmy: vstupné (podle návštěvnosti a úspěchů), sponzoři, prodeje hráčů.
- Výdaje: mzdy, provoz, nákupy hráčů.
- Měsíční přehled; záporný zůstatek → varování → vynucené prodeje.

### Sponzoři

- Nabídky smluv podle ligy a výsledků — lepší tým, lepší nabídky.
- Volba: jistota (fix) vs. bonusy za výhry/umístění.
- Logo sponzora viditelné ve vizualizaci zápasu.

### Média

- Kanál **Zprávy** na hlavní obrazovce: reporty ze zápasů, přestupové drby,
  milníky („Novák dal hattrick!").
- Občasné otázky novinářů s volbou odpovědi — vliv na morálku týmu /
  náladu fanoušků.
- Předzápasové upoutávky na derby a klíčové zápasy.

## Obrazovky (UI)

České UI, tmavý profesionální vzhled à la Football Manager.

1. **Přehled** — příští zápas, mini tabulka, zprávy, rychlé akce
2. **Soupiska** — karty hráčů s atributy a statistikami
3. **Sestava** — lajny drag & drop, taktika
4. **Zápas** — kluziště, momentum, šance na gól, rychlost
5. **Liga** — tabulky všech lig, výsledky, playoff pavouk, statistiky střelců
6. **Přestupy** — listina, hledání, nabídky
7. **Trénink**
8. **Finance** — rozpočet + sponzoři
9. **Kalendář**

## Ukládání

Více slotů + autosave po každém herním dni. Lokální soubory na disku
(přes Tauri FS API). Žádný server, žádný internet.

## Technické řešení

- **Tauri 2 + React + TypeScript**; vizualizace kluziště v canvasu.
- **Herní jádro jako čistá TS knihovna** (simulace, liga, kalendář,
  přestupy, finance) — bez závislosti na UI, deterministické, seedovaný
  RNG. Testy ve Vitest.
- UI vrstva (React) jádro pouze volá a zobrazuje jeho stav.
- Data reálných soupisek: jednorázový scraper → JSON přibalené ke hře.
- Cíl: Linux (AppImage / .deb).

## Milníky (každý hratelný)

1. **M1 — hratelná kostra:** výběr klubu, sestava, simulace (výsledek +
   textový průběh), tabulka, celá sezóna s postupem/sestupem, ukládání.
   Hráči zatím generovaní.
2. **M2 — zápasový zážitek:** vizualizace kluziště, momentum, šance na gól,
   ovládání rychlosti, odvolání brankáře.
3. **M3 — vedení klubu:** přestupy, trénink, finance, sponzoři, média.
4. **M4 — reálná data + finiš:** reálné soupisky, ladění obtížnosti,
   vizuální doladění, balení pro Linux.

## Mimo rozsah (zatím)

- Multiplayer v jakékoli podobě
- Reprezentace, mezinárodní poháry
- Zranění a disciplinární řízení (zvážit po M4 — drobné rozšíření)
- Baráž o postup/sestup
- Windows/macOS buildy
