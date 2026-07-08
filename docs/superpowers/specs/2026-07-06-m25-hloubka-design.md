# M2.5 — Hloubka a čitelnost: trenér má vidět a ovlivnit

Datum: 2026-07-06
Stav: schváleno v brainstormingu (Jirka; design delegován)
Navazuje na: `2026-07-05-hokej-manazer-design.md` a `2026-07-06-zabavnost-design.md`

## Proč

Hra je po M2 interaktivní, ale trenér málo VIDÍ (atributy, únava, forma,
chemie) a málo OVLIVŇUJE (lajny v zápase, jednotliví hráči, rozvoj mladých).
M2.5 dodává čitelnost a trenérské páky jako v opravdovém manažeru.

## Nové atributy hráče

- **Výdrž (`vydrz`, 1–99):** jak rychle hráči ubývá energie v zápase a jak
  moc mu naroste únava po něm. Generuje se jako ostatní atributy dle úrovně
  ligy.
- **Technika (`technika`, 1–99):** „hráč na puku" — držení puku, kličky.
  Mírně zvyšuje šanci útočné akce jeho lajny.
- Verze uložení → **3** (stará uložení se odmítnou; hra se začíná znovu —
  v rodinném nasazení přijatelné).

## Odvozené údaje (bez nového stavu, čisté funkce)

- **Útočné ladění** = 0.4·střelba + 0.3·technika + 0.3·přihrávky
- **Obranné ladění** = 0.5·obrana + 0.3·fyzička + 0.2·bruslení
- **Role hráče:** `Střelec` (střelba ≥ přihrávky+10), `Tvůrce hry`
  (přihrávky ≥ střelba+10), `Dvoucestný` (obranné ladění ≥ útočné−5),
  jinak `Univerzál`. Brankář roli nemá.
- **Forma týmu:** posledních 5 výsledků klubu (V/VP/PP/P) z odehraných
  zápasů ligy — počitatelné pro všech 42 klubů, žádný nový stav.
- **Kanadské bodování:** top 10 hráčů ligy podle G+A (při shodě víc gólů).

## Chemie sestavy

- Každá útočná lajna a obranná dvojice má **chemii 0–100** (start 30).
- Po každém odehraném zápase: lajna ve stejném složení +6 (strop 100);
  změněné složení → chemie spadne na 30.
- Uloženo na `Tym`: `chemie: { utoky: number[]; obrany: number[] }` +
  otisk složení pro detekci změny (`slozeni: { utoky: string[]; obrany:
  string[] }`, id seřazená a spojená). Plain JSON.
- Efekt: síla lajny × (0.95 + chemie/1000), tj. ±5 %.
- **Celková chemie sestavy** = vážený průměr přes váhy lajn (stejné váhy
  jako síla týmu) — zobrazená v Sestavě.
- Platí i pro AI týmy (mění sestavu jen kvůli zraněním → bývají sehrané).

## Zápas: energie, hodnocení, osobní zásahy, lajny

- **Energie v zápase:** každý hráč v sestavě startuje na 100; za odehranou
  minutu ztrácí energii dle výdrže (silná výdrž ≈ −0.5/min, slabá ≈ −1/min);
  o přestávce +10. Efekt: síla lajny × (0.7 + 0.3·průměrnáEnergie/100).
  Pozápasová únava hráče = stávající únava + (100 − zbývající energie)/4
  (nahrazuje paušál +15). Náhradníci energii neztrácejí — rotace a výdrž
  konečně dávají smysl.
- **Zápasové hodnocení (rating):** start 6.0; gól +1.0, asistence +0.5,
  střela +0.2, vyloučení −0.5, zranění → hodnocení zamrzne; škála 4–10.
  Po zápase se hodnocení hvězdy zápasu objeví ve zprávách.
- **Osobní proslov:** o přestávce může trenér promluvit s JEDNOTLIVÝM
  hráčem: povzbudit / zdrbat (stejné pravděpodobnosti jako týmový proslov,
  ale efekt jen pro něj: osobní bonus výkonu 0.94–1.10 do konce zápasu +
  malý posun energie). Max 1 osobní proslov na hráče a zápas; týmový
  proslov zůstává 1× za přestávku.
- **Přeskládání lajn v zápase:** o přestávkách jde upravit pracovní
  sestava zápasu (click-swap jako v Sestavě, jen zdraví a nezranění
  v zápase). Změny platí jen do konce zápasu (nepropisují se do klubové
  sestavy) a příslušným lajnám snižují chemii zápasově (ne trvale).
  Engine dostane `upravSestavuVZapase(stav, strana, novaSestava)`
  s validací.

## Rozvoj mladých hraním

- Hráč má počítadlo `odehranoSezona` (zápasy v sestavě v aktuální sezóně;
  resetuje se novou sezónou).
- **Průběžný růst:** po každém 5. odehraném zápase v sezóně se hráč s věkem
  ≤ 23 a overall < potenciál zlepší o +1 v náhodném atributu (deterministicky
  z herního RNG). Kdo nehraje, neroste — „dát šanci mladým" má reálný efekt.
- Letní vývoj z M1 zůstává (věk, růst/pokles), jen mladí, co odehráli
  < 10 zápasů, letní růst nedostanou (seděli na lavičce).

## UI

- **Sestava:** řádek hráče = pozice (badge), jméno (Ⓒ, 🚑), overall,
  role, forma (bar), únava (bar), výdrž, střela, útočné/obranné ladění;
  u každé lajny její chemie (bar), nahoře celková chemie sestavy.
- **Živý zápas:** přepínatelný panel „Moji hráči" — pozice (badge), věk,
  energie (bar), hodnocení, forma; o přestávce navíc: osobní proslov
  (tlačítka u hráče) a editor lajn (click-swap, jen zdraví a stejná
  pozice). Po zápase hvězda zápasu.
- **Předzápas:** srovnání síly, formy (posl. 5) a chemie obou týmů.
- **Soutěže:** sloupec Forma (5 teček) v tabulce; záložka/sekce Kanadské
  bodování (top 10 ligy).
- **Přehled:** forma příštího soupeře (5 teček) u upoutávky.
- **Soupiska:** sloupce výdrž, technika, role, odehrané zápasy.

## Dopady na jádro

- `types.ts`: `Atributy` + `vydrz`, `technika`; `Hrac` + `odehranoSezona`;
  `Tym` + `chemie`, `slozeni`; VERZE uložení 3.
- `generator.ts`: generuje nové atributy; init chemie (30) a otisky složení.
- Nový `hodnoty.ts` (odvozené): `utocneLadeni`, `obranneLadeni`, `role`,
  `formaTymu(liga, klubId)`, `kanadskeBodovani(s, liga)`.
- `sestava.ts`/`zapas.ts`: chemie a energie v silách lajn; engine sleduje
  `energie` a `hodnoceni` per hráč; `osobniProslov`, `upravSestavuVZapase`.
- `sezona.ts`: po zápase chemie update + odehranoSezona + průběžný růst +
  únava z energie.
- `Vysledek` ponese závěrečné energie hráčů (`energie: Record<hracId,
  number>`) a hodnocení (`hodnoceni: Record<hracId, number>`) — únava a
  zprávy se tak spočtou stejně pro můj (interaktivní) i AI
  (simulujCelyZapas) zápas.
- Determinismus a čistota jádra beze změn (vše přes `Rng` parametr).

## Mimo rozsah

- Trvalá morálka jednotlivých hráčů, spokojenost s ice-timem (M3)
- AI střídání lajn podle únavy (M3/M4)
- Řazení tabulek kliknutím, filtrování soupisky (M4 polish)
